import { Injectable, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool, type QueryResultRow } from "pg";

/**
 * 외부 OA DB 전용 connection pool.
 *
 * Prisma가 관리하는 IP Workspace DB와 수명주기를 분리하며, 연결 세션 자체를 read-only로
 * 강제해 조회 용도를 벗어난 SQL이 실수로 추가되어도 DB가 거부하도록 한다.
 */
@Injectable()
export class OaDatabaseService implements OnApplicationShutdown {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    const statementTimeoutMs = config.get<number>(
      "oaDatabase.statementTimeoutMs",
      5000,
    );

    this.pool = new Pool({
      host: config.get<string>("oaDatabase.host", "172.16.1.210"),
      port: config.get<number>("oaDatabase.port", 15432),
      user: config.get<string>("oaDatabase.user", "postgres"),
      password: config.get<string>("oaDatabase.password", "1234"),
      database: config.get<string>("oaDatabase.database", "OA"),
      application_name: "ip-workspace-oa-readonly",
      options: "-c default_transaction_read_only=on",
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: config.get<number>(
        "oaDatabase.connectionTimeoutMs",
        5000,
      ),
      statement_timeout: statementTimeoutMs,
      query_timeout: statementTimeoutMs,
    });
  }

  /**
   * 조회 한 번.
   *
   * `params`를 받는 이유: 화면에서 온 값(출원번호 등)으로 거르는 질의가 생겼다. 문자열을
   * 이어 붙이면 read-only 세션이라도 **읽어서는 안 될 것을 읽는** 질의는 만들어진다.
   * 값은 반드시 자리표시자($1, $2…)로 넘긴다.
   */
  async query<T extends QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const result = await this.pool.query<T>(sql, params);
    return result.rows;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
