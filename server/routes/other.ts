import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma.js';
import { requireAuth, requireRole } from '../auth.js';
import { audit } from '../audit.js';
import { notify } from '../notify.js';

export const medicalRecordsRouter = Router();

const MedicalRecordSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  appointmentId: z.string().min(1).optional(),
  date: z.string().min(1),
  complaints: z.string().default(''),
  symptoms: z.string().default(''),
  diagnosis: z.string().min(1, 'Диагноз обязателен'),
  treatmentPlan: z.string().default(''),
  proceduresPerformed: z.array(z.string()).default([]),
  prescriptions: z.string().default(''),
});

medicalRecordsRouter.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const records = await prisma.medicalRecord.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки медкарт' });
  }
});

medicalRecordsRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = MedicalRecordSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const record = await prisma.medicalRecord.create({ data: parsed.data });
    void audit(req.user, 'CREATE_MEDICAL_RECORD', `Медкарта для пациента ${parsed.data.patientId}`);
    res.status(201).json(record);
  } catch (err) {
    console.error('[medical-records/POST]', err);
    res.status(500).json({ error: 'Ошибка создания медкарты' });
  }
});

// ── ATTACHMENTS ─────────────────────────────────────────────────────────────

export const attachmentsRouter = Router();

const AttachmentSchema = z.object({
  patientId: z.string().min(1),
  name: z.string().min(1),
  size: z.string().default(''),
  category: z.string().default('Photo'),
  fileData: z.string().min(1, 'Данные файла обязательны'),
});

attachmentsRouter.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    // Exclude url (base64 file data) from list — only load when downloading individual file
    const items = await prisma.attachment.findMany({
      orderBy: { uploadDate: 'desc' },
      select: { id: true, patientId: true, name: true, size: true, category: true, uploadDate: true },
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки файлов' });
  }
});

// Download individual file (loads url/base64 only when needed)
attachmentsRouter.get('/:id/download', requireAuth, async (req: Request, res: Response) => {
  try {
    const file = await prisma.attachment.findUnique({
      where: { id: req.params.id },
      select: { url: true, name: true },
    });
    if (!file) { res.status(404).json({ error: 'Файл не найден' }); return; }
    res.json({ url: file.url, name: file.name });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения файла' });
  }
});

attachmentsRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = AttachmentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  const { patientId, name, size, category, fileData } = parsed.data;

  // Block oversized payloads (>8 MB base64)
  if (fileData.length > 11_000_000) {
    res.status(413).json({ error: 'Файл слишком большой (макс. 8 МБ). Используйте внешнее хранилище.' });
    return;
  }

  try {
    const file = await prisma.attachment.create({
      data: { patientId, name, size, category, url: fileData },
    });
    const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { fullName: true } });
    void notify('Файл загружен', `Файл "${name}" (${category}) добавлен к карте ${patient?.fullName}`, 'info');
    void audit(req.user, 'UPLOAD_FILE', `Загружен "${name}" для пациента ${patientId}`);
    res.status(201).json(file);
  } catch (err) {
    console.error('[attachments/POST]', err);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

attachmentsRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    await prisma.attachment.delete({ where: { id: req.params.id } });
    void audit(req.user, 'DELETE_FILE', `Удалён файл ID ${req.params.id}`);
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Файл не найден' }); return; }
    res.status(500).json({ error: 'Ошибка удаления файла' });
  }
});

// ── PAYMENTS ─────────────────────────────────────────────────────────────────

export const paymentsRouter = Router();

const PaymentSchema = z.object({
  appointmentId: z.string().min(1).optional(),
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  procedure: z.string().default('Consultation'),
  amountReceived: z.number().positive('Сумма должна быть положительной'),
  paymentMethod: z.enum(['Cash', 'Card', 'Bank_Transfer', 'Kaspi']).default('Card'),
  date: z.string().min(1),
  notes: z.string().optional(),
});

paymentsRouter.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const payments = await prisma.payment.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки платежей' });
  }
});

