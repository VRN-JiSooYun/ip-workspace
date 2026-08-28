import { BadRequestException } from "@nestjs/common";
import { PatentSearchMatchesService } from "./patent-search-matches.service";

const makeService = () => {
  const query = jest.fn().mockResolvedValue([
    { office_action_id: 12, relevance_score: "2.5" },
  ]);
  return {
    service: new PatentSearchMatchesService({ query } as never),
    query,
  };
};

describe("PatentSearchMatchesService", () => {
  it("returns all lightweight OA matches without selecting document content", async () => {
    const { service, query } = makeService();
    await expect(service.search({
      keywords: [{ query: "진보성", target: "officeAction", operator: "AND" }],
    })).resolves.toEqual({
      total: 1,
      items: [{ officeActionId: 12, relevanceScore: 2.5 }],
    });

    const [sql, params] = query.mock.calls[0] as [string, string[]];
    expect(sql).toContain("paradedb.score(id)");
    expect(sql).toContain("paradedb.match(");
    expect(sql).toContain("conjunction_mode => true");
    expect(sql).toContain("included AS MATERIALIZED");
    expect(sql).toContain("SELECT included.office_action_id");
    expect(sql).not.toContain("oa.content AS");
    expect(params).toEqual(["진보성"]);
  });

  it("combines included targets and excludes NOT matches", () => {
    const { service } = makeService();
    const built = service.buildQuery([
      { query: "진보성", target: "opinion", operator: "AND" },
      { query: "신규성", target: "amendment", operator: "NOT" },
    ]);

    expect(built.sql).toContain("response");
    expect(built.sql).toContain("type = 1");
    expect(built.sql).toContain("NOT (EXISTS");
    expect(built.sql).toContain("candidate_excluded_response AS MATERIALIZED");
    expect(built.sql).toContain("response.type IN (2)");
    expect(built.sql).toContain("excluded_response.type = 2");
    expect(built.sql).toContain(
      "strpos(lower(excluded_response.content), lower($2)) > 0",
    );
    expect(built.sql).not.toContain("excluded_response.content @@@ $2");
    expect(built.params).toEqual(["진보성", "신규성"]);
  });

  it("requires all tokens and boosts an exact multi-word phrase", () => {
    const { service } = makeService();
    const built = service.buildQuery([
      {
        query: "epidermal squamous cell carcinoma",
        target: "opinion",
        operator: "AND",
      },
    ]);

    expect(built.sql).toContain(
      "keyword_group0_target0_base AS MATERIALIZED",
    );
    expect(built.sql).toContain("conjunction_mode => true");
    expect(built.sql).toContain(
      "max(sqrt(paradedb.score(id)))::double precision AS score",
    );
    expect(built.sql).toContain(
      "keyword_group0_target0_phrase_documents AS MATERIALIZED",
    );
    expect(built.sql).toContain("lower(response.content) AS normalized_content");
    expect(built.sql).toContain("strpos(normalized_content, lower($1)) > 0");
    expect(built.sql).toContain("coalesce(max(score), 0) + 1");
    expect(built.params).toEqual(["epidermal squamous cell carcinoma"]);
  });

  it("combines OR alternatives inside groups and ANDs the groups", () => {
    const { service } = makeService();
    const built = service.buildQuery([
      { query: "EGFR", target: "officeAction", operator: "AND" },
      { query: "HER2", target: "officeAction", operator: "OR" },
      { query: "저해제", target: "opinion", operator: "AND" },
      { query: "억제제", target: "opinion", operator: "OR" },
    ]);

    expect(built.sql).toContain("keyword_group0 AS");
    expect(built.sql).toContain("keyword_group0_target0 AS");
    expect(built.sql).toContain("paradedb.disjunction_max(");
    expect(built.sql).toContain("$1");
    expect(built.sql).toContain("$2");
    expect(built.sql).toContain("keyword_group1 AS");
    expect(built.sql).toContain("keyword_group1_target0 AS");
    expect(built.sql).toContain("$3");
    expect(built.sql).toContain("$4");
    expect(built.sql).toContain(
      "JOIN keyword_group0 ON keyword_group0.oa_id = oa.id",
    );
    expect(built.sql).toContain(
      "JOIN keyword_group1 ON keyword_group1.oa_id = oa.id",
    );
    expect(built.sql).toContain("/ 2::double precision");
  });

  it("unions OR alternatives across different document targets", () => {
    const { service } = makeService();
    const built = service.buildQuery([
      { query: "EGFR", target: "officeAction", operator: "AND" },
      { query: "HER2", target: "opinion", operator: "OR" },
    ]);

    expect(built.sql).toContain("keyword_group0_target0 AS");
    expect(built.sql).toContain("keyword_group0_target1 AS");
    expect(built.sql).toContain(
      "SELECT keyword_group0_target0.oa_id, keyword_group0_target0.score",
    );
    expect(built.sql).toContain("UNION ALL");
    expect(built.sql).toContain(
      "SELECT keyword_group0_target1.oa_id, keyword_group0_target1.score",
    );
    expect(built.sql).toContain("max(alternatives.score) AS score");
  });

  it("uses a case-insensitive literal exclusion for office action content", () => {
    const { service } = makeService();
    const built = service.buildQuery([
      { query: "EGFR", target: "opinion", operator: "AND" },
      { query: "Inventive Step", target: "officeAction", operator: "NOT" },
    ]);

    expect(built.sql).toContain(
      "candidate_excluded_office_action AS MATERIALIZED",
    );
    expect(built.sql).toContain(
      "strpos(lower(excluded_office_action.content), lower($2)) > 0",
    );
    expect(built.params).toEqual(["EGFR", "Inventive Step"]);
  });

  it("rejects an exclude-only request", () => {
    const { service } = makeService();
    expect(() => service.buildQuery([
      { query: "진보성", target: "officeAction", operator: "NOT" },
    ])).toThrow(BadRequestException);
  });
});
