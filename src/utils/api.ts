/**
 * Central API client with JWT auth header injection.
 * Token is stored in localStorage and sent as Bearer token on every request.
 */
import {
  User, Doctor, Patient, Appointment, MedicalRecord,
  AttachmentFile, Payment, ClinicNotification, AuditLog, WorkSession
} from '../types.js';

const TOKEN_KEY = 'dental_jwt';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    clearToken(); // Force re-login
    throw new Error('Сессия истекла. Выполните вход заново.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // ── AUTH ─────────────────────────────────────────────────────────────────────
  async getMe(): Promise<{ user: User | null }> {
    try {
      return await request<{ user: User }>('/api/auth/me');
    } catch {
      return { user: null };
    }
  },

  async login(username: string, password: string): Promise<{ success: boolean; token: string; user: User }> {
    const data = await request<{ success: boolean; token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(data.token);
    return data;
  },

  async logout(): Promise<{ success: boolean }> {
    try {
      const data = await request<{ success: boolean }>('/api/auth/logout', { method: 'POST' });
      clearToken();
      return data;
    } catch {
      clearToken();
      return { success: true };
    }
  },

  // ── DOCTORS ──────────────────────────────────────────────────────────────────
  async getInit(): Promise<any> {
    return request('/api/init');
  },

  async getDoctors(): Promise<Doctor[]> {
    return request('/api/doctors');
  },

  async createDoctor(doctor: Omit<Doctor, 'id' | 'status'>): Promise<Doctor> {
    return request('/api/doctors', { method: 'POST', body: JSON.stringify(doctor) });
  },

  async deleteDoctor(id: string): Promise<{ success: boolean }> {
    return request(`/api/doctors/${id}`, { method: 'DELETE' });
  },

  async updateDoctorSchedule(id: string, workingHours: Record<string, string[]>): Promise<Doctor> {
    return request(`/api/doctors/${id}/schedule`, {
      method: 'PUT',
      body: JSON.stringify({ workingHours }),
    });
  },

  // ── PATIENTS ─────────────────────────────────────────────────────────────────
  async getPatients(): Promise<Patient[]> {
    return request('/api/patients');
  },

  async createPatient(patient: Omit<Patient, 'id' | 'createdAt'>): Promise<Patient> {
    return request('/api/patients', { method: 'POST', body: JSON.stringify(patient) });
  },

  async updatePatient(id: string, patient: Partial<Patient>): Promise<Patient> {
    return request(`/api/patients/${id}`, { method: 'PUT', body: JSON.stringify(patient) });
  },

  async deletePatient(id: string): Promise<{ success: boolean }> {
    return request(`/api/patients/${id}`, { method: 'DELETE' });
  },

  // ── APPOINTMENTS ──────────────────────────────────────────────────────────────
  async getAppointments(): Promise<Appointment[]> {
    return request('/api/appointments');
  },

  async createAppointment(appointment: {
    patientId: string; doctorId: string; procedure: string;
    startTime: string; chairId: number; notes?: string;
    status?: string; paymentAmount?: number;
  }): Promise<Appointment> {
    return request('/api/appointments', { method: 'POST', body: JSON.stringify(appointment) });
  },

  async updateAppointment(id: string, data: {
    patientId?: string; doctorId?: string; procedure?: string;
    startTime?: string; chairId?: number; notes?: string;
    status?: string; paymentAmount?: number;
  }): Promise<Appointment> {
    return request(`/api/appointments/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteAppointment(id: string): Promise<{ success: boolean }> {
    return request(`/api/appointments/${id}`, { method: 'DELETE' });
  },

  // ── MEDICAL RECORDS ───────────────────────────────────────────────────────────
  async getMedicalRecords(): Promise<MedicalRecord[]> {
    return request('/api/medical-records');
  },

  async createMedicalRecord(record: Omit<MedicalRecord, 'id' | 'createdAt'>): Promise<MedicalRecord> {
    return request('/api/medical-records', { method: 'POST', body: JSON.stringify(record) });
  },

  // ── ATTACHMENTS ───────────────────────────────────────────────────────────────
  async getAttachments(): Promise<AttachmentFile[]> {
    return request('/api/attachments');
  },

  async uploadAttachment(
    patientId: string, name: string, size: string, category: string, fileData: string,
  ): Promise<AttachmentFile> {
    return request('/api/attachments', {
      method: 'POST',
      body: JSON.stringify({ patientId, name, size, category, fileData }),
    });
  },

  async deleteAttachment(id: string): Promise<{ success: boolean }> {
    return request(`/api/attachments/${id}`, { method: 'DELETE' });
  },

  async downloadAttachment(id: string): Promise<{ url: string; name: string }> {
    return request(`/api/attachments/${id}/download`);
  },

  // ── PAYMENTS ──────────────────────────────────────────────────────────────────
  async getPayments(): Promise<Payment[]> {
    return request('/api/payments');
  },

  async createPayment(payment: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment> {
    return request('/api/payments', { method: 'POST', body: JSON.stringify(payment) });
  },

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
  async getNotifications(): Promise<ClinicNotification[]> {
    return request('/api/notifications');
  },

  async readAllNotifications(): Promise<{ success: boolean }> {
    return request('/api/notifications/read-all', { method: 'POST' });
  },

  // ── AUDIT LOGS ────────────────────────────────────────────────────────────────
  async getAuditLogs(): Promise<AuditLog[]> {
    return request('/api/audit-logs');
  },

  // ── WORK SESSIONS ─────────────────────────────────────────────────────────────
  async getWorkSessions(): Promise<WorkSession[]> {
    return request('/api/work-sessions');
  },

  async clockIn(location?: { latitude: number; longitude: number; accuracy?: number }): Promise<WorkSession> {
    return request('/api/work-sessions/clock-in', {
      method: 'POST',
      body: JSON.stringify({ location }),
    });
  },

  async clockOut(location?: { latitude: number; longitude: number; accuracy?: number }): Promise<WorkSession> {
    return request('/api/work-sessions/clock-out', {
      method: 'POST',
      body: JSON.stringify({ location }),
    });
  },
};

