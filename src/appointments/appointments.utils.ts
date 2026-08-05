import { PrismaClientKnownRequestError } from '@prisma/client-runtime-utils';

export const HOLD_TTL_SECONDS = 30;

export function buildHoldKey(slotId: string): string {
  return `hold:${slotId}`;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof PrismaClientKnownRequestError && error.code === 'P2002';
}
