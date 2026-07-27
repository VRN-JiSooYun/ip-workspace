import {
  CallHandler,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { authRuntimeConfig } from './auth-config';
import { validateGroupwareToken } from './groupware-login-check';
import { GroupwareTokenService } from './groupware-token.service';
import { PrismaService } from '../database/prisma.service';

type AuthenticatedRequest = Request & {
  session?: { user?: { id?: string; status?: string } };
};

@Injectable()
export class GroupwareSessionInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupwareToken: GroupwareTokenService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.path.startsWith('/api/auth') || request.path.startsWith('/health')) {
      return next.handle();
    }
    const userId = request.session?.user?.id;
    if (!userId) return next.handle();

    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        team: true,
        fullname: true,
        accounts: { where: { providerId: 'groupware' }, take: 1 },
      },
    });
    if (!user || user.status !== 'ACTIVE') {
      await this.prisma.client.session.deleteMany({ where: { userId } });
      throw new UnauthorizedException('AUTH_USER_INACTIVE');
    }
    const account = user.accounts[0];
    if (!account) {
      await this.prisma.client.session.deleteMany({ where: { userId } });
      throw new UnauthorizedException('GROUPWARE_ACCOUNT_NOT_FOUND');
    }

    const revalidateAfter = authRuntimeConfig.revalidateIntervalSeconds * 1000;
    if (
      !user.team
      || !user.fullname
      || !account.tokenValidatedAt
      || Date.now() - account.tokenValidatedAt.getTime() >= revalidateAfter
    ) {
      try {
        const token = await this.groupwareToken.decrypt(account.accessToken ?? '');
        const identity = await validateGroupwareToken(token);
        if (identity.email !== account.accountId.toLowerCase()) {
          throw new Error('GROUPWARE_ID_CHANGED');
        }
        await this.prisma.client.$transaction([
          this.prisma.client.user.update({
            where: { id: userId },
            data: {
              name: identity.fullname,
              team: identity.team,
              fullname: identity.fullname,
            },
          }),
          this.prisma.client.account.update({
            where: { id: account.id },
            data: { tokenValidatedAt: new Date() },
          }),
        ]);
      } catch {
        await this.prisma.client.session.deleteMany({ where: { userId } });
        throw new UnauthorizedException('GROUPWARE_REAUTH_REQUIRED');
      }
    }
    return next.handle();
  }
}
