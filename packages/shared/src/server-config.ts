import { z } from 'zod';

export const secret = z.string().min(32);
export const origin = z.url().refine((value) => new URL(value).origin === value);
export const websocketUrl = z.url({ protocol: /^wss?$/ });
export const httpUrl = z.url({ protocol: /^https?$/ });

export function readConfig<T>(schema: z.ZodType<T>, env: NodeJS.ProcessEnv = process.env): T {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      'Invalid configuration: ' +
        parsed.error.issues.map((issue) => issue.path.join('.')).join(', '),
    );
  }
  return parsed.data;
}

export function logEvent(
  service: string,
  event: string,
  details: Record<string, string | number> = {},
) {
  process.stdout.write(
    JSON.stringify({ time: new Date().toISOString(), service, event, ...details }) + '\n',
  );
}
