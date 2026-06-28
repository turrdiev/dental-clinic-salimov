import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma.js';
import { requireAuth, requireRole } from '../auth.js';
import { audit } from '../audit.js';
import { notify } from '../notify.js';
import { PROCEDURE_CONFIGS, ProcedureType } from '../../src/types.js';

const router = Router();

const AppointmentSchema = z.object({
  patientId: z.string().min(1, 'Некорректный ID пациента'),
  doctorId: z.string().min(1, 'Некорректный ID врача'),
  procedure: z.string().min(1, 'Процедура обязательна'),
  startTime: z.string().min(1, 'Время начала обязательно'),
  chairId: z.number().int().min(1).max(2),
  notes: z.string().optional(),
  status: z.enum(['Scheduled', 'In_Progress', 'Completed', 'Cancelled']).default('Scheduled'),
  paymentAmount: z.number().optional(),
});

/** Check if a timeslot is free (excluding a specific appointment ID for updates) */
async function checkConflict(
  startTime: Date,
  endTime: Date,
  doctorId: string,
  chairId: number,
  excludeId?: string,
): Promise<{ conflict: boolean; reason?: string }> {
  const overlap = {
    NOT: excludeId ? { id: excludeId } : undefined,
    status: { not: 'Cancelled' as const },
    startTime: { lt: endTime },
    endTime: { gt: startTime },
  };

  const [chairConflict, doctorConflict] = await Promise.all([
    prisma.appointment.findFirst({
      where: { ...overlap, chairId },
      select: { id: true, patientId: true },
    }),
    prisma.appointment.findFirst({
      where: { ...overlap, doctorId },
      select: { id: true, patientId: true, doctorId: true },
    }),
  ]);

  if (chairConflict) {
    const patient = await prisma.patient.findUnique({ where: { id: chairConflict.patientId }, select: { fullName: true } });
    return { conflict: true, reason: `Кресло ${chairId} занято записью пациента "${patient?.fullName}" в это время.` };
  }
  if (doctorConflict) {
    const [patient, doctor] = await Promise.all([
      prisma.patient.findUnique({ where: { id: doctorConflict.patientId }, select: { fullName: true } }),
      prisma.doctor.findUnique({ where: { id: doctorConflict.doctorId }, select: { name: true } }),
    ]);
    return { conflict: true, reason: `${doctor?.name} уже занят записью пациента "${patient?.fullName}" в это время.` };
  }

  return { conflict: false };
}

