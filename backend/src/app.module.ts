import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import configuration from "./config/configuration";
import { validateEnv } from "./config/env.validation";
import { HealthModule } from "./health/health.module";
import { PatentAnalysisModule } from "./patent-analysis/patent-analysis.module";
import { ConformerModule } from "./conformer/conformer.module";
import { CompoundApiModule } from "./compound-api/compound-api.module";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "./auth/auth";
import { IpAuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { AdminModule } from "./admin/admin.module";
import { ConferenceMediaModule } from "./conference-media/conference-media.module";
import { ConferenceImportModule } from "./conference-import/conference-import.module";
import { ConferenceReadModule } from "./conference-read/conference-read.module";
import { ConferenceInteractionModule } from "./conference-interaction/conference-interaction.module";
import { ConferenceAdminModule } from "./conference-admin/conference-admin.module";
import { NotificationRecipientModule } from "./notification-recipient/notification-recipient.module";
import { ConferenceMailModule } from "./conference-mail/conference-mail.module";
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
    PatentAnalysisModule,
    PatentAnalysisAdminModule,
    ConformerModule,
    CompoundApiModule,
    ConferenceMediaModule,
    ConferenceImportModule,
    ConferenceReadModule,
    ConferenceInteractionModule,
    ConferenceAdminModule,
    NotificationRecipientModule,
    ConferenceMailModule,
  ],
})
export class AppModule {}
