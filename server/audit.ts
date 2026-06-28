import prisma from './prisma.js';
import { AuthPayload } from './auth.js';

export async function audit(
  user: AuthPayload | undefined,
  action: string,
  details: string,
): Promise<void> {
  if (!user) return;
  try {
    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        userName: user.name,
        action,
        details,
      },
    });
  } catch (err) {
    // Non-critical — log to stderr but don't fail the request
    console.error('[audit] Failed to write audit log:', err);
  }
}
