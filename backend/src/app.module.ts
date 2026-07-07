import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PatentAnalysisModule } from './patent-analysis/patent-analysis.module';
import { ConformerModule } from './conformer/conformer.module';
import { CompoundApiModule } from './compound-api/compound-api.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    HealthModule,
    PatentAnalysisModule,
    ConformerModule,
    CompoundApiModule,
  ],
})
export class AppModule {}
