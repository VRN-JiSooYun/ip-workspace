import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GroupwareSessionInterceptor } from './groupware-session.interceptor';
import { GroupwareTokenService } from './groupware-token.service';
import { SessionCleanupService } from './session-cleanup.service';

@Global()
@Module({
  providers: [
    GroupwareTokenService,
    SessionCleanupService,
    GroupwareSessionInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: GroupwareSessionInterceptor },
  ],
  exports: [GroupwareTokenService],
})
export class MedichemAuthModule {}
