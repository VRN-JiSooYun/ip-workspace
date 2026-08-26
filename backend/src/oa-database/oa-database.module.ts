import { Global, Module } from "@nestjs/common";
import { OaDatabaseService } from "./oa-database.service";

/** 기존 Prisma DB와 분리된 외부 OA PostgreSQL 연결을 전역으로 제공한다. */
@Global()
@Module({ providers: [OaDatabaseService], exports: [OaDatabaseService] })
export class OaDatabaseModule {}
