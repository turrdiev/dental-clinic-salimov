import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma.js';
import { requireAuth, requireRole } from '../auth.js';
import { audit } from '../audit.js';

const router = Router();

const PatientSchema = z.object({
  fullName: z.string().min(2, 'ФИО минимум 2 символа'),
  phone: z.string().min(5, 'Телефон обязателен'),
  birthDate: z.string().min(1, 'Дата рождения обязательна'),
  gender: z.enum(['Male', 'Female', 'Other']).default('Female'),
  address: z.string().default(''),
  notes: z.string().optional(),
});

// All authenticated users can read patients
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const where = search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
          ],
        }
      : {};

    const patients = await prisma.patient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500, // safety limit
    });
    res.json(patients);
  } catch (err) {
    console.error('[patients/GET]', err);
    res.status(500).json({ error: 'Ошибка загрузки пациентов' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = PatientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const patient = await prisma.patient.create({ data: parsed.data });
    void audit(req.user, 'CREATE_PATIENT', `Зарегистрирован пациент "${patient.fullName}" (ID: ${patient.id})`);
    res.status(201).json(patient);
  } catch (err) {
    console.error('[patients/POST]', err);
    res.status(500).json({ error: 'Ошибка создания пациента' });
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = PatientSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const patient = await prisma.patient.update({ where: { id }, data: parsed.data });
    void audit(req.user, 'UPDATE_PATIENT', `Обновлены данные пациента "${patient.fullName}" (ID: ${id})`);
    res.json(patient);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Пациент не найден' }); return; }
    console.error('[patients/PUT]', err);
    res.status(500).json({ error: 'Ошибка обновления пациента' });
  }
});

// Only CHIEF_DOCTOR or ADMINISTRATOR can delete patients
router.delete('/:id', requireRole('CHIEF_DOCTOR', 'ADMINISTRATOR'), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.patient.delete({ where: { id } });
    void audit(req.user, 'DELETE_PATIENT', `Удалён пациент ID ${id}`);
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Пациент не найден' }); return; }
    console.error('[patients/DELETE]', err);
    res.status(500).json({ error: 'Ошибка удаления пациента' });
  }
});

export default router;