router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const appointments = await prisma.appointment.findMany({
      orderBy: { startTime: 'desc' },
      take: 1000,
    });
    // Serialize DateTime to ISO string
    res.json(appointments.map(a => ({
      ...a,
      startTime: a.startTime.toISOString(),
      endTime: a.endTime.toISOString(),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })));
  } catch (err) {
    console.error('[appointments/GET]', err);
    res.status(500).json({ error: 'Ошибка загрузки записей' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = AppointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { patientId, doctorId, procedure, startTime: startISO, chairId, notes, status, paymentAmount } = parsed.data;

  const config = PROCEDURE_CONFIGS[procedure as ProcedureType];
  const durationMs = (config ? config.durationHours : 1) * 3600000;
  const startTime = new Date(startISO);
  const endTime = new Date(startTime.getTime() + durationMs);

  const { conflict, reason } = await checkConflict(startTime, endTime, doctorId, chairId);
  if (conflict) {
    res.status(409).json({ error: reason });
    return;
  }

  try {
    const appointment = await prisma.appointment.create({
      data: {
        patientId, doctorId, procedure,
        startTime, endTime,
        chairId,
        status: status as any,
        notes,
        paymentAmount,
      },
      include: { patient: { select: { fullName: true } }, doctor: { select: { name: true } } },
    });

    // Auto-create payment if Completed
    if (status === 'Completed') {
      const amount = paymentAmount ?? (config?.estimatedPrice ?? 5000);
      await prisma.payment.create({
        data: {
          appointmentId: appointment.id,
          patientId, doctorId, procedure,
          amountReceived: amount,
          paymentMethod: 'Card',
          date: startTime.toISOString().split('T')[0],
          notes: 'Автоматически создан при завершении приёма',
        },
      });
    }

    const procLabel = config?.name ?? procedure;
    void notify(
      'Новая запись создана',
      `${req.user?.name} записал(а) пациента ${appointment.patient?.fullName} на "${procLabel}" к ${appointment.doctor?.name}`,
      'success',
    );
    void audit(req.user, 'CREATE_APPOINTMENT', `Запись ${appointment.id}: пациент ${patientId}, врач ${doctorId}`);

    res.status(201).json({
      ...appointment,
      startTime: appointment.startTime.toISOString(),
      endTime: appointment.endTime.toISOString(),
      createdAt: appointment.createdAt.toISOString(),
      updatedAt: appointment.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error('[appointments/POST]', err);
    res.status(500).json({ error: 'Ошибка создания записи' });
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = AppointmentSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const current = await prisma.appointment.findUnique({ where: { id } });
    if (!current) { res.status(404).json({ error: 'Запись не найдена' }); return; }

    const startISO = parsed.data.startTime ?? current.startTime.toISOString();
    const procedure = parsed.data.procedure ?? current.procedure;
    const doctorId = parsed.data.doctorId ?? current.doctorId;
    const chairId = parsed.data.chairId ?? current.chairId;

    const config = PROCEDURE_CONFIGS[procedure as ProcedureType];
    const durationMs = (config ? config.durationHours : 1) * 3600000;
    const startTime = new Date(startISO);
    const endTime = new Date(startTime.getTime() + durationMs);

    const { conflict, reason } = await checkConflict(startTime, endTime, doctorId, chairId, id);
    if (conflict) { res.status(409).json({ error: reason }); return; }

    const prevStatus = current.status;

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        ...parsed.data,
        startTime,
        endTime,
        status: (parsed.data.status ?? current.status) as any,
      },
      include: { patient: { select: { fullName: true } }, doctor: { select: { name: true } } },
    });

    // Sync payment when status changes to Completed
    const newStatus = parsed.data.status ?? current.status;
    if (newStatus === 'Completed') {
      const amount = parsed.data.paymentAmount ?? current.paymentAmount ?? config?.estimatedPrice ?? 5000;
      await prisma.payment.upsert({
        where: { appointmentId: id },
        create: {
          appointmentId: id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          procedure: appointment.procedure,
          amountReceived: amount,
          paymentMethod: 'Card',
          date: startTime.toISOString().split('T')[0],
          notes: 'Автоматически создан при завершении приёма',
        },
        update: { amountReceived: amount },
      });
    }

    if (newStatus === 'Cancelled' && prevStatus !== 'Cancelled') {
      void notify('Запись отменена', `${req.user?.name} отменил(а) приём пациента ${appointment.patient?.fullName}`, 'warning');
    } else {
      void notify('Запись изменена', `${req.user?.name} изменил(а) приём пациента ${appointment.patient?.fullName}`, 'info');
    }

    void audit(req.user, 'UPDATE_APPOINTMENT', `Обновлена запись ${id}`);

    res.json({
      ...appointment,
      startTime: appointment.startTime.toISOString(),
      endTime: appointment.endTime.toISOString(),
      createdAt: appointment.createdAt.toISOString(),
      updatedAt: appointment.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error('[appointments/PUT]', err);
    res.status(500).json({ error: 'Ошибка обновления записи' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const apt = await prisma.appointment.findUnique({
      where: { id },
      include: { patient: { select: { fullName: true } } },
    });
    await prisma.appointment.delete({ where: { id } });
    if (apt) {
      void notify('Запись удалена', `${req.user?.name} удалил(а) запись пациента ${apt.patient?.fullName}`, 'warning');
    }
    void audit(req.user, 'DELETE_APPOINTMENT', `Удалена запись ${id}`);
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Запись не найдена' }); return; }
    console.error('[appointments/DELETE]', err);
    res.status(500).json({ error: 'Ошибка удаления записи' });
  }
});

export default router;
