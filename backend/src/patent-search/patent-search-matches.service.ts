import { BadRequestException, Injectable } from "@nestjs/common";
import { OaDatabaseService } from "../oa-database/oa-database.service";
import {
  PatentSearchKeywordDto,
  type PatentSearchKeywordTarget,
  PatentSearchMatchesDto,
} from "./dto/patent-search.dto";

type PatentSearchMatchRow = {
  office_action_id: number;
  relevance_score: number | string | null;
};

export type PatentSearchMatchResult = {
  total: number;
  items: Array<{
    officeActionId: number;
    relevanceScore: number | null;
  }>;
};

type BuiltMatchQuery = { sql: string; params: string[] };
type IncludeGroup = PatentSearchKeywordDto[];

type QueryBuildContext = {
  ctes: string[];
  params: string[];
};

/**
 * OA DB의 ParadeDB BM25 인덱스로 전체 키워드 매칭 ID만 읽는다.
 *
 * OR로 이어진 INCLUDE는 한 그룹, 그룹 사이는 AND로 결합한다. 각 검색어 안에서는 모든
 * token을 요구하고, exact phrase는 BM25 score에 1점을 더한다. NOT은 후보 본문에서 literal로
 * 판정하며 응답에는 본문을 포함하지 않는다.
 */
@Injectable()
export class PatentSearchMatchesService {
  constructor(private readonly database: OaDatabaseService) {}

  async search(dto: PatentSearchMatchesDto): Promise<PatentSearchMatchResult> {
    const { sql, params } = this.buildQuery(dto.keywords);
    const rows = await this.database.query<PatentSearchMatchRow>(sql, params);
    return {
      total: rows.length,
      items: rows.map((row) => ({
        officeActionId: row.office_action_id,
        relevanceScore:
          row.relevance_score === null ? null : Number(row.relevance_score),
      })),
    };
  }

  buildQuery(keywords: PatentSearchKeywordDto[]): BuiltMatchQuery {
    const { includeGroups, excludes } = this.groupKeywords(keywords);
    if (includeGroups.length === 0) {
      throw new BadRequestException("PATENT_SEARCH_MATCHES_REQUIRES_INCLUDE");
    }

    const context: QueryBuildContext = { ctes: [], params: [] };
    const groupAliases = includeGroups.map((group, groupIndex) =>
      this.compileIncludeGroup(group, groupIndex, context),
    );
    const groupJoins = groupAliases
      .map((alias) => `JOIN ${alias} ON ${alias}.oa_id = oa.id`)
      .join("\n    ");
    const relevanceScore = `(${groupAliases
      .map((alias) => `${alias}.score`)
      .join(" + ")}) / ${groupAliases.length}::double precision`;
    context.ctes.push(`included AS MATERIALIZED (
  SELECT oa.id AS office_action_id,
         ${relevanceScore} AS relevance_score,
         a.action_date
    FROM office_action oa
    JOIN admin a ON a.id = oa.admin_id
    ${groupJoins}
)`);

    const exclusionPredicates = this.compileExclusions(excludes, context);
    return {
      sql: `WITH ${context.ctes.join(",\n")}
SELECT included.office_action_id,
       included.relevance_score
  FROM included
 ${exclusionPredicates.length
    ? `WHERE ${exclusionPredicates.join("\n   AND ")}`
    : ""}
 ORDER BY included.relevance_score DESC,
          included.action_date DESC NULLS LAST,
          included.office_action_id DESC`,
      params: context.params,
    };
  }

  private compileIncludeGroup(
    group: IncludeGroup,
    groupIndex: number,
    context: QueryBuildContext,
  ): string {
    const byTarget = new Map<PatentSearchKeywordTarget, PatentSearchKeywordDto[]>();
    group.forEach((keyword) => {
      const targetKeywords = byTarget.get(keyword.target) ?? [];
      targetKeywords.push(keyword);
      byTarget.set(keyword.target, targetKeywords);
    });

    const targetAliases = [...byTarget.entries()].map(
      ([target, targetKeywords], targetIndex) =>
        this.compileTarget(
          target,
          targetKeywords,
          `keyword_group${groupIndex}_target${targetIndex}`,
          context,
        ),
    );
    const alias = `keyword_group${groupIndex}`;
    const alternatives = targetAliases
      .map(
        (targetAlias) =>
          `SELECT ${targetAlias}.oa_id, ${targetAlias}.score FROM ${targetAlias}`,
      )
      .join("\n    UNION ALL\n    ");
    context.ctes.push(`${alias} AS (
  SELECT alternatives.oa_id, max(alternatives.score) AS score
    FROM (
    ${alternatives}
    ) alternatives
   GROUP BY alternatives.oa_id
)`);
    return alias;
  }

