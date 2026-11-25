import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';

export function connectDatabase(connectionString: string) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 3_000 }),
  });
}
