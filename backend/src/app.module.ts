import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PatentAnalysisModule } from './patent-analysis/patent-analysis.module';
import { ConformerModule } from './conformer/conformer.module';
import { CompoundApiModule } from './compound-api/compound-api.module';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth/auth';
import { MedichemAuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { AdminModule } from './admin/admin.module';
import { CalculationsModule } from './calculations/calculations.module';

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
        json: { limit: '2mb' },
        urlencoded: {
          limit: `${process.env.THREE_D_PSA_CALLBACK_MAX_BODY_MB ?? '25'}mb`,
          extended: true,
        },
      },
    }),
    MedichemAuthModule,
    AdminModule,
    HealthModule,
    PatentAnalysisModule,
    ConformerModule,
    CompoundApiModule,
    CalculationsModule,
  ],
})
export class AppModule {}
