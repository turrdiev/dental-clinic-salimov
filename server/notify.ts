import prisma from './prisma.js';

export async function notify(
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
): Promise<void> {
  try {
    await prisma.notification.create({ data: { title, message, type } });
  } catch (err) {
    console.error('[notify] Failed to write notification:', err);
  }
}
