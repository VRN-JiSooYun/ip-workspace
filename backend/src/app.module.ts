import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import configuration from "./config/configuration";
import { validateEnv } from "./config/env.validation";
import { HealthModule } from "./health/health.module";
import { HolidayModule } from "./holiday/holiday.module";
import { PatentAnalysisModule } from "./patent-analysis/patent-analysis.module";
import { PatentRecordModule } from "./patent-record/patent-record.module";
import { PatentSearchModule } from "./patent-search/patent-search.module";
import { ConformerModule } from "./conformer/conformer.module";
import { CompoundApiModule } from "./compound-api/compound-api.module";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "./auth/auth";
import { IpAuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { AdminModule } from "./admin/admin.module";
import { NotificationRecipientModule } from "./notification-recipient/notification-recipient.module";
import { PatentAnalysisAdminModule } from "./patent-analysis-admin/patent-analysis-admin.module";
import { AuthorizationModule } from "./authorization/authorization.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    DatabaseModule,
    AuthModule.forRoot({
      auth,
      bodyParser: {
        json: { limit: "2mb" },
        urlencoded: { limit: "2mb", extended: true },
      },
    }),
    IpAuthModule,
    AuthorizationModule,
    AdminModule,
    HealthModule,
    HolidayModule,
    PatentAnalysisModule,
    PatentRecordModule,
    PatentSearchModule,
    PatentAnalysisAdminModule,
    ConformerModule,
    CompoundApiModule,
    NotificationRecipientModule,
  ],
})
export class AppModule {}