  private compileTarget(
    target: PatentSearchKeywordTarget,
    keywords: PatentSearchKeywordDto[],
    alias: string,
    context: QueryBuildContext,
  ): string {
    const prepared = keywords.map((keyword) => ({
      keyword,
      parameter: this.addParameter(context, keyword.query.trim()),
    }));
    const queries = prepared.map(
      ({ parameter }) => `paradedb.match(
               'content',
               ${parameter},
               conjunction_mode => true
             )`,
    );
    const searchQuery = queries.length === 1
      ? queries[0]
      : `paradedb.disjunction_max(
           ARRAY[
             ${queries.join(",\n             ")}
           ],
           0.0
         )`;
    const baseAlias = `${alias}_base`;
    if (target === "officeAction") {
      context.ctes.push(`${baseAlias} AS MATERIALIZED (
  SELECT id AS oa_id,
         sqrt(paradedb.score(id))::double precision AS score
    FROM office_action
   WHERE id @@@ ${searchQuery}
)`);
    } else {
      context.ctes.push(`${baseAlias} AS MATERIALIZED (
  SELECT oa_id,
         max(sqrt(paradedb.score(id)))::double precision AS score
    FROM response
   WHERE type = ${target === "opinion" ? 1 : 2}
     AND id @@@ ${searchQuery}
   GROUP BY oa_id
)`);
    }

    const phraseKeywords = prepared.filter(({ keyword }) =>
      keyword.query.trim().split(/\s+/).length > 1,
    );
    if (phraseKeywords.length === 0) {
      context.ctes.push(`${alias} AS (
  SELECT oa_id, max(score)::double precision AS score
    FROM ${baseAlias}
   GROUP BY oa_id
)`);
      return alias;
    }

    const phraseAlias = `${alias}_phrase_documents`;
    const contentTable = target === "officeAction" ? "office_action" : "response";
    const contentJoin = target === "officeAction"
      ? `${contentTable}.id = ${baseAlias}.oa_id`
      : `${contentTable}.oa_id = ${baseAlias}.oa_id
         AND ${contentTable}.type = ${target === "opinion" ? 1 : 2}`;
    const phrasePredicates = phraseKeywords
      .map(
        ({ parameter }) =>
          `strpos(normalized_content, lower(${parameter})) > 0`,
      )
      .join(" OR ");
    context.ctes.push(`${phraseAlias} AS MATERIALIZED (
  SELECT phrase_candidates.oa_id, phrase_candidates.score
    FROM (
      SELECT ${baseAlias}.oa_id,
             ${baseAlias}.score,
             lower(${contentTable}.content) AS normalized_content
        FROM ${baseAlias}
        JOIN ${contentTable}
          ON ${contentJoin}
    ) phrase_candidates
   WHERE ${phrasePredicates}
)`);
    context.ctes.push(`${alias} AS (
  SELECT oa_id, coalesce(max(score), 0) + 1 AS score
    FROM ${phraseAlias}
   GROUP BY oa_id
  UNION ALL
  SELECT ${baseAlias}.oa_id, max(${baseAlias}.score) AS score
    FROM ${baseAlias}
   WHERE NOT EXISTS (
         SELECT 1
           FROM ${phraseAlias}
          WHERE ${phraseAlias}.oa_id = ${baseAlias}.oa_id
       )
   GROUP BY ${baseAlias}.oa_id
)`);
    return alias;
  }

  private compileExclusions(
    excludes: PatentSearchKeywordDto[],
    context: QueryBuildContext,
  ): string[] {
    if (excludes.length === 0) return [];
    const hasOfficeActionExclude = excludes.some(
      (keyword) => keyword.target === "officeAction",
    );
    const responseTypes = [
      ...new Set(
        excludes
          .filter((keyword) => keyword.target !== "officeAction")
          .map((keyword) => (keyword.target === "opinion" ? 1 : 2)),
      ),
    ];
    if (hasOfficeActionExclude) {
      context.ctes.push(`candidate_excluded_office_action AS MATERIALIZED (
  SELECT oa.id AS oa_id, oa.content
    FROM office_action oa
    JOIN included ON included.office_action_id = oa.id
)`);
    }
    if (responseTypes.length > 0) {
      context.ctes.push(`candidate_excluded_response AS MATERIALIZED (
  SELECT response.oa_id, response.type, response.content
    FROM response
    JOIN included ON included.office_action_id = response.oa_id
   WHERE response.type IN (${responseTypes.join(", ")})
)`);
    }

    return excludes.map((keyword) => {
      const parameter = this.addParameter(context, keyword.query.trim());
      if (keyword.target === "officeAction") {
        return `NOT (EXISTS (
  SELECT 1
    FROM candidate_excluded_office_action excluded_office_action
   WHERE excluded_office_action.oa_id = included.office_action_id
     AND strpos(lower(excluded_office_action.content), lower(${parameter})) > 0
))`;
      }
      return `NOT (EXISTS (
  SELECT 1
    FROM candidate_excluded_response excluded_response
   WHERE excluded_response.oa_id = included.office_action_id
     AND excluded_response.type = ${keyword.target === "opinion" ? 1 : 2}
     AND strpos(lower(excluded_response.content), lower(${parameter})) > 0
))`;
    });
  }

  private groupKeywords(keywords: PatentSearchKeywordDto[]): {
    includeGroups: IncludeGroup[];
    excludes: PatentSearchKeywordDto[];
  } {
    const includeGroups: IncludeGroup[] = [];
    const excludes: PatentSearchKeywordDto[] = [];
    keywords.forEach((keyword) => {
      if (keyword.operator === "NOT") {
        excludes.push(keyword);
      } else if (keyword.operator === "OR" && includeGroups.length > 0) {
        includeGroups[includeGroups.length - 1].push(keyword);
      } else {
        includeGroups.push([keyword]);
      }
    });
    return { includeGroups, excludes };
  }

  private addParameter(context: QueryBuildContext, value: string): string {
    context.params.push(value);
    return `$${context.params.length}`;
  }
}
