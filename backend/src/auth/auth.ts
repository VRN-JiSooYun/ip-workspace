import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { prisma } from '../database/prisma.client';
import { authRuntimeConfig, loadVersionedSecrets } from './auth-config';
import { groupwareSsoPlugin } from './groupware-sso.plugin';

export const auth = betterAuth({
  appName: 'Medichem Workspace',
  baseURL: authRuntimeConfig.baseUrl,
  basePath: '/api/auth',
  trustedOrigins: authRuntimeConfig.trustedOrigins,
  secrets: loadVersionedSecrets(),
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  advanced: {
    database: { generateId: 'uuid' },
    cookiePrefix: 'medichem',
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
  account: {
    encryptOAuthTokens: true,
    accountLinking: { enabled: false, disableImplicitLinking: true },
  },
  session: {
    expiresIn: authRuntimeConfig.sessionExpiresIn,
    updateAge: authRuntimeConfig.sessionUpdateAge,
    freshAge: authRuntimeConfig.sessionUpdateAge,
    disableSessionRefresh: false,
    cookieCache: { enabled: false },
  },
  user: {
    additionalFields: {
      role: { type: 'string', required: true, defaultValue: 'USER', input: false },
      status: { type: 'string', required: true, defaultValue: 'ACTIVE', input: false },
      team: { type: 'string', required: false, input: false },
      fullname: { type: 'string', required: false, input: false },
    },
  },
  plugins: [groupwareSsoPlugin()],
});
