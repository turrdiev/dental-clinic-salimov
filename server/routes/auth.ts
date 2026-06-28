import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../prisma.js';
import { signToken, requireAuth } from '../auth.js';
import { audit } from '../audit.js';

const router = Router();

const LoginSchema = z.object({
  username: z.string().min(1, 'Логин обязателен'),
  password: z.string().min(1, 'Пароль обязателен'),
});

// GET /api/auth/me — return current user from JWT
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { username, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      res.status(401).json({ error: 'Неверный логин или пароль' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Неверный логин или пароль' });
      return;
    }

    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role as 'CHIEF_DOCTOR' | 'ADMINISTRATOR' | 'DOCTOR',
      name: user.name,
      email: user.email,
      ...(user.doctorId ? { doctorId: user.doctorId } : {}),
    };

    const token = signToken(payload);

    void audit(payload, 'USER_LOGIN', `Вход в систему: роль ${user.role}`);

    res.json({ success: true, token, user: payload });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

// POST /api/auth/logout — client just discards token, we log it
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  void audit(req.user, 'USER_LOGOUT', 'Выход из системы');
  res.json({ success: true });
});

export default router;
