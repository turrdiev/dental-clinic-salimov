/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'CHIEF_DOCTOR' | 'ADMINISTRATOR' | 'DOCTOR';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
  email: string;
  doctorId?: string; // If role is DOCTOR, references their doctor profile
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  email: string;
  phone: string;
  color: string; // Tailwind or Hex color for calendar
  avatarUrl?: string;
  status: 'active' | 'inactive';
  workingHours?: Record<string, string[]>; // Record of date (YYYY-MM-DD) -> Array of active slot hours (e.g. ['09:00', '10:00'])
}

export interface Patient {
  id: string;
  fullName: string;
  phone: string;
  birthDate: string; // YYYY-MM-DD
  gender: 'Male' | 'Female' | 'Other';
  address: string;
  notes?: string;
  createdAt: string;
}

export type ProcedureType =
  | 'Cleaning'
  | 'Treatment'
  | 'Filling'
  | 'Implantation'
  | 'Scanning'
  | 'Extraction'
  | 'Depulpation'
  | 'Preparation'
  | 'Healing Abutment Installation'
  | 'Consultation'
  | 'Occlusion Analysis';

export interface ProcedureConfig {
  name: ProcedureType;
  durationHours: number;
  estimatedPrice: number;
}

export const PROCEDURE_CONFIGS: Record<ProcedureType, ProcedureConfig> = {
  'Cleaning': { name: 'Cleaning', durationHours: 1, estimatedPrice: 15500 },
  'Treatment': { name: 'Treatment', durationHours: 1, estimatedPrice: 20000 },
  'Filling': { name: 'Filling', durationHours: 1, estimatedPrice: 18000 },
  'Implantation': { name: 'Implantation', durationHours: 2, estimatedPrice: 280000 },
  'Scanning': { name: 'Scanning', durationHours: 1, estimatedPrice: 10000 },
  'Extraction': { name: 'Extraction', durationHours: 1, estimatedPrice: 15000 },
  'Depulpation': { name: 'Depulpation', durationHours: 2, estimatedPrice: 35000 },
  'Preparation': { name: 'Preparation', durationHours: 2, estimatedPrice: 25000 },
  'Healing Abutment Installation': { name: 'Healing Abutment Installation', durationHours: 1, estimatedPrice: 40000 },
  'Consultation': { name: 'Consultation', durationHours: 1, estimatedPrice: 5000 },
  'Occlusion Analysis': { name: 'Occlusion Analysis', durationHours: 1, estimatedPrice: 12000 },
};

export const PROCEDURE_LABELS_RU: Record<ProcedureType, string> = {
  'Cleaning': 'Гигиеническая чистка',
  'Treatment': 'Лечение кариеса',
  'Filling': 'Установка пломбы',
  'Implantation': 'Имплантация зуба',
  'Scanning': '3D сканирование',
  'Extraction': 'Удаление зуба',
  'Depulpation': 'Депульпирование зуба',
  'Preparation': 'Препарирование',
  'Healing Abutment Installation': 'Установка формирователя десны',
  'Consultation': 'Консультация',
  'Occlusion Analysis': 'Анализ окклюзии',
};

export type AppointmentStatus = 'Scheduled' | 'In_Progress' | 'Completed' | 'Cancelled';

export const STATUS_LABELS_RU: Record<AppointmentStatus, string> = {
  'Scheduled': 'Запланирован',
  'In_Progress': 'В процессе',
  'Completed': 'Завершен',
  'Cancelled': 'Отменен',
};

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  procedure: ProcedureType;
  startTime: string; // ISO String (e.g. 2026-05-30T10:00:00ZIn)
  endTime: string; // ISO String
  chairId: 1 | 2; // Only 2 chairs: Chair 1 or Chair 2
  status: AppointmentStatus;
  notes?: string;
  paymentAmount?: number; // Custom billing amount set by doctor
  createdAt: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  appointmentId?: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  complaints: string;
  symptoms: string;
  diagnosis: string;
  treatmentPlan: string;
  proceduresPerformed: string[];
  prescriptions: string;
  createdAt: string;
}

export interface AttachmentFile {
  id: string;
  patientId: string;
  name: string;
  size: string; // formatted e.g. "2.4 MB"
  category: 'X-Ray' | 'CT Scan' | 'Photo' | 'PDF' | 'Report';
  uploadDate: string;
  url?: string; // Base64 — only populated on individual download, not in list view
}

export type PaymentMethod = 'Cash' | 'Card' | 'Bank_Transfer' | 'Kaspi';

export interface Payment {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  procedure: ProcedureType;
  amountReceived: number;
  paymentMethod: PaymentMethod;
  date: string; // YYYY-MM-DD
  notes?: string;
  createdAt: string;
}

export interface ClinicNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface WorkSession {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  clockInTime: string; // ISO string
  clockOutTime?: string; // ISO string
  clockInLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  clockOutLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  status: 'active' | 'completed';
}

