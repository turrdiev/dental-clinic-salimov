import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '../prisma.js';
import { requireAuth, requireRole } from '../auth.js';
import { audit } from '../audit.js';

const router = Router();

const DoctorSchema = z.object({
  name: z.string().min(2, 'Имя минимум 2 символа'),
  specialty: z.string().min(2, 'Специальность обязательна'),
  email: z.string().email('Некорректный email'),
  phone: z.string().min(5, 'Телефон обязателен'),
  color: z.string().default('teal'),
});

router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const doctors = await prisma.doctor.findMany({ orderBy: { name: 'asc' } });
    res.json(doctors);
  } catch (err) {
    console.error('[doctors/GET]', err);
    res.status(500).json({ error: 'Ошибка загрузки врачей' });
  }
});

router.post('/', requireRole('CHIEF_DOCTOR', 'ADMINISTRATOR'), async (req: Request, res: Response) => {
  const parsed = DoctorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const { name, specialty, email, phone, color } = parsed.data;

    const doctor = await prisma.doctor.create({
      data: { name, specialty, email, phone, color },
    });

    // Auto-create user with a secure random temporary password
    const username = email.split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    let createdUsername: string | null = null;
    await prisma.user.create({
      data: { username, passwordHash, role: 'DOCTOR', name, email, doctorId: doctor.id },
    }).then(() => {
      createdUsername = username;
    }).catch(() => {
      console.warn(`[doctors/POST] Could not create user for ${email}`);
    });

    void audit(req.user, 'CREATE_DOCTOR', `Добавлен врач "${name}" (${specialty})`);

    res.status(201).json({
      ...doctor,
      ...(createdUsername ? { tempCredentials: { username: createdUsername, tempPassword } } : {}),
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Врач с таким email уже существует' });
      return;
    }
    console.error('[doctors/POST]', err);
    res.status(500).json({ error: 'Ошибка создания врача' });
  }
});

router.delete('/:id', requireRole('CHIEF_DOCTOR', 'ADMINISTRATOR'), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.doctor.delete({ where: { id } });
    void audit(req.user, 'DELETE_DOCTOR', `Удалён профиль врача ID ${id}`);
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Врач не найден' }); return; }
    if (err.code === 'P2003') {
      res.status(409).json({ error: 'Нельзя удалить врача с активными записями. Сначала отмените или удалите записи.' });
      return;
    }
    console.error('[doctors/DELETE]', err);
    res.status(500).json({ error: 'Ошибка удаления врача' });
  }
});

router.put('/:id/schedule', requireRole('CHIEF_DOCTOR', 'ADMINISTRATOR'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { workingHours } = req.body;
  if (!workingHours || typeof workingHours !== 'object') {
    res.status(400).json({ error: 'workingHours обязателен' });
    return;
  }
  try {
    const doctor = await prisma.doctor.update({ where: { id }, data: { workingHours } });
    void audit(req.user, 'UPDATE_SCHEDULE', `Обновлено расписание врача ID ${id}`);
    res.json(doctor);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Врач не найден' }); return; }
    console.error('[doctors/schedule]', err);
    res.status(500).json({ error: 'Ошибка обновления расписания' });
  }
});

export default router;
