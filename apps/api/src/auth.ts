import { randomUUID } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { anonymous } from 'better-auth/plugins';
import type { connectDatabase } from '@mini-connecta/db';

export function createAuth(
  db: ReturnType<typeof connectDatabase>,
  config: {
    origin: string;
    secret: string;
    googleId?: string;
    googleSecret?: string;
  },
) {
  return betterAuth({
    baseURL: config.origin,
    basePath: '/api/auth',
    secret: config.secret,
    trustedOrigins: [config.origin],
    database: prismaAdapter(db, { provider: 'postgresql' }),
    logger: { disabled: true },
    advanced: {
      useSecureCookies: config.origin.startsWith('https:'),
      defaultCookieAttributes: { path: '/api' },
      database: { generateId: () => randomUUID() },
    },
    socialProviders:
      config.googleId && config.googleSecret
        ? {
            google: { clientId: config.googleId, clientSecret: config.googleSecret },
          }
        : {},
    account: { encryptOAuthTokens: true },
    plugins: [anonymous({ generateName: () => 'Guest' })],
    rateLimit: {
      enabled: true,
      customRules: { '/sign-in/anonymous': { window: 60, max: 20 } },
    },
  });
}
