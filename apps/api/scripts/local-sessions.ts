import { randomUUID } from 'node:crypto';
import { connectDatabase } from '@mini-connecta/db';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { testUtils } from 'better-auth/plugins';
import { z } from 'zod';

// Run inside the local API container. The test plugin never runs in the HTTP server.
const config = z
  .object({
    APP_ORIGIN: z.literal('http://localhost:8080'),
    DATABASE_URL: z.string().refine((value) => new URL(value).hostname === 'postgres'),
    BETTER_AUTH_SECRET: z.string().min(32),
  })
  .parse(process.env);
const count = z.coerce
  .number()
  .int()
  .min(1)
  .max(60)
  .parse(process.argv[2] ?? 2);
const prefix = z
  .string()
  .regex(/^[a-z0-9-]{1,14}$/)
  .parse(process.argv[3] ?? 'qa');
const db = connectDatabase(config.DATABASE_URL);

try {
  const auth = betterAuth({
    baseURL: config.APP_ORIGIN,
    basePath: '/api/auth',
    secret: config.BETTER_AUTH_SECRET,
    database: prismaAdapter(db, { provider: 'postgresql' }),
    logger: { disabled: true },
    advanced: {
      useSecureCookies: false,
      defaultCookieAttributes: { path: '/api' },
      database: { generateId: () => randomUUID() },
    },
    plugins: [testUtils()],
  });
  const { test } = await auth.$context;
  const fixtures = [];
  for (let i = 1; i <= count; i++) {
    const name = 'Test ' + i;
    const email = prefix + '-' + i + '@fixture.invalid';
    const user =
      (await db.user.findUnique({ where: { email } })) ??
      (await test.saveUser(test.createUser({ email, name })));
    await db.session.deleteMany({ where: { userId: user.id } });
    const login = await test.login({ userId: user.id });
    fixtures.push({
      id: user.id,
      name,
      cookie: login.headers.get('cookie'),
      cookies: login.cookies,
    });
  }
  process.stdout.write(JSON.stringify(fixtures) + '\n');
} finally {
  await db.$disconnect();
}