paymentsRouter.post('/', requireRole('CHIEF_DOCTOR', 'ADMINISTRATOR'), async (req: Request, res: Response) => {
  const parsed = PaymentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const payment = await prisma.payment.create({ data: parsed.data as any });
    void audit(req.user, 'RECORD_PAYMENT', `Платёж ${parsed.data.amountReceived} тг от пациента ${parsed.data.patientId}`);
    res.status(201).json(payment);
  } catch (err) {
    console.error('[payments/POST]', err);
    res.status(500).json({ error: 'Ошибка записи платежа' });
  }
});

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────

export const notificationsRouter = Router();

notificationsRouter.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const items = await prisma.notification.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки уведомлений' });
  }
});

notificationsRouter.post('/read-all', requireAuth, async (_req: Request, res: Response) => {
  try {
    await prisma.notification.updateMany({ where: { read: false }, data: { read: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обновления уведомлений' });
  }
});

// ── AUDIT LOGS ────────────────────────────────────────────────────────────────

export const auditLogsRouter = Router();

auditLogsRouter.get('/', requireRole('CHIEF_DOCTOR', 'ADMINISTRATOR'), async (req: Request, res: Response) => {
  try {
    const take = Math.min(Number(req.query.limit) || 200, 500);
    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take,
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки аудит-лога' });
  }
});

// ── WORK SESSIONS ─────────────────────────────────────────────────────────────

export const workSessionsRouter = Router();

workSessionsRouter.get('/', requireRole('CHIEF_DOCTOR', 'ADMINISTRATOR'), async (_req: Request, res: Response) => {
  try {
    const sessions = await prisma.workSession.findMany({ orderBy: { clockInTime: 'desc' } });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки рабочих сессий' });
  }
});

const LocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional(),
}).optional();

workSessionsRouter.post('/clock-in', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const location = LocationSchema.safeParse(req.body.location);

  // Check for existing active session
  const active = await prisma.workSession.findFirst({
    where: { userId: user.userId, status: 'active' },
  });
  if (active) {
    res.status(400).json({ error: 'Вы уже отметили начало рабочего дня' });
    return;
  }

  try {
    const loc = location.success ? location.data : undefined;
    const session = await prisma.workSession.create({
      data: {
        userId: user.userId,
        userName: user.name,
        userRole: user.role,
        clockInTime: new Date(),
        clockInLatitude: loc?.latitude,
        clockInLongitude: loc?.longitude,
        clockInAccuracy: loc?.accuracy,
        status: 'active',
      },
    });

    const locText = loc ? `📍 ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}` : '📍 Геоданные отсутствуют';
    void notify(`🟢 Приход: ${user.name}`, `Начало смены. ${locText}`, 'success');
    void audit(user, 'CLOCK_IN', `Начало рабочего дня. ${locText}`);

    res.status(201).json(session);
  } catch (err) {
    console.error('[clock-in]', err);
    res.status(500).json({ error: 'Ошибка регистрации прихода' });
  }
});

workSessionsRouter.post('/clock-out', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const location = LocationSchema.safeParse(req.body.location);

  const active = await prisma.workSession.findFirst({
    where: { userId: user.userId, status: 'active' },
  });
  if (!active) {
    res.status(400).json({ error: 'Нет активного рабочего дня для завершения' });
    return;
  }

  try {
    const loc = location.success ? location.data : undefined;
    const clockOutTime = new Date();
    const session = await prisma.workSession.update({
      where: { id: active.id },
      data: {
        clockOutTime,
        clockOutLatitude: loc?.latitude,
        clockOutLongitude: loc?.longitude,
        clockOutAccuracy: loc?.accuracy,
        status: 'completed',
      },
    });

    const durationMs = clockOutTime.getTime() - active.clockInTime.getTime();
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    const locText = loc ? `📍 ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}` : '📍 Геоданные отсутствуют';

    void notify(`🔴 Уход: ${user.name}`, `Завершение смены. Отработано: ${hours}ч ${minutes}мин. ${locText}`, 'info');
    void audit(user, 'CLOCK_OUT', `Завершение рабочего дня. ${locText}`);

    res.json(session);
  } catch (err) {
    console.error('[clock-out]', err);
    res.status(500).json({ error: 'Ошибка регистрации ухода' });
  }
});
