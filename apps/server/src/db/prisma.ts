import { fileURLToPath } from 'node:url';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __rewarPrisma__: PrismaClient | undefined;
}

const adapter = new PrismaBetterSqlite3({
  url: `file:${fileURLToPath(new URL('../../../../dev.db', import.meta.url))}`,
});

export const prisma = globalThis.__rewarPrisma__ ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__rewarPrisma__ = prisma;
}
