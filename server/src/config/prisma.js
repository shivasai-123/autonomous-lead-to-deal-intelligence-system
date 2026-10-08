import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { env } from './environment.js';

let prisma;

/**
 * Get or initialize the Prisma Client singleton instance.
 * Catches connection warnings during Phase 1 if PostgreSQL is not yet configured.
 */
export function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: env.isDevelopment ? ['warn', 'error'] : ['error']
    });
  }
  return prisma;
}

export async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Prisma client disconnected');
  }
}

export default getPrismaClient;
