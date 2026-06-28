import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

import authRouter from './server/routes/auth.js';
import doctorsRouter from './server/routes/doctors.js';
import patientsRouter from './server/routes/patients.js';
import appointmentsRouter from './server/routes/appointments.js';
import {
  medicalRecordsRouter,
  attachmentsRouter,
  paymentsRouter,
  notificationsRouter,
  auditLogsRouter,
  workSessionsRouter,
} from './server/routes/other.js';
import prisma from './server/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Gzip compression — reduces API response size by ~70%
app.use(compression());

// ── CORS — only allow configured origin ───────────────────────────────────────
const allowedOrigin = process.env.APP_URL || '';
app.use(cors({
  origin: allowedOrigin || false,
  credentials: true,
}));

app.use(express.json({ limit: '12mb' }));

// ── SECURITY HEADERS ──────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none';"
  );
  next();
});

// ── RATE LIMITING ─────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Слишком много попыток входа. Подождите 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { error: 'Слишком много запросов. Подождите немного.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/doctors', doctorsRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/medical-records', medicalRecordsRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/work-sessions', workSessionsRouter);

app.get('/api/init', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) { res.status(401).json({ error: 'Unauthorized' }); return; }
  let userPayload: any;
  try {
    const jwt = await import('jsonwebtoken');
    userPayload = jwt.default.verify(auth.replace('Bearer ', ''), process.env.JWT_SECRET || '');
  } catch { res.status(401).json({ error: 'Unauthorized' }); return; }
  
  const isAdminOrChief = userPayload?.role === 'CHIEF_DOCTOR' || userPayload?.role === 'ADMINISTRATOR';
  
  try {
    // Load all data in parallel — no sequential awaits
    const [
      patients, doctors, appointments, medicalRecords,
      attachments, payments, notifications, auditLogs, workSessions
    ] = await Promise.all([
      prisma.patient.findMany({
        orderBy: { createdAt: 'desc' }, take: 500,
        select: { id: true, fullName: true, phone: true, birthDate: true, gender: true, address: true, notes: true, createdAt: true, updatedAt: true },
      }),
      prisma.doctor.findMany({ orderBy: { name: 'asc' } }),
      prisma.appointment.findMany({ orderBy: { startTime: 'desc' }, take: 1000 }),
      prisma.medicalRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
      // Exclude base64 url — loaded on demand via /api/attachments/:id/download
      prisma.attachment.findMany({
        orderBy: { uploadDate: 'desc' },
        select: { id: true, patientId: true, name: true, size: true, category: true, uploadDate: true },
      }),
      prisma.payment.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
      prisma.notification.findMany({ orderBy: { timestamp: 'desc' }, take: 50 }),
      // Only load audit logs for admins/chief — doctors don't need them
      isAdminOrChief
        ? prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 200 })
        : Promise.resolve([]),
      isAdminOrChief
        ? prisma.workSession.findMany({ orderBy: { clockInTime: 'desc' }, take: 200 })
        : prisma.workSession.findMany({
            where: { userId: userPayload?.userId },
            orderBy: { clockInTime: 'desc' }, take: 50
          }),
    ]);
    
    res.json({
      patients,
      doctors,
      appointments: appointments.map(a => ({
        ...a,
        startTime: a.startTime.toISOString(),
        endTime: a.endTime.toISOString(),
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
      medicalRecords,
      attachments,
      payments,
      notifications,
      auditLogs,
      workSessions,
    });
  } catch (err) {
    console.error('[/api/init]', err);
    res.status(500).json({ error: 'Init failed' });
  }
});

app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ── STATIC FRONTEND ───────────────────────────────────────────────────────────
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath, {
  maxAge: '7d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Hashed assets (vite adds hash to filename) can be cached longer
    if (filePath.match(/\.[0-9a-f]{8}\.(js|css)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dental Clinic running on port ${PORT}`);
});

export default app;

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
