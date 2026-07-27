import { createHmac, randomUUID } from 'node:crypto';
import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint, sessionMiddleware } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { decryptOAuthToken, setTokenUtil } from 'better-auth/oauth2';
import { z } from 'zod';
import { prisma } from '../database/prisma.client';
import { authRuntimeConfig, loadVersionedSecrets } from './auth-config';
import {
  validateGroupwareToken,
  type GroupwareIdentity,
} from './groupware-login-check';
import { syncNotificationRecipientForUser } from '../notification-recipient/notification-recipient-sync';

const GROUPWARE_PROVIDER_ID = 'groupware';
const secrets = loadVersionedSecrets();

const emailHash = (email: string): string =>
  createHmac('sha256', secrets[0].value).update(email.toLowerCase()).digest('hex');

const audit = async (data: {
  eventType: string;
  result: 'success' | 'failure';
  errorCode?: string;
  requestId: string;
  actorUserId?: string;
  targetUserId?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> => {
  await prisma.authAuditLog.create({
    data: {
      eventType: data.eventType,
      result: data.result,
      errorCode: data.errorCode,
      requestId: data.requestId,
      actorUserId: data.actorUserId,
      targetUserId: data.targetUserId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: data.email ? { emailHash: emailHash(data.email) } : undefined,
    },
  });
};

export const groupwareSsoPlugin = () => ({
  id: 'groupware-sso',
  schema: {
    account: {
      fields: {
        tokenValidatedAt: { type: 'date', required: false, input: false },
      },
    },
  },
  endpoints: {
    groupwareSession: createAuthEndpoint(
      '/groupware/session',
      { method: 'GET', requireHeaders: true, use: [sessionMiddleware] },
      async (ctx) => {
        const session = ctx.context.session;
        const sessionUser = session.user as typeof session.user & {
          status?: string;
          team?: string | null;
          fullname?: string | null;
        };
        if (sessionUser.status !== 'ACTIVE') {
          await ctx.context.internalAdapter.deleteUserSessions(session.user.id);
          throw new APIError('FORBIDDEN', { code: 'AUTH_USER_INACTIVE' });
        }

        const account = (await ctx.context.internalAdapter.findAccounts(session.user.id))
          .find((candidate) => candidate.providerId === GROUPWARE_PROVIDER_ID);
        if (!account?.accessToken) {
          await ctx.context.internalAdapter.deleteUserSessions(session.user.id);
          throw new APIError('UNAUTHORIZED', { code: 'GROUPWARE_ACCOUNT_NOT_FOUND' });
        }

        const validatedAt = (account as { tokenValidatedAt?: Date | string | null })
          .tokenValidatedAt;
        const needsRevalidation = !sessionUser.team || !sessionUser.fullname ||
          !validatedAt ||
          Date.now() - new Date(validatedAt).getTime() >=
            authRuntimeConfig.revalidateIntervalSeconds * 1000;
        let responseUser = session.user;
        if (needsRevalidation) {
          try {
            const token = await decryptOAuthToken(account.accessToken, ctx.context);
            const identity = await validateGroupwareToken(token);
            if (identity.email !== account.accountId.toLowerCase()) {
              throw new Error('GROUPWARE_ID_CHANGED');
            }
            responseUser = await ctx.context.internalAdapter.updateUser(
              session.user.id,
              {
                name: identity.fullname,
                team: identity.team,
                fullname: identity.fullname,
              } as never,
            );
            await ctx.context.internalAdapter.updateAccount(account.id, {
              tokenValidatedAt: new Date(),
            } as never);
          } catch {
            await ctx.context.internalAdapter.deleteUserSessions(session.user.id);
            throw new APIError('UNAUTHORIZED', { code: 'GROUPWARE_REAUTH_REQUIRED' });
          }
        }
        return ctx.json({ ...session, user: responseUser });
      },
    ),
    groupwareExchange: createAuthEndpoint(
      '/groupware/exchange',
      {
        method: 'POST',
        body: z.object({
          loginToken: z.string().min(1).max(8192),
          expectedEmail: z.string().trim().toLowerCase().max(320).email().optional(),
        }),
      },
      async (ctx) => {
        const requestId = ctx.headers?.get('x-request-id') ?? randomUUID();
        const origin = ctx.headers?.get('origin');
        const ipAddress = ctx.headers?.get('x-forwarded-for')?.split(',')[0]?.trim();
        const userAgent = ctx.headers?.get('user-agent') ?? undefined;

        if (origin && !authRuntimeConfig.trustedOrigins.includes(origin)) {
          throw new APIError('FORBIDDEN', { code: 'AUTH_ORIGIN_REJECTED' });
        }

        let identity: GroupwareIdentity;
        try {
          identity = await validateGroupwareToken(ctx.body.loginToken);
        } catch {
          await audit({
            eventType: 'GROUPWARE_EXCHANGE', result: 'failure',
            errorCode: 'GROUPWARE_LOGIN_INVALID', requestId, ipAddress, userAgent,
          });
          throw new APIError('UNAUTHORIZED', { code: 'GROUPWARE_LOGIN_INVALID' });
        }
        const { email } = identity;

        if (ctx.body.expectedEmail && ctx.body.expectedEmail !== email) {
          await audit({
            eventType: 'GROUPWARE_EXCHANGE', result: 'failure',
            errorCode: 'GROUPWARE_ID_MISMATCH', requestId,
            email, ipAddress, userAgent,
          });
          throw new APIError('UNAUTHORIZED', { code: 'GROUPWARE_ID_MISMATCH' });
        }

        let account = await ctx.context.internalAdapter.findAccountByProviderId(
          email,
          GROUPWARE_PROVIDER_ID,
        );
        let user = account
          ? await ctx.context.internalAdapter.findUserById(account.userId)
          : null;

        if (!account) {
          const emailOwner = await ctx.context.internalAdapter.findUserByEmail(email, {
            includeAccounts: true,
          });
          if (emailOwner) {
            await audit({
              eventType: 'GROUPWARE_EXCHANGE', result: 'failure',
              errorCode: 'AUTH_EMAIL_CONFLICT', requestId,
              targetUserId: emailOwner.user.id, email, ipAddress, userAgent,
            });
            throw new APIError('CONFLICT', {
              code: 'AUTH_EMAIL_CONFLICT',
              message: requestId,
            });
          }

          const role = authRuntimeConfig.bootstrapAdminEmails.has(email) ? 'ADMIN' : 'USER';
          const encryptedToken = await setTokenUtil(ctx.body.loginToken, ctx.context);
          try {
            user = await ctx.context.internalAdapter.createUser({
              email,
              name: identity.fullname,
              team: identity.team,
              fullname: identity.fullname,
              emailVerified: true,
              role,
              status: 'ACTIVE',
            } as never);
          } catch {
            const conflictingUser = await ctx.context.internalAdapter.findUserByEmail(email, {
              includeAccounts: true,
            });
            await audit({
              eventType: 'GROUPWARE_EXCHANGE', result: 'failure',
              errorCode: 'AUTH_EMAIL_CONFLICT', requestId,
              targetUserId: conflictingUser?.user.id, email, ipAddress, userAgent,
            });
            throw new APIError('CONFLICT', {
              code: 'AUTH_EMAIL_CONFLICT',
              message: requestId,
            });
          }
          try {
            account = await ctx.context.internalAdapter.createAccount({
              userId: user.id,
              providerId: GROUPWARE_PROVIDER_ID,
              accountId: email,
              accessToken: encryptedToken,
              tokenValidatedAt: new Date(),
            } as never);
          } catch (error) {
            await ctx.context.internalAdapter.deleteUser(user.id);
            throw error;
          }
          if (role === 'ADMIN') {
            await audit({
              eventType: 'BOOTSTRAP_ADMIN_CREATED', result: 'success', requestId,
              actorUserId: user.id, targetUserId: user.id, email, ipAddress, userAgent,
            });
          }
        } else if (user) {
          if ((user as { status?: string }).status !== 'ACTIVE') {
            await ctx.context.internalAdapter.deleteUserSessions(user.id);
            throw new APIError('FORBIDDEN', { code: 'AUTH_USER_INACTIVE' });
          }
          const encryptedToken = await setTokenUtil(ctx.body.loginToken, ctx.context);
          account = await ctx.context.internalAdapter.updateAccount(account.id, {
            accessToken: encryptedToken,
            tokenValidatedAt: new Date(),
          } as never);
        }

        if (!user || !account) throw new APIError('INTERNAL_SERVER_ERROR');
        if ((user as { status?: string }).status !== 'ACTIVE') {
          await ctx.context.internalAdapter.deleteUserSessions(user.id);
          throw new APIError('FORBIDDEN', { code: 'AUTH_USER_INACTIVE' });
        }
        user = await ctx.context.internalAdapter.updateUser(user.id, {
          name: identity.fullname,
          team: identity.team,
          fullname: identity.fullname,
        } as never);

        try {
          await syncNotificationRecipientForUser(prisma, {
            id: user.id,
            name: user.name,
            email: user.email,
            status: (user as { status?: string }).status,
          });
        } catch {
          await audit({
            eventType: 'NOTIFICATION_RECIPIENT_SYNC',
            result: 'failure',
            errorCode: 'NOTIFICATION_RECIPIENT_SYNC_FAILED',
            requestId,
            actorUserId: user.id,
            targetUserId: user.id,
            email,
            ipAddress,
            userAgent,
          }).catch(() => undefined);
        }

        const createdSession = await ctx.context.internalAdapter.createSession(user.id, false);
        const session = await ctx.context.internalAdapter.findSession(createdSession.token);
        if (!session) throw new APIError('INTERNAL_SERVER_ERROR', { code: 'SESSION_NOT_FOUND' });
        await setSessionCookie(ctx, session);
        await audit({
          eventType: 'GROUPWARE_EXCHANGE', result: 'success', requestId,
          actorUserId: user.id, targetUserId: user.id, email, ipAddress, userAgent,
        });
        return ctx.json({ user: session.user, session: session.session, requestId });
      },
    ),
  },
}) satisfies BetterAuthPlugin;
