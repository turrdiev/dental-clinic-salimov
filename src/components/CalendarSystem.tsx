/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo, useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  User as UserIcon, 
  Layers, 
  Trash2, 
  Edit3, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  ShieldAlert, 
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  MapPin
} from 'lucide-react';
import { 
  Appointment, 
  Patient, 
  Doctor, 
  ProcedureType, 
  PROCEDURE_CONFIGS, 
  User,
  AppointmentStatus,
  PROCEDURE_LABELS_RU,
  STATUS_LABELS_RU,
  WorkSession
} from '../types.js';
import { api } from '../utils/api.js';

interface CalendarSystemProps {
  currentUser: User | null;
  appointments: Appointment[];
  patients: Patient[];
  doctors: Doctor[];
  onAddAppointment: (appointment: {
    patientId: string;
    doctorId: string;
    procedure: string;
    startTime: string;
    chairId: number;
    notes?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onUpdateAppointment: (id: string, dataset: {
    patientId?: string;
    doctorId?: string;
    procedure?: string;
    startTime?: string;
    chairId?: number;
    notes?: string;
    status?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onDeleteAppointment: (id: string) => void;
  workSessions?: WorkSession[];
}

function CalendarSystemImpl({
  currentUser,
  appointments,
  patients,
  doctors,
  onAddAppointment,
  onUpdateAppointment,
  onDeleteAppointment,
  workSessions = []
}: CalendarSystemProps) {
  
  const isChief = currentUser?.role === 'CHIEF_DOCTOR';
  const doctorId = currentUser?.doctorId;

  // Selected date state. Defaulting to our target workspace date May 30, 2026.
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [currentView, setCurrentView] = useState<'day' | 'week' | 'month'>('day');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);

  const isReadOnlyAppointment = !!(
    editingApt &&
    currentUser?.role === 'DOCTOR' &&
    editingApt.doctorId !== doctorId
  );
  const hidePaymentInfo = false; // All roles can set payment amount
  
  // Appointment Form States
  const [formPatientId, setFormPatientId] = useState('');
  const [formDoctorId, setFormDoctorId] = useState('');
  const [formProcedure, setFormProcedure] = useState<ProcedureType>('Consultation');
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formChairId, setFormChairId] = useState<1 | 2>(1);
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<AppointmentStatus>('Scheduled');
  const [formPaymentAmount, setFormPaymentAmount] = useState<number>(0);
  const [patientSearch, setPatientSearch] = useState('');

  // Interactive Live Validation Feedback
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  // --- Doctor Working Hours Shift Modal state ---
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleDoctorId, setScheduleDoctorId] = useState<string>(() => {
    return doctorId || '';
  });
  const [scheduleDate, setScheduleDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [modalActiveSlots, setModalActiveSlots] = useState<string[]>([]);
  
  // Set default schedule Doctor ID on load to avoid blanks
  useEffect(() => {
    if (!scheduleDoctorId && doctors.length > 0) {
      setScheduleDoctorId(doctorId || doctors[0].id);
    }
  }, [doctors, scheduleDoctorId, doctorId]);

  const currentDoctorConfigObj = useMemo(() => {
    return doctors.find(d => d.id === scheduleDoctorId);
  }, [doctors, scheduleDoctorId]);

  const activeHoursForSelectedDay = useMemo(() => {
    if (!currentDoctorConfigObj) return null;
    return currentDoctorConfigObj.workingHours?.[scheduleDate];
  }, [currentDoctorConfigObj, scheduleDate]);

  // Sync state on load or change of selected date/doctor
  useEffect(() => {
    if (isScheduleModalOpen) {
      if (activeHoursForSelectedDay) {
        setModalActiveSlots(activeHoursForSelectedDay);
      } else {
        // Pre-fill with standard workday hours (09:00 to 18:00 inclusive) as a helpful default
        setModalActiveSlots(['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']);
      }
    }
  }, [isScheduleModalOpen, activeHoursForSelectedDay, scheduleDoctorId, scheduleDate]);

  const handleSaveSchedule = async (selectedActiveSlots: string[]) => {
    if (!scheduleDoctorId) return;
    try {
      const activeDocObj = doctors.find(d => d.id === scheduleDoctorId);
      if (!activeDocObj) return;
      
      const currentWorkingHours = activeDocObj.workingHours || {};
      const updatedWorkingHours = {
        ...currentWorkingHours,
        [scheduleDate]: selectedActiveSlots
      };
      
      // Update schedule on DB
      await api.updateDoctorSchedule(scheduleDoctorId, updatedWorkingHours);
      
      // Mutate local state reference objects immediately
      activeDocObj.workingHours = updatedWorkingHours;
      alert(`Рабочее расписание врача ${activeDocObj.name} на ${scheduleDate} успешно обновлено!`);
      setIsScheduleModalOpen(false);
    } catch (e: any) {
      alert(`Ошибка при сохранении графика: ${e.message}`);
    }
  };

  // Filter based on RBAC rules - all doctors can see busy chairs!
  const filteredAppointments = useMemo(() => {
    return appointments;
  }, [appointments]);

  // CLINICAL TIME SLOTS (8 AM to 9 PM)
  const TIME_SLOTS = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', 
    '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
  ];

  // Map procedures to color classes
  const getProcedureTheme = (procedure: ProcedureType) => {
    switch (procedure) {
      case 'Consultation':
        return 'bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100/60';
      case 'Implantation':
      case 'Extraction':
        return 'bg-rose-50 text-rose-800 border-rose-200/80 hover:bg-rose-100/60';
      case 'Treatment':
      case 'Filling':
      case 'Depulpation':
        return 'bg-teal-50 text-teal-800 border-teal-200/80 hover:bg-teal-100/60';
      case 'Cleaning':
      case 'Scanning':
        return 'bg-sky-50 text-sky-800 border-sky-200/80 hover:bg-sky-100/60';
      case 'Preparation':
      case 'Healing Abutment Installation':
      case 'Occlusion Analysis':
        return 'bg-violet-50 text-violet-800 border-violet-200/80 hover:bg-violet-100/60';
      default:
        return 'bg-slate-50 text-slate-800 border-slate-200/80 hover:bg-slate-100/60';
    }
  };

  // Nav date adjust helpers
  const handlePrevDate = () => {
    const d = new Date(selectedDate);
    if (currentView === 'day') d.setDate(d.getDate() - 1);
    else if (currentView === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDate = () => {
    const d = new Date(selectedDate);
    if (currentView === 'day') d.setDate(d.getDate() + 1);
    else if (currentView === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Live client conflict validation before submitting
  const runLiveCollisionCheck = (
    proc: ProcedureType,
    time: string,
    chair: 1 | 2,
    docId: string,
    excludeId: string | null
  ) => {
    if (!docId || !formPatientId) return;

    const slotHr = parseInt(time.split(':')[0]);
    const duration = PROCEDURE_CONFIGS[proc]?.durationHours || 1;

    // Build proposed start ISO and end ISO
    const proposedStart = new Date(`${selectedDate}T${time}:00Z`).getTime();
    const proposedEnd = proposedStart + duration * 60 * 60 * 1000;

    // Exclude checking if times bounds mismatch active clinical hours
    if (slotHr + duration > 21) {
      setFormErrorMessage(`Примечание: Прием выходит за рамки часов работы клиники (после 21:00).`);
      return;
    }

    // Go over matches
    for (const apt of appointments) {
      if (excludeId && apt.id === excludeId) continue;
      if (apt.status === 'Cancelled') continue;

      const aptStart = new Date(apt.startTime).getTime();
      const aptEnd = new Date(apt.endTime).getTime();

      // Check overlap
      const hasOverlap = proposedStart < aptEnd && proposedEnd > aptStart;

      if (hasOverlap) {
        if (Number(apt.chairId) === Number(chair)) {
          const matchedPat = patients.find(p => p.id === apt.patientId);
          setFormErrorMessage(`Конфликт: Кресло ${chair} уже занято пациентом "${matchedPat?.fullName || 'Пациент'}" в это время.`);
          return;
        }

        if (apt.doctorId === docId) {
          const matchedDoc = doctors.find(d => d.id === docId);
          setFormErrorMessage(`Конфликт: Врач ${matchedDoc?.name || 'Специалист'} уже занят другим приемом в это время.`);
          return;
        }
      }
    }

    // Verify doctor workingHours list compatibility
    const selectedDocObj = doctors.find(d => d.id === docId);
    if (selectedDocObj) {
      if (selectedDocObj.workingHours && selectedDocObj.workingHours[selectedDate]) {
        const activeHours = selectedDocObj.workingHours[selectedDate] || [];
        const startHr = parseInt(time.split(':')[0]);
        const coveredSlots: string[] = [];
        for (let offset = 0; offset < duration; offset++) {
          const hrStr = String(startHr + offset).padStart(2, '0') + ':00';
          coveredSlots.push(hrStr);
        }
        
        const missingSlots = coveredSlots.filter(s => !activeHours.includes(s));
        if (missingSlots.length > 0) {
          setFormErrorMessage(`Внимание: Врач ${selectedDocObj.name} не работает в выбранные часы (${missingSlots.join(', ')} на дату ${selectedDate}).`);
          return;
        }
      }
    }

    setFormErrorMessage(null); // Clean
  };

  // Trigger collision refresh on change
  const triggerSelfConflictValidate = (proc: ProcedureType, time: string, chair: 1 | 2, dId: string) => {
    runLiveCollisionCheck(proc, time, chair, dId, editingApt ? editingApt.id : null);
  };

  // Open scheduler modal
  const handleOpenBookModal = (initialSlot?: string, chair?: 1 | 2) => {
    const isPowerUser = currentUser?.role === 'CHIEF_DOCTOR' || currentUser?.role === 'ADMINISTRATOR';
    const defaultDoc = isPowerUser ? (doctors[0]?.id || '') : (doctorId || '');
    setEditingApt(null);
    setFormPatientId('');
    setFormDoctorId(defaultDoc || doctors[0]?.id || '');
    setFormProcedure('Consultation');
    setFormStartTime(initialSlot || '09:00');
    setFormChairId(chair || 1);
    setFormNotes('');
    setFormStatus('Scheduled');
    setFormPaymentAmount(PROCEDURE_CONFIGS['Consultation']?.estimatedPrice || 0);
    setFormErrorMessage(null);
    setPatientSearch('');
    
    setIsModalOpen(true);
    
    // Quick validate
    setTimeout(() => {
      runLiveCollisionCheck('Consultation', initialSlot || '09:00', chair || 1, defaultDoc, null);
    }, 50);
  };

  // Open editor mode
  const handleOpenEditModal = (apt: Appointment) => {
    setEditingApt(apt);
    setFormPatientId(apt.patientId);
    setFormDoctorId(apt.doctorId || doctors[0]?.id || '');
    setFormProcedure(apt.procedure);
    
    // Get hour HH:MM
    const startDate = new Date(apt.startTime);
    const minStr = String(startDate.getUTCMinutes()).padStart(2, '0');
    const hrStr = String(startDate.getUTCHours()).padStart(2, '0');
    setFormStartTime(`${hrStr}:${minStr}`);
    
    setFormChairId(apt.chairId);
    setFormNotes(apt.notes || '');
    setFormStatus(apt.status);
    setFormPaymentAmount(apt.paymentAmount || PROCEDURE_CONFIGS[apt.procedure]?.estimatedPrice || 0);
    setFormErrorMessage(null);

    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const resolvedDoctorId = formDoctorId || currentUser?.doctorId || doctors[0]?.id || "";
    if (!formPatientId || !resolvedDoctorId) {
      setFormErrorMessage("Заполните форму: выберите пациента и врача.");
      return;
    }

    // Compose start timestamp in UTC ISO
    const startISO = new Date(`${selectedDate}T${formStartTime}:00Z`).toISOString();

    const payload = {
      patientId: formPatientId,
      doctorId: resolvedDoctorId,
      procedure: formProcedure,
      startTime: startISO,
      chairId: Number(formChairId),
      notes: formNotes,
      status: formStatus,
      paymentAmount: Number(formPaymentAmount)
    };

    if (editingApt) {
      // Edit
      const result = await onUpdateAppointment(editingApt.id, payload);
      if (result.success) {
        setIsModalOpen(false);
      } else {
        setFormErrorMessage(result.error || 'Server error modifying slot.');
      }
    } else {
      // Create
      const result = await onAddAppointment(payload);
      if (result.success) {
        setIsModalOpen(false);
      } else {
        setFormErrorMessage(result.error || 'Conflict error reserving slot.');
      }
    }
  };

  const handleDeleteApt = (id: string) => {
    if (confirm('Удалить этот прием из расписания навсегда?')) {
      onDeleteAppointment(id);
      setIsModalOpen(false);
    }
  };

  // Day calculations: Organize active items by slot hour and Chair 1/2
  const dayGridData = useMemo(() => {
    // Dictionary representing each slot
    const grid: Record<string, { chair1: Appointment | null; chair2: Appointment | null }> = {};
    TIME_SLOTS.forEach(slot => {
      grid[slot] = { chair1: null, chair2: null };
    });

    filteredAppointments.forEach(apt => {
      if (!apt.startTime.startsWith(selectedDate)) return;
      if (apt.status === 'Cancelled') return;

      const aptDate = new Date(apt.startTime);
      const startHr = String(aptDate.getUTCHours()).padStart(2, '0');
      const startSlot = `${startHr}:00`;

      // Assign to slots
      TIME_SLOTS.forEach(slot => {
        const slotHour = parseInt(slot.split(':')[0]);
        const startHourInt = parseInt(startHr);
        const duration = PROCEDURE_CONFIGS[apt.procedure]?.durationHours || 1;

        if (slotHour >= startHourInt && slotHour < startHourInt + duration) {
          if (Number(apt.chairId) === 1) {
            grid[slot].chair1 = apt;
          } else if (Number(apt.chairId) === 2) {
            grid[slot].chair2 = apt;
          }
        }
      });
    });

    return grid;
  }, [filteredAppointments, selectedDate]);

  // Week Grid Calculations
  const weekDays = useMemo(() => {
    const base = new Date(selectedDate);
    const dayOfWeek = base.getDay(); // 0 is Sun, 1 is Mon
    const startOfWeek = new Date(base);
    // Align to Monday
    const diff = base.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const days = [];
    for (let i = 0; i < 6; i++) { // Mon to Sat
      const nextDay = new Date(startOfWeek);
      nextDay.setDate(startOfWeek.getDate() + i);
      days.push(nextDay.toISOString().split('T')[0]);
    }
    return days;
  }, [selectedDate]);

  // Month Calendar Days Calculations
  const monthGridData = useMemo(() => {
    const base = new Date(selectedDate);
    const yr = base.getFullYear();
    const mo = base.getMonth();
    
    const firstDay = new Date(yr, mo, 1);
    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon aligned
    
    const lastDay = new Date(yr, mo + 1, 0);
    const daysInMonth = lastDay.getDate();

    const days = [];
    // Pad previous month slots
    for (let i = startOffset; i > 0; i--) {
      const prev = new Date(yr, mo, 1 - i);
      days.push({ date: prev.toISOString().split('T')[0], isCurrentMonth: false });
    }
    // Current month slots
    for (let i = 1; i <= daysInMonth; i++) {
      const curr = new Date(yr, mo, i);
      days.push({ date: curr.toISOString().split('T')[0], isCurrentMonth: true });
    }
    return days;
  }, [selectedDate]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Calendar System Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/75 backdrop-blur-md p-5 border border-slate-100 rounded-3xl shadow-xs">
        
        {/* Date Selector navigation */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-3">
          <button
            onClick={handlePrevDate}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 cursor-pointer shadow-3xs transition-all hover:scale-105 active:scale-95"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
          </button>
          
          <div className="text-center min-w-28 xs:min-w-36 sm:min-w-40 px-1 sm:px-2">
            <span className="text-xs sm:text-sm font-bold text-slate-900 block tracking-tight font-display">
              {new Date(selectedDate).toLocaleDateString('ru-RU', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
            <span className="text-[9px] sm:text-[10px] text-teal-600 font-extrabold uppercase tracking-widest font-mono mt-0.5 block">
              {new Date(selectedDate).toLocaleDateString('ru-RU', { weekday: 'long' })}
            </span>
          </div>

          <button
            onClick={handleNextDate}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 cursor-pointer shadow-3xs transition-all hover:scale-105 active:scale-95"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
          </button>

          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="text-[9px] sm:text-[10px] bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-100/50 px-2 py-2 sm:px-3 sm:py-2.5 rounded-xl font-bold cursor-pointer ml-1 sm:ml-2 transition-all active:scale-95 shadow-3xs"
          >
            Сегодня (30 мая)
          </button>
        </div>

        {/* View Toggles */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/40">
          {(['day', 'week', 'month'] as const).map(viewType => (
            <button
              key={viewType}
              onClick={() => setCurrentView(viewType)}
              className={`px-4 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                currentView === viewType
                  ? 'bg-white text-teal-750 shadow-sm border border-slate-100'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
              }`}
            >
              {viewType === 'day' ? 'День' : viewType === 'week' ? 'Неделя' : 'Месяц'}
            </button>
          ))}
        </div>

        {/* Dynamic Booking Trigger Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold shadow-3xs border border-slate-200 flex items-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5"
            title="Управление рабочим графиком"
          >
            <Clock className="w-4 h-4 shrink-0 text-amber-500" />
            <span>Настроить график</span>
          </button>
          
          <button
            onClick={() => handleOpenBookModal('09:00', 1)}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-teal-600/10 flex items-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 shrink-0 text-white" />
            <span>Добавить прием</span>
          </button>
        </div>

      </div>

      {/* 0. ACTIVE DIRECTORY SHIFTS DOTBOARD MONITOR */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h4 className="text-xs font-bold tracking-wider uppercase font-display text-white">Монитор дежурств: {new Date(selectedDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</h4>
          </div>
          <span className="text-[10px] text-slate-400 font-sans">
            Перечеркнутые часы - врач в отпуске/перерыве. Обычные - врач работает.
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
          {doctors.map(doc => {
            const dayHours = doc.workingHours?.[selectedDate] || ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
            
            return (
              <div key={doc.id} className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 flex flex-col justify-between gap-3.5 transition-all hover:border-slate-700">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: doc.color === 'rose' ? '#f43f5e' : doc.color === 'sky' ? '#0ea5e9' : doc.color === 'emerald' ? '#10b981' : doc.color === 'indigo' ? '#6366f1' : doc.color === 'violet' ? '#8b5cf6' : doc.color === 'amber' ? '#f59e0b' : '#14b8a6' }} />
                      <span className="text-[12px] font-bold text-slate-100 truncate">{doc.name}</span>
                    </div>
                    
                    {/* Live Clock-In Status */}
                    {(() => {
                      const docSession = workSessions.find(s => {
                        const sName = s.userName.toLowerCase();
                        const dName = doc.name.toLowerCase();
                        return sName.includes(dName) || dName.includes(sName) || dName.replace('д-р ', '').includes(sName);
                      });

                      if (!docSession) {
                        return <p className="text-[10px] text-slate-500 mt-1 font-medium">Нет отметок сегодня</p>;
                      }

                      const checkInTime = new Date(docSession.clockInTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

                      if (docSession.status === 'active') {
                        return (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[9px] font-bold tracking-tight border border-emerald-500/20">
                              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse mr-1"></span>
                              НА РАБОТЕ c {checkInTime}
                            </span>
                            {docSession.clockInLocation && (
                              <a
                                href={`https://www.google.com/maps?q=${docSession.clockInLocation.latitude},${docSession.clockInLocation.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Показать точку прихода на Google Maps"
                                className="p-1 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 rounded-md transition-colors"
                              >
                                <MapPin className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        );
                      } else {
                        const checkOutTime = docSession.clockOutTime ? new Date(docSession.clockOutTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
                        return (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-500/15 text-slate-400 text-[9px] font-bold tracking-tight">
                              Смена закончена ({checkInTime} - {checkOutTime})
                            </span>
                            {docSession.clockOutLocation && (
                              <a
                                href={`https://www.google.com/maps?q=${docSession.clockOutLocation.latitude},${docSession.clockOutLocation.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Показать точку ухода на Google Maps"
                                className="p-1 bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 rounded-md transition-colors"
                              >
                                <MapPin className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        );
                      }
                    })()}
                  </div>
                  <span className="text-[8.5px] text-slate-400 font-extrabold px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded capitalize shrink-0">{doc.color}</span>
                </div>
                
                <div className="flex flex-wrap gap-1 border-t border-slate-900 pt-2">
                  {TIME_SLOTS.map(hour => {
                    const isWorking = dayHours.includes(hour);
                    return (
                      <span
                        key={hour}
                        title={`${doc.name} на ${hour}: ${isWorking ? 'Принимает' : 'Не принимает'}`}
                        className={`text-[8.5px] font-bold font-mono px-1.5 py-0.5 rounded select-none transition-all ${
                          isWorking 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' 
                            : 'bg-slate-900/60 text-slate-600 border border-slate-900 line-through decoration-slate-700/60'
                        }`}
                      >
                        {hour.split(':')[0]}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

         {/* 1. DAY VIEW: SIDE-BY-SIDE CHAIR DECK CHANNELS */}
      {currentView === 'day' && (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-12 border-b border-slate-100 pb-3 text-center mb-4 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
            <div className="col-span-2 text-left pl-2">Время приема</div>
            <div className="col-span-5 border-l border-slate-100 bg-teal-500/5 py-1 text-teal-700 rounded-t-lg">
              Стоматологическое кресло 1
            </div>
            <div className="col-span-5 border-l border-slate-100 bg-indigo-500/5 py-1 text-indigo-700 rounded-t-lg">
              Стоматологическое кресло 2
            </div>
          </div>

          <div className="space-y-2 relative">
            {TIME_SLOTS.map(slot => {
              const row = dayGridData[slot] || { chair1: null, chair2: null };
              
              return (
                <div key={slot} className="grid grid-cols-12 items-stretch min-h-14 py-0.5 group">
                  {/* Slot Label column */}
                  <div className="col-span-2 flex items-center justify-between text-xs text-slate-400 font-mono pr-4">
                    <span className="font-semibold text-slate-600 block">{slot}</span>
                    <span className="text-[10px] text-slate-300">--</span>
                  </div>

                  {/* CHAIR 1 Column block */}
                  <div className="col-span-5 px-1 relative flex">
                    {row.chair1 ? (
                      // Only render fully if this slot is the START block of the continuous block
                      new Date(row.chair1.startTime).getUTCHours() === parseInt(slot.split(':')[0]) ? (
                        <div
                          onClick={() => handleOpenEditModal(row.chair1!)}
                          className={`w-full p-2.5 rounded-xl border text-xs flex flex-col justify-between cursor-pointer transition-all duration-150 relative h-full select-none ${getProcedureTheme(row.chair1.procedure)}`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <p className="font-bold text-slate-800 truncate">
                                {patients.find(p => p.id === row.chair1!.patientId)?.fullName || 'Консультация'}
                              </p>
                              <span className="text-[9px] font-bold tracking-tight bg-white px-1 rounded truncate">
                                {STATUS_LABELS_RU[row.chair1.status] || row.chair1.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" /> {PROCEDURE_LABELS_RU[row.chair1.procedure] || row.chair1.procedure}
                            </p>
                          </div>
                          
                          <div className="flex items-center justify-between mt-1 text-[9px] text-slate-400 pt-1 border-t border-slate-100/50">
                            <span className="truncate">{doctors.find(d => d.id === row.chair1!.doctorId)?.name || 'Дантист'}</span>
                            <span className="font-bold shrink-0 text-slate-500">
                              {(PROCEDURE_CONFIGS[row.chair1.procedure]?.durationHours || 1)} ч.
                            </span>
                          </div>
                        </div>
                      ) : (
                        // Render spacer placeholder to keep grid aligned for multihour actions
                        <div className="w-full h-full bg-slate-50/10 border-l-2 border-slate-200/20 text-[10px] p-2 text-slate-300 text-center select-none flex items-center justify-center">
                          (Кресло 1 занято)
                        </div>
                      )
                    ) : (
                      // Free cell block
                      <button
                        onClick={() => handleOpenBookModal(slot, 1)}
                        className="w-full text-left p-2 rounded-xl text-[10px] text-slate-300 border border-dashed border-slate-100 hover:border-teal-300 hover:bg-teal-50/10 hover:text-teal-600 transition-all font-semibold flex items-center gap-1 cursor-pointer justify-center h-full sm:justify-start"
                      >
                        <Plus className="w-3.5 h-3.5" /> Занять Кресло 1
                      </button>
                    )}
                  </div>

                  {/* CHAIR 2 Column block */}
                  <div className="col-span-5 px-1 relative flex">
                    {row.chair2 ? (
                      new Date(row.chair2.startTime).getUTCHours() === parseInt(slot.split(':')[0]) ? (
                        <div
                          onClick={() => handleOpenEditModal(row.chair2!)}
                          className={`w-full p-2.5 rounded-xl border text-xs flex flex-col justify-between cursor-pointer transition-all duration-150 relative h-full select-none ${getProcedureTheme(row.chair2.procedure)}`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <p className="font-bold text-slate-800 truncate">
                                {patients.find(p => p.id === row.chair2!.patientId)?.fullName || 'Консультация'}
                              </p>
                              <span className="text-[9px] font-bold tracking-tight bg-white px-1 rounded truncate">
                                {STATUS_LABELS_RU[row.chair2.status] || row.chair2.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" /> {PROCEDURE_LABELS_RU[row.chair2.procedure] || row.chair2.procedure}
                            </p>
                          </div>
                          
                          <div className="flex items-center justify-between mt-1 text-[9px] text-slate-400 pt-1 border-t border-slate-100/50">
                            <span className="truncate">{doctors.find(d => d.id === row.chair2!.doctorId)?.name || 'Дантист'}</span>
                            <span className="font-bold shrink-0 text-slate-500">
                              {(PROCEDURE_CONFIGS[row.chair2.procedure]?.durationHours || 1)} ч.
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full bg-slate-50/10 border-l-2 border-slate-200/20 text-[10px] p-2 text-slate-300 text-center select-none flex items-center justify-center">
                          (Кресло 2 занято)
                        </div>
                      )
                    ) : (
                      <button
                        onClick={() => handleOpenBookModal(slot, 2)}
                        className="w-full text-left p-2 rounded-xl text-[10px] text-slate-300 border border-dashed border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/10 hover:text-indigo-600 transition-all font-semibold flex items-center gap-1 cursor-pointer justify-center h-full sm:justify-start"
                      >
                        <Plus className="w-3.5 h-3.5" /> Занять Кресло 2
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* 2. WEEK VIEW: COLUMNS BY WEEKDAYS Mon-Sat */}
      {currentView === 'week' && (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs overflow-x-auto">
          <div className="grid grid-cols-6 min-w-[720px] gap-2">
            {weekDays.map(dayStr => {
              const dayIndex = new Date(dayStr).getDay();
              const weekdayLetters = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][dayIndex];
              const isTodayStyle = dayStr === new Date().toISOString().split('T')[0];
              const dayAppointments = filteredAppointments.filter(a => a.startTime.startsWith(dayStr) && a.status !== 'Cancelled');
              
              return (
                <div key={dayStr} className={`rounded-xl p-3 border flex flex-col min-h-96 ${
                  isTodayStyle ? 'bg-teal-50/20 border-teal-200' : 'bg-slate-50/30 border-slate-100'
                }`}>
                  <div className="border-b border-wrap-line pb-2 mb-3 text-center">
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${
                      isTodayStyle ? 'text-teal-600' : 'text-slate-400'
                    }`}>
                      {weekdayLetters}
                    </p>
                    <p className="text-[11px] font-bold text-slate-700">{dayStr.split('-')[2]}</p>
                  </div>

                  <div className="flex-1 space-y-2">
                    {dayAppointments.length === 0 ? (
                      <div className="h-full flex items-center justify-center py-16 text-center">
                        <span className="text-[10px] text-slate-300 font-medium font-sans">Нет записей</span>
                      </div>
                    ) : (
                      dayAppointments.map(apt => {
                        const pat = patients.find(p => p.id === apt.patientId);
                        const hrStr = new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div
                            key={apt.id}
                            onClick={() => handleOpenEditModal(apt)}
                            className={`p-2 rounded-lg border text-[10px] cursor-pointer transition-all duration-150 ${getProcedureTheme(apt.procedure)}`}
                          >
                            <p className="font-bold text-slate-800 truncate">{pat?.fullName || 'Пациент'}</p>
                            <p className="font-mono text-[9px] mt-0.5 text-slate-500">
                              {hrStr}
                            </p>
                            <span className="text-[8px] font-mono select-none uppercase tracking-wider block text-right mt-1 font-bold text-slate-400">
                              Кр. {apt.chairId}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. MONTH VIEW: GRID OF DAYS */}
      {currentView === 'month' && (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs overflow-x-auto">
          <div className="min-w-[480px]">
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider gap-1.5 mb-2">
              <div>Пн</div>
              <div>Вт</div>
              <div>Ср</div>
              <div>Чт</div>
              <div>Пт</div>
              <div>Сб</div>
              <div>Вс</div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {monthGridData.map((cell, idx) => {
                const dayStr = cell.date;
                const hasApts = filteredAppointments.filter(a => a.startTime.startsWith(dayStr) && a.status !== 'Cancelled');
                const isSelectedStyle = dayStr === selectedDate;
                const isTodayValue = dayStr === new Date().toISOString().split('T')[0];
                
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedDate(dayStr);
                      setCurrentView('day');
                    }}
                    className={`min-h-16 p-2 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelectedStyle ? 'border-teal-500 ring-1 ring-teal-500' :
                      isTodayValue ? 'bg-teal-50/30 border-teal-100' :
                      cell.isCurrentMonth ? 'bg-white border-slate-100 hover:bg-slate-50' :
                      'bg-slate-50/50 border-slate-50 text-slate-300 hover:bg-slate-50/80'
                    }`}
                  >
                    <span className={`text-[10px] font-bold ${isTodayValue ? 'text-teal-600' : 'text-slate-600'}`}>
                      {dayStr.split('-')[2]}
                    </span>

                    {hasApts.length > 0 && (
                      <div className="flex gap-0.5 items-center justify-end w-full select-none">
                        <span className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                        {hasApts.map((a, aIdx) => (
                          <span 
                             key={a.id} 
                             className={`w-1 h-3 rounded-xs ${
                              Number(a.chairId) === 1 ? 'bg-teal-400' : 'bg-indigo-400'
                            }`} 
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- ADD/EDIT APPOINTMENT BACKEND MODAL FORM --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleFormSubmit}
            className="bg-white rounded-3xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
          >
            
            {/* Modal Title */}
            <div className="p-6 pb-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-600" />
                <h3 className="text-sm font-semibold text-slate-800 tracking-tight font-display">
                  {editingApt ? 'Редактирование / Перенос приема' : 'Запись на прием к стоматологу'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer hover:underline"
              >
                Закрыть
              </button>
            </div>

            {/* Modal inputs container */}
            <div className="p-6 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto">
              
              {isReadOnlyAppointment && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-[11px] font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Прием другого врача. Режим просмотра. Раздел стоимости скрыт.</span>
                </div>
              )}

              {/* Patient Selection with search */}
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Клиент / Пациент *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => { setPatientSearch(e.target.value); setFormPatientId(''); }}
                    onFocus={(e) => { if (!patientSearch) setPatientSearch(' '); }}
                    onBlur={() => setTimeout(() => { if (!formPatientId) setPatientSearch(''); }, 150)}
                    placeholder={formPatientId ? patients.find(p => p.id === formPatientId)?.fullName || 'Поиск...' : '🔍 Начните вводить имя или телефон...'}
                    className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-teal-500 focus:bg-white pr-8"
                    disabled={isReadOnlyAppointment}
                  />
                  {formPatientId && !patientSearch && (
                    <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                      <svg className="w-3.5 h-3.5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </div>
                  )}
                </div>
                {patientSearch && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-lg overflow-hidden">
                    {patients
                      .filter(p => !patientSearch.trim() || p.fullName.toLowerCase().includes(patientSearch.toLowerCase()) || p.phone.includes(patientSearch))
                      .slice(0, 6)
                      .map(p => (
                        <div
                          key={p.id}
                          onClick={() => { setFormPatientId(p.id); setPatientSearch(''); triggerSelfConflictValidate(formProcedure, formStartTime, formChairId, formDoctorId); }}
                          className="px-3 py-2.5 text-xs text-slate-700 hover:bg-teal-50 hover:text-teal-700 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0"
                        >
                          <span className="font-semibold">{p.fullName}</span>
                          <span className="text-slate-400 font-mono">{p.phone}</span>
                        </div>
                      ))}
                    {patients.filter(p => p.fullName.toLowerCase().includes(patientSearch.toLowerCase()) || p.phone.includes(patientSearch)).length === 0 && (
                      <div className="px-3 py-2.5 text-xs text-slate-400 text-center">Пациент не найден</div>
                    )}
                  </div>
                )}
                <input type="hidden" value={formPatientId} required />
              </div>

              {/* Doctor / Specialist selection */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Лечащий врач *</label>
                <select
                  value={formDoctorId}
                  onChange={(e) => {
                    setFormDoctorId(e.target.value);
                    triggerSelfConflictValidate(formProcedure, formStartTime, formChairId, e.target.value);
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-teal-500 focus:bg-white cursor-pointer"
                  required
                  disabled={currentUser?.role === 'DOCTOR' && !!currentUser?.doctorId}
                >
                  <option value="" disabled>-- Назначьте стоматолога --</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.specialty === 'General Dentist' ? 'Терапевт' : d.specialty === 'Orthodontist' ? 'Ортодонт' : d.specialty === 'Surgeon' ? 'Хирург' : d.specialty})</option>
                  ))}
                </select>
                {currentUser?.role === 'DOCTOR' && (
                  <p className="text-[9px] text-slate-400 mt-1 italic">Примечание: Проводящий врач заблокирован в соответствии с текущей сессией.</p>
                )}
              </div>

              {/* Procedure & Chair info selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Процедура *</label>
                  <select
                    value={formProcedure}
                    onChange={(e) => {
                      const proc = e.target.value as ProcedureType;
                      setFormProcedure(proc);
                      if (true) {
                        setFormPaymentAmount(PROCEDURE_CONFIGS[proc]?.estimatedPrice || 0);
                      }
                      triggerSelfConflictValidate(proc, formStartTime, formChairId, formDoctorId);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-teal-500 focus:bg-white cursor-pointer"
                    disabled={isReadOnlyAppointment}
                  >
                    {Object.keys(PROCEDURE_CONFIGS).map(k => (
                      <option key={k} value={k}>{PROCEDURE_LABELS_RU[k as ProcedureType] || k}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Стоматологическое кресло *</label>
                  <select
                    value={formChairId}
                    onChange={(e) => {
                      const chair = Number(e.target.value) as 1 | 2;
                      setFormChairId(chair);
                      triggerSelfConflictValidate(formProcedure, formStartTime, chair, formDoctorId);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-teal-500 focus:bg-white cursor-pointer"
                    disabled={isReadOnlyAppointment}
                  >
                    <option value={1}>Стоматологическое кресло 1</option>
                    <option value={2}>Стоматологическое кресло 2</option>
                  </select>
                </div>
              </div>

              {/* Date & Start times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Дата приема</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setTimeout(() => triggerSelfConflictValidate(formProcedure, formStartTime, formChairId, formDoctorId), 50);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-teal-500 focus:bg-white cursor-text"
                    disabled={isReadOnlyAppointment}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Время начала</label>
                  <select
                    value={formStartTime}
                    onChange={(e) => {
                      setFormStartTime(e.target.value);
                      triggerSelfConflictValidate(formProcedure, e.target.value, formChairId, formDoctorId);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-teal-500 focus:bg-white cursor-pointer font-mono font-semibold"
                    disabled={isReadOnlyAppointment}
                  >
                    {TIME_SLOTS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment Amount of the Appointment */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Стоимость приема (₸) *</label>
                {(!isReadOnlyAppointment && !hidePaymentInfo) ? (
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-slate-400 text-xs font-bold">₸</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={formPaymentAmount === 0 ? '' : formPaymentAmount}
                      onChange={(e) => setFormPaymentAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                      onFocus={(e) => { if (formPaymentAmount === 0) e.target.select(); }}
                      placeholder="Введите стоимость лечения..."
                      className="w-full pl-7 p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 font-bold focus:outline-hidden focus:border-teal-500 focus:bg-white transition-all cursor-text text-teal-700 font-mono"
                      required
                    />
                  </div>
                ) : (
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-400 italic font-mono">
                    ₸ ******* (Скрыто)
                  </div>
                )}
                {!isReadOnlyAppointment && (
                  <p className="text-[9px] text-slate-400 mt-1">
                    Примечание: Изменение этой суммы зафиксирует новую цену в финансовой отчетности лечащего врача.
                  </p>
                )}
              </div>

              {/* Status Select (If editing) */}
              {editingApt && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Текущий клинический статус</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as AppointmentStatus)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-teal-500"
                    disabled={isReadOnlyAppointment}
                  >
                    <option value="Scheduled">Запланирован</option>
                    <option value="In_Progress">В процессе</option>
                    <option value="Completed">Завершен</option>
                    <option value="Cancelled">Отменен</option>
                  </select>
                </div>
              )}

              {/* Notes text */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Клинические примечания / Жалобы</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="например, чувствительность зуба #14, аллергия на анестезию, прием медикаментов..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-teal-500 focus:bg-white cursor-text min-h-16"
                  disabled={isReadOnlyAppointment}
                />
              </div>

              {/* Duration calculation live badge */}
              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="text-teal-600 w-4 h-4" />
                  <div>
                    <p className="text-[11px] font-bold text-slate-700">Оптимизация длительности</p>
                    <p className="text-[10px] text-slate-500">Продолжительность сеанса рассчитана на основе типа лечения.</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-800 font-bold font-mono text-xs rounded-lg shadow-2xs">
                    {(PROCEDURE_CONFIGS[formProcedure]?.durationHours || 1)} ч.
                  </span>
                </div>
              </div>

              {/* LIVE CONFLICT WARNING BOX DESIGN */}
              {formErrorMessage ? (
                <div className="p-3 bg-red-50 border border-red-150 rounded-2xl flex items-start gap-2 text-xs text-red-800 font-medium animate-shake">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p>{formErrorMessage}</p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-2 text-xs text-emerald-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p>Доступно для записи: время свободно, конфликты в расписании отсутствуют!</p>
                </div>
              )}

            </div>

            {/* Modal Actions */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div>
                {editingApt && !isReadOnlyAppointment && (
                  <button
                    type="button"
                    onClick={() => handleDeleteApt(editingApt.id)}
                    className="text-xs text-red-500 font-semibold hover:text-red-700 p-2 hover:bg-red-50 border border-dashed border-red-100 rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Удалить запись
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-655 rounded-xl cursor-pointer"
                >
                  Отмена
                </button>
                
                {!isReadOnlyAppointment && (
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm active:scale-95"
                  >
                    {editingApt ? 'Сохранить изменения' : 'Подтвердить запись'}
                  </button>
                )}
              </div>
            </div>

          </form>
        </div>
      )}

      {/* --- DOCTOR SHIFT WORKHOURS CUSTOM SETTINGS MODAL --- */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Modal Title */}
            <div className="p-6 pb-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-800 tracking-tight font-display">
                  Управление графиком работы специалистов
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer hover:underline"
              >
                Закрыть
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto">
              
              {/* Doctor picker & date selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Doctor Choose Select (Disabled if current role is DOCTOR) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Врач-стоматолог
                  </label>
                  <select
                    value={scheduleDoctorId}
                    onChange={(e) => setScheduleDoctorId(e.target.value)}
                    disabled={currentUser?.role === 'DOCTOR'}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-teal-400 cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    {doctors.map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} ({doc.specialty})
                      </option>
                    ))}
                  </select>
                  {currentUser?.role === 'DOCTOR' && (
                    <span className="text-[9px] text-slate-400">Вы можете настраивать только свои часы работы.</span>
                  )}
                </div>

                {/* Target shift date */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Дата смены
                  </label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-teal-400 cursor-pointer"
                  />
                </div>

              </div>

              {/* Informative info label */}
              <div className="p-3 bg-amber-50/50 border border-amber-100/50 rounded-2xl text-[11px] text-amber-800 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Внимание:
                </span>
                <p>
                  Отметьте часы, в которые данный врач готов принимать пациентов на указанную дату. Снятые отметки заблокируют возможность записи на эти слоты.
                </p>
              </div>

              {/* Hours checkboxes/chips grid selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Доступные часы работы
                  </span>
                  
                  {/* Preset Quick Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setModalActiveSlots(TIME_SLOTS)}
                      className="text-[10px] text-teal-600 hover:text-teal-700 font-bold cursor-pointer"
                    >
                      Выбрать все
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setModalActiveSlots([])}
                      className="text-[10px] text-red-500 hover:text-red-600 font-bold cursor-pointer"
                    >
                      Очистить
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setModalActiveSlots(['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'])}
                      className="text-[10px] text-slate-500 hover:text-slate-700 font-bold cursor-pointer"
                    >
                      Стандарт
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {TIME_SLOTS.map(hour => {
                    const isChecked = modalActiveSlots.includes(hour);
                    return (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setModalActiveSlots(prev => prev.filter(h => h !== hour));
                          } else {
                            setModalActiveSlots(prev => [...prev, hour].sort());
                          }
                        }}
                        className={`p-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer text-center select-none ${
                          isChecked
                            ? 'bg-teal-50 border-teal-300 text-teal-700 font-extrabold shadow-3xs'
                            : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        {hour} {isChecked ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              >
                Отмена
              </button>
              
              <button
                type="button"
                onClick={() => handleSaveSchedule(modalActiveSlots)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm active:scale-95"
              >
                Сохранить график
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default memo(CalendarSystemImpl);
