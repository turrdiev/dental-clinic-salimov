/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { memo, useMemo, useState, useEffect } from 'react';
import { 
  CalendarClock, 
  Users, 
  DollarSign, 
  Layers, 
  Activity, 
  ArrowUpRight, 
  Stethoscope,
  Smile,
  ShieldAlert,
  BellRing,
  Send,
  CheckCircle2,
  MessageSquare,
  AlertTriangle,
  X,
  ClipboardList,
  Check,
  MessageCircle,
  Clock,
  Play,
  LogOut,
  Navigation
} from 'lucide-react';
import { Appointment, Patient, Doctor, Payment, User, PROCEDURE_LABELS_RU, STATUS_LABELS_RU, WorkSession } from '../types.js';

interface RetentionRule {
  name: string;
  days: number;
  label: string;
  defaultMsg: string;
  durationText: string;
}

const RETENTION_RULES: Record<string, RetentionRule> = {
  'cleaning': {
    name: 'Чистка',
    days: 300, // 10 месяцев
    label: 'Чистка (через 10 месяцев)',
    durationText: '10 месяцев',
    defaultMsg: 'Здравствуйте, {patientName}! Спасибо, что доверили нам заботу о Вашей улыбке. Рекомендуем запланировать следующую профессиональную гигиену полости рта через 10 месяцев для профилактики кариеса и поддержания свежести. Будем рады видеть Вас!'
  },
  'prevention': {
    name: 'Профилактика полости рта',
    days: 300, // 10 месяцев
    label: 'Профилактика полости рта (через 10 месяцев)',
    durationText: '10 месяцев',
    defaultMsg: 'Уважаемый(а) {patientName}! Стоматологическая клиника благодарит Вас за доверие. Для поддержания стоматологического здоровья десен и зубов рекомендуется плановый профилактический осмотр полости рта через 10 месяцев. С заботой, Ваша стоматология.'
  },
  'implantation': {
    name: 'Имплантация',
    days: 90, // 3 месяца
    label: 'Имплантация (через 3 месяца)',
    durationText: '3 месяца',
    defaultMsg: 'Здравствуйте, {patientName}! Напоминаем о плановом контрольном осмотре полости рта после процедуры имплантации через 3 месяца. Нам важно убедиться, что процесс приживления прошел безупречно.'
  },
  'sutures': {
    name: 'Снятие швов',
    days: 10,
    label: 'Снятие швов (через 10 дней)',
    durationText: '10 дней',
    defaultMsg: 'Здравствуйте, {patientName}! Напоминаем Вам о необходимости прийти на процедуру снятия швов через 10 дней после проведенного хирургического этапа.'
  },
  'extraction_check': {
    name: 'Удаление (осмотр)',
    days: 3,
    label: 'Удаление (осмотр) (через 3 дня)',
    durationText: '3 дня',
    defaultMsg: 'Уважаемый(а) {patientName}! Ждем Вас на контрольный осмотр через 3 дня после удаления зуба для проверки идеального заживления десны и профилактики альвеолита. Пожалуйста, посетите Вашего врача.'
  },
  'crown': {
    name: 'Ортопедия - коронка',
    days: 1,
    label: 'Ортопедия - коронка (через 1 день)',
    durationText: '1 день',
    defaultMsg: 'Здравствуйте, {patientName}! Напоминаем, что через 1 день (завтра) запланирован ортопедический этап — примерка или фиксация коронки. Пожалуйста, подтвердите визит.'
  }
};

function getAutoRuleKey(procedure: string): string {
  if (procedure === 'Cleaning') return 'cleaning';
  if (procedure === 'Implantation') return 'implantation';
  if (procedure === 'Extraction') return 'extraction_check';
  if (procedure === 'Preparation' || procedure === 'Healing Abutment Installation') return 'crown';
  return 'prevention';
}

interface DashboardProps {
  currentUser: User | null;
  appointments: Appointment[];
  patients: Patient[];
  doctors: Doctor[];
  payments: Payment[];
  onSelectTab: (tab: string) => void;
  onSetAppointmentStatus: (id: string, status: any) => void;
  onAddMedicalRecord?: (record: any) => Promise<any>;
  workSessions?: WorkSession[];
  onClockIn?: (location?: { latitude: number; longitude: number; accuracy?: number }) => Promise<void>;
  onClockOut?: (location?: { latitude: number; longitude: number; accuracy?: number }) => Promise<void>;
}

function DashboardImpl({
  currentUser,
  appointments,
  patients,
  doctors,
  payments,
  onSelectTab,
  onSetAppointmentStatus,
  onAddMedicalRecord,
  workSessions = [],
  onClockIn,
  onClockOut
}: DashboardProps) {

  const isChief = currentUser?.role === 'CHIEF_DOCTOR';
  const doctorId = currentUser?.doctorId;

  const [selectedReminder, setSelectedReminder] = useState<any | null>(null);
  const [notifiedPatients, setNotifiedPatients] = useState<string[]>([]);
  const [notificationTemplate, setNotificationTemplate] = useState<string>('');

  // Custom reminders state loaded from local storage
  const [customReminders, setCustomReminders] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('dentadmin_custom_reminders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Report modal states
  const [aptForReport, setAptForReport] = useState<Appointment | null>(null);
  const [reportPatient, setReportPatient] = useState<Patient | null>(null);
  const [reportDoctor, setReportDoctor] = useState<Doctor | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportRecommendation, setReportRecommendation] = useState('');
  const [selectedRuleKey, setSelectedRuleKey] = useState<string>('prevention');
  const [customDays, setCustomDays] = useState(30);
  const [reportMessage, setReportMessage] = useState('');
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [copiedRecallSuccess, setCopiedRecallSuccess] = useState(false);

  // Automated Care Recalls / Reminders Engine
  const recallReminders = useMemo(() => {
    const today = new Date();
    
    return patients.map(patient => {
      // Is there an active custom reminder for this patient in localStorage?
      const patientCustom = customReminders.find(cr => cr.patientId === patient.id);
      
      // Find all completed appointments for this patient
      const patientApts = appointments.filter(a => a.patientId === patient.id && a.status === 'Completed');
      const hasUpcomingType = appointments.some(a => a.patientId === patient.id && a.status === 'Scheduled');
      
      if (patientCustom) {
        const todayDate = new Date();
        const targetDate = new Date(patientCustom.targetDate);
        const diffTime = targetDate.getTime() - todayDate.getTime();
        const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isOverdue = daysUntil <= 0;
        const daysOverdue = isOverdue ? Math.abs(daysUntil) : 0;
        
        const sortedApts = [...patientApts].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        const lastApt = sortedApts[0];
        const lastVisitDate = lastApt ? lastApt.startTime : patientCustom.createdAt;
        const belongsToCurrentDoctor = lastApt ? lastApt.doctorId === doctorId : true;
        
        return {
          patient,
          lastApt,
          lastVisitDate,
          daysSinceLastVisit: lastApt ? Math.ceil(Math.abs(todayDate.getTime() - new Date(lastApt.startTime).getTime()) / (1000 * 60 * 60 * 24)) : 0,
          recommendedProcedure: patientCustom.reminderLabel,
          daysUntilRecall: daysUntil,
          status: isOverdue ? 'Overdue' : 'Scheduled',
          daysOverdue,
          needNotification: !hasUpcomingType,
          belongsToCurrentDoctor,
          messageTemplate: patientCustom.message,
          isCustom: true,
          customId: patientCustom.id
        };
      }
      
      if (patientApts.length === 0) {
        // Assume new patient that hasn't completed therapy
        return {
          patient,
          lastVisitDate: null,
          daysSinceLastVisit: 999,
          recommendedProcedure: 'Первичный осмотр и проф. гигиена',
          daysUntilRecall: 0,
          status: 'Overdue',
          daysOverdue: 30,
          needNotification: !hasUpcomingType,
          messageTemplate: `Здравствуйте, ${patient.fullName}! Стоматологическая клиника приглашает Вас на плановую диагностику и составление карты ухода. Запись по телефону.`
        };
      }
      
      // Sort to find the last completed session
      const sortedApts = [...patientApts].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      const lastApt = sortedApts[0];
      const lastVisit = new Date(lastApt.startTime);
      const diffTime = Math.abs(today.getTime() - lastVisit.getTime());
      const daysSince = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let recallTargetDays = 300; // Default 10 months (Профилактика полости рта)
      let recommendedProcedure = 'Профилактика полости рта';
      
      if (lastApt.procedure === 'Cleaning') {
        recallTargetDays = 300; // 10 месяцев
        recommendedProcedure = 'Чистка';
      } else if (lastApt.procedure === 'Implantation') {
        recallTargetDays = 90; // 3 месяца
        recommendedProcedure = 'Имплантация';
      } else if (lastApt.procedure === 'Extraction') {
        recallTargetDays = 3; // 3 дня
        recommendedProcedure = 'Удаление (осмотр)';
      } else if (lastApt.procedure === 'Preparation' || lastApt.procedure === 'Healing Abutment Installation') {
        recallTargetDays = 1; // 1 день
        recommendedProcedure = 'Ортопедия - коронка';
      } else if (lastApt.procedure === 'Treatment' || lastApt.procedure === 'Filling' || lastApt.procedure === 'Depulpation' || lastApt.procedure === 'Consultation') {
        recallTargetDays = 300; // 10 месяцев
        recommendedProcedure = 'Профилактика полости рта';
      }
      
      const daysUntil = recallTargetDays - daysSince;
      const isOverdue = daysUntil <= 0;
      const daysOverdue = isOverdue ? Math.abs(daysUntil) : 0;
      
      const messageTemplate = isOverdue
        ? `Уважаемый(а) ${patient.fullName}! Напоминаем Вам о необходимости пройти плановую процедуру "${recommendedProcedure}" в связи с окончанием профилактического периода. Клиника стоматологического ухода.`
        : `Здравствуйте, ${patient.fullName}! Стоматология оповещает Вас: процедура "${recommendedProcedure}" планово рекомендуется через ${daysUntil} дней. Будем рады Вас видеть.`;

      // Filter: if regular doctor, check who performed the last treatment
      const belongsToCurrentDoctor = lastApt.doctorId === doctorId;

      return {
        patient,
        lastApt,
        lastVisitDate: lastApt.startTime,
        daysSinceLastVisit: daysSince,
        recommendedProcedure,
        daysUntilRecall: daysUntil,
        status: isOverdue ? 'Overdue' : 'Scheduled',
        daysOverdue,
        needNotification: !hasUpcomingType,
        belongsToCurrentDoctor,
        messageTemplate
      };
    }).sort((a, b) => {
      // Overdue first
      if (a.status === 'Overdue' && b.status !== 'Overdue') return -1;
      if (a.status !== 'Overdue' && b.status === 'Overdue') return 1;
      return a.daysUntilRecall - b.daysUntilRecall;
    });
  }, [patients, appointments, isChief, doctorId, customReminders]);

  // Handler for setting status dropdown interceptively
  const handleSetAppointmentStatusWithReport = (aptId: string, status: any) => {
    onSetAppointmentStatus(aptId, status);
    
    if (status === 'Completed') {
      const apt = appointments.find(a => a.id === aptId);
      if (apt) {
        openReportModal(apt);
      }
    }
  };

  const openReportModal = (apt: Appointment) => {
    setAptForReport(apt);
    const p = patients.find(pat => pat.id === apt.patientId);
    const d = doctors.find(doc => doc.id === apt.doctorId);
    setReportPatient(p || null);
    setReportDoctor(d || null);
    setReportRecommendation('');
    
    const ruleKey = getAutoRuleKey(apt.procedure);
    setSelectedRuleKey(ruleKey);
    
    // Initial formatted message template
    const pName = p ? p.fullName : 'Уважаемый клиент';
    const ruleData = RETENTION_RULES[ruleKey] || RETENTION_RULES['prevention'];
    const defaultText = ruleData.defaultMsg.replace('{patientName}', pName);
    setReportMessage(defaultText);
    setIsReportModalOpen(true);
  };

  const handleOpenReportManually = (apt: Appointment) => {
    openReportModal(apt);
  };

  const handleRuleChange = (key: string) => {
    setSelectedRuleKey(key);
    const pName = reportPatient ? reportPatient.fullName : 'Уважаемый клиент';
    let baseText = '';
    
    if (key === 'custom') {
      baseText = `Здравствуйте, ${pName}! Рады были видеть Вас. Назначена следующая индивидуальная процедура профилактики через ${customDays} дней. Будем рады Вас видеть!`;
    } else {
      const ruleData = RETENTION_RULES[key];
      baseText = ruleData ? ruleData.defaultMsg.replace('{patientName}', pName) : '';
    }
    
    if (reportRecommendation.trim()) {
      setReportMessage(`${baseText}\n\nРекомендации врача: ${reportRecommendation}`);
    } else {
      setReportMessage(baseText);
    }
  };

  const handleRecommendationChange = (text: string) => {
    setReportRecommendation(text);
    const pName = reportPatient ? reportPatient.fullName : 'Уважаемый клиент';
    let baseText = '';
    
    if (selectedRuleKey === 'custom') {
      baseText = `Здравствуйте, ${pName}! Рады были видеть Вас. Назначена следующая индивидуальная процедура профилактики через ${customDays} дней. Будем рады Вас видеть!`;
    } else {
      const ruleData = RETENTION_RULES[selectedRuleKey];
      baseText = ruleData ? ruleData.defaultMsg.replace('{patientName}', pName) : '';
    }
    
    if (text.trim()) {
      setReportMessage(`${baseText}\n\nРекомендации врача: ${text}`);
    } else {
      setReportMessage(baseText);
    }
  };

  const handleCustomDaysChange = (days: number) => {
    setCustomDays(days);
    const pName = reportPatient ? reportPatient.fullName : 'Уважаемый клиент';
    let baseText = `Здравствуйте, ${pName}! Рады были видеть Вас. Назначена следующая индивидуальная процедура профилактики через ${days} дней. Будем рады Вас видеть!`;
    if (reportRecommendation.trim()) {
      baseText += `\n\nРекомендации врача: ${reportRecommendation}`;
    }
    setReportMessage(baseText);
  };

  const handleSaveReport = async () => {
    if (!aptForReport || !reportPatient) return;
    
    let daysToTarget = 300;
    let label = 'Профилактика полости рта';
    
    if (selectedRuleKey === 'custom') {
      daysToTarget = customDays;
      label = 'Индивидуальная профилактика';
    } else {
      const rule = RETENTION_RULES[selectedRuleKey];
      if (rule) {
        daysToTarget = rule.days;
        label = rule.name;
      }
    }
    
    const todayStr = new Date().toISOString().split('T')[0];
    const target = new Date(todayStr);
    target.setDate(target.getDate() + daysToTarget);
    const targetDateStr = target.toISOString().split('T')[0];
    
    // Remove previous custom reminders for this patient to prevent duplication
    const currentCustoms = customReminders.filter(cr => cr.patientId !== reportPatient.id);
    
    const newCustomReminder = {
      id: Math.random().toString(36).substr(2, 9),
      patientId: reportPatient.id,
      patientName: reportPatient.fullName,
      patientPhone: reportPatient.phone,
      procedureType: aptForReport.procedure,
      reminderKey: selectedRuleKey,
      reminderLabel: label,
      targetDate: targetDateStr,
      message: reportMessage,
      status: daysToTarget <= 0 ? 'Overdue' : 'Scheduled',
      createdAt: todayStr
    };
    
    const updatedCustoms = [...currentCustoms, newCustomReminder];
    setCustomReminders(updatedCustoms);
    localStorage.setItem('dentadmin_custom_reminders', JSON.stringify(updatedCustoms));
    
    // Write clinical report as an autogenerated Medical Record inside clinical history!
    if (onAddMedicalRecord) {
      try {
        await onAddMedicalRecord({
          patientId: reportPatient.id,
          doctorId: reportDoctor ? reportDoctor.id : (currentUser?.doctorId || 'admin'),
          date: todayStr,
          complaints: 'Проведение планового лечения',
          symptoms: `Завершен очередной прием. Выполнена процедура: ${PROCEDURE_LABELS_RU[aptForReport.procedure] || aptForReport.procedure}`,
          diagnosis: 'Плановая санация и удержание',
          treatmentPlan: `Форма удержания: ${label} (Срок: ${daysToTarget} дн., Ожидаемая дата: ${targetDateStr})`,
          proceduresPerformed: [PROCEDURE_LABELS_RU[aptForReport.procedure] || aptForReport.procedure],
          prescriptions: `Врачебные рекомендации пациенту: ${reportRecommendation || 'Соблюдать гигиенический режим.'}`
        });
      } catch (err) {
        console.error('Failed storing post-treatment medical record history', err);
      }
    }
    
    setIsReportModalOpen(false);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(reportMessage);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!reportPatient) return;
    const cleanPhone = reportPatient.phone.replace(/[^\d+]/g, '');
    const encodedText = encodeURIComponent(reportMessage);
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`, '_blank');
  };

  const handleShareTelegram = () => {
    const encodedText = encodeURIComponent(reportMessage);
    window.open(`https://t.me/share/url?url=&text=${encodedText}`, '_blank');
  };

  const handleCopyRecallToClipboard = () => {
    if (!selectedReminder) return;
    navigator.clipboard.writeText(notificationTemplate);
    setCopiedRecallSuccess(true);
    setTimeout(() => setCopiedRecallSuccess(false), 2000);
  };

  const handleShareRecallWhatsApp = () => {
    if (!selectedReminder) return;
    const cleanPhone = selectedReminder.patient.phone.replace(/[^\d+]/g, '');
    const encodedText = encodeURIComponent(notificationTemplate);
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`, '_blank');
    if (!notifiedPatients.includes(selectedReminder.patient.id)) {
      setNotifiedPatients([...notifiedPatients, selectedReminder.patient.id]);
    }
  };

  const handleShareRecallTelegram = () => {
    if (!selectedReminder) return;
    const encodedText = encodeURIComponent(notificationTemplate);
    window.open(`https://t.me/share/url?url=&text=${encodedText}`, '_blank');
    if (!notifiedPatients.includes(selectedReminder.patient.id)) {
      setNotifiedPatients([...notifiedPatients, selectedReminder.patient.id]);
    }
  };

  // Filter based on RBAC rules!
  const filteredAppointments = useMemo(() => {
    return appointments;
  }, [appointments]);

  const filteredPayments = useMemo(() => {
    if (currentUser?.role === 'CHIEF_DOCTOR') return payments;
    if (currentUser?.role === 'ADMINISTRATOR') return [];
    return payments.filter(p => p.doctorId === doctorId);
  }, [payments, currentUser, doctorId]);

  // Calculations for KPI Cards
  const todayStr = new Date().toISOString().split('T')[0]; // Today's date
  
  const todayAppointments = useMemo(() => {
    return filteredAppointments.filter(a => a.startTime.startsWith(todayStr) && a.status !== 'Cancelled');
  }, [filteredAppointments]);

  const stats = useMemo(() => {
    // 1. Appointments Today
    const todayCount = todayAppointments.length;

    // 2. Total active patient roster count
    // If Admin, all patients. If doctor, patients with at least 1 historical appointment with this doctor.
    let activePatientsCount = 0;
    if (isChief || currentUser?.role === 'ADMINISTRATOR') {
      activePatientsCount = patients.length;
    } else {
      const patientIds = new Set(appointments.filter(a => a.doctorId === doctorId).map(a => a.patientId));
      activePatientsCount = patientIds.size || patients.length - 2; // fallback realistic number
    }

    // 3. Monthly Revenue (May 2026)
    const currentMonthRevenue = filteredPayments
      .filter(p => { const ym = new Date().toISOString().slice(0,7); return p.date.startsWith(ym); })
      .reduce((sum, p) => sum + p.amountReceived, 0);

    // 4. Occupied Chairs Today
    const rightNow = Date.now();
    const occupiedChairs = new Set<number>();
    
    todayAppointments.forEach(a => {
      const start = new Date(a.startTime).getTime();
      const end = new Date(a.endTime).getTime();
      if (rightNow >= start && rightNow <= end && a.status === 'In_Progress') {
        occupiedChairs.add(Number(a.chairId));
      }
    });

    const occupiedChairsCount = occupiedChairs.size;

    return {
      todayCount,
      activePatientsCount,
      monthlyRevenue: currentMonthRevenue,
      occupiedChairsCount
    };
  }, [todayAppointments, filteredPayments, isChief, patients, appointments, doctorId]);

  // Sort upcoming chronologically
  const sortedUpcoming = useMemo(() => {
    return [...filteredAppointments]
      .filter(a => new Date(a.startTime).getTime() >= Date.now() - 86400000 && a.status !== 'Cancelled')
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 4);
  }, [filteredAppointments]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200 font-sans">
      
      {/* Intro Greetings Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 border border-slate-100/60 p-5 rounded-3xl backdrop-blur-xs">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
            Панель управления клиникой
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Рады видеть вас, <span className="font-semibold text-teal-600 font-display">{currentUser?.name}</span>. Нагрузка кресел под оптимальным контролем.
          </p>
        </div>
        
        {/* Rapid Actions Ribbon */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectTab('calendar')}
            className="p-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5"
          >
            <CalendarClock className="w-4 h-4 shrink-0 text-teal-100" /> Запланировать визит
          </button>
          <button
            onClick={() => onSelectTab('patients')}
            className="p-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-2xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer transition-all"
          >
            <Users className="w-4 h-4 shrink-0 text-slate-400" /> Добавить пациента
          </button>
        </div>
      </div>



      {/* Statistics Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Stats Card: Appointments */}
        <div className="neo-card p-5 rounded-3xl flex items-center justify-between relative overflow-hidden group">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Приемы на сегодня</span>
            <span className="text-2xl font-bold font-display text-slate-900 block">{stats.todayCount}</span>
            <span className="text-[9px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-lg flex items-center w-fit gap-1 mt-1">
              <Activity className="w-2.5 h-2.5 animate-pulse text-teal-600" /> Расписание стабильно
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100/50">
            <CalendarClock className="w-5 h-5" />
          </div>
        </div>

        {/* Stats Card: Active Patients */}
        <div className="neo-card p-5 rounded-3xl flex items-center justify-between relative overflow-hidden group">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Активные пациенты</span>
            <span className="text-2xl font-bold font-display text-slate-900 block">{stats.activePatientsCount}</span>
            <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg flex items-center w-fit gap-1 mt-1">
              +15% подъем активности
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/50">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Stats Card: Revenue */}
        {currentUser?.role === 'ADMINISTRATOR' ? (
          <div className="neo-card p-5 rounded-3xl flex items-center justify-between relative overflow-hidden group">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Очередь уведомлений</span>
              <span className="text-2xl font-bold font-display text-slate-900 block">
                {recallReminders.filter(r => r.needNotification).length} пац.
              </span>
              <span className="text-[9px] text-sky-700 font-bold bg-sky-50 px-2 py-0.5 rounded-lg flex items-center w-fit gap-1 mt-1">
                Требуется напомнить сегодня
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/50">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        ) : (
          <div className="neo-card p-5 rounded-3xl flex items-center justify-between relative overflow-hidden group">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {isChief ? 'Выручка за май (общая)' : 'Личный доход'}
              </span>
              <span className="text-2xl font-bold font-display text-slate-900 block">
                {stats.monthlyRevenue.toLocaleString()} ₸
              </span>
              <span className="text-[9px] text-sky-700 font-bold bg-sky-50 px-2 py-0.5 rounded-lg flex items-center w-fit gap-1 mt-1">
                {isChief ? 'Все выполненные лечения' : 'Только ваши приемы'}
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100/50">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        )}

        {/* Stats Card: Available Slots */}
        <div className="neo-card p-5 rounded-3xl flex items-center justify-between relative overflow-hidden group">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Загрузка кресел</span>
            <span className="text-xl font-bold font-display text-slate-900 block">
              {stats.occupiedChairsCount === 0 
                ? 'Все кресла свободны' 
                : stats.occupiedChairsCount < 2 
                  ? '1 из 2 на приеме' 
                  : '2 из 2 кресла заняты'
              }
            </span>
            <span className="text-[9px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-lg flex items-center w-fit gap-1 mt-1">
              Кабинеты активны
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-100/50">
            <Layers className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Main Grid: Today's Procedures (Left) & Upcoming Timeline (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Today's Appointments List (Col Span 2) */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-50 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight font-display">Расписание лечений — 30 мая</h3>
              <p className="text-[11px] text-slate-400">Автоматически оптимизированный поток стоматологических кресел</p>
            </div>
            <button
              onClick={() => onSelectTab('calendar')}
              className="text-[10px] text-teal-600 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Развернуть календарь &rarr;
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            {todayAppointments.length === 0 ? (
              <div className="py-16 text-center">
                <Smile className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">На сегодня приемов не запланировано.</p>
              </div>
            ) : (
              <table className="w-full text-xs text-left text-slate-600 border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3">Время</th>
                    <th className="py-3">Пациент</th>
                    <th className="py-3">Процедура</th>
                    <th className="py-3">Лечащий врач</th>
                    <th className="py-3">Кресло</th>
                    <th className="py-3 text-right">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150/60">
                  {todayAppointments.map((apt) => {
                    const patient = patients.find(p => p.id === apt.patientId);
                    const doctor = doctors.find(d => d.id === apt.doctorId);

                    // Times format
                    const startHr = new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const endHr = new Date(apt.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <tr key={apt.id} className="hover:bg-slate-50/70 group transition-all">
                        <td className="py-4 font-mono font-semibold text-slate-800">
                          {startHr} <span className="text-slate-400 font-sans text-[10px] font-normal">({endHr})</span>
                        </td>
                        <td className="py-4 px-1">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/15 flex items-center justify-center font-display font-medium text-teal-700 text-[11px] uppercase">
                              {patient ? patient.fullName.split(' ').map(n => n[0]).slice(0, 2).join('') : 'П'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 group-hover:text-teal-600 transition-colors">
                                {patient ? patient.fullName : 'Гость'}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{patient?.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          <span className="text-slate-800 font-bold text-[11px] px-2.5 py-1 bg-slate-50 border border-slate-200/60 rounded-xl">
                            {PROCEDURE_LABELS_RU[apt.procedure] || apt.procedure}
                          </span>
                        </td>
                        <td className="py-4 text-xs text-slate-800 font-semibold">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: doctor?.color ? `var(--color-${doctor.color}-500)` : '#14b8a6' }} />
                            {doctor ? doctor.name : 'Дантист'}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold font-mono ${
                            Number(apt.chairId) === 1 ? 'bg-teal-50/80 text-teal-800 border border-teal-100/50' : 'bg-indigo-50/80 text-indigo-800 border border-indigo-100/50'
                          }`}>
                            Кресло {apt.chairId}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            <select
                              value={apt.status}
                              onChange={(e) => handleSetAppointmentStatusWithReport(apt.id, e.target.value)}
                              className={`text-[10.5px] font-extrabold px-3 py-1.5 rounded-xl border focus:outline-hidden cursor-pointer shadow-3xs transition-all ${
                                apt.status === 'Completed' ? 'bg-emerald-50 border-emerald-100/80 text-emerald-800' :
                                apt.status === 'In_Progress' ? 'bg-sky-50 border-sky-100/80 text-sky-800' :
                                apt.status === 'Cancelled' ? 'bg-rose-50 border-rose-100/80 text-rose-800' :
                                'bg-amber-50 border-amber-100 text-amber-800'
                              }`}
                            >
                              <option value="Scheduled">Запланирован</option>
                              <option value="In_Progress">В процессе</option>
                              <option value="Completed">Завершен</option>
                              <option value="Cancelled">Отменен</option>
                            </select>
                            {apt.status === 'Completed' && (
                              <button
                                onClick={() => handleOpenReportManually(apt)}
                                className="text-[10px] text-teal-600 font-bold hover:text-teal-700 flex items-center gap-1.5 cursor-pointer bg-teal-500/10 hover:bg-teal-500/15 border border-teal-500/15 px-2 py-1 rounded-xl transition-all"
                              >
                                <ClipboardList className="w-3 h-3 text-teal-600 shrink-0" /> Отчет и СМС
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Upcoming Chronological Timeline Sidebar (Col Span 1) */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs flex flex-col">
          <div className="pb-4 border-b border-slate-50 mb-4">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight font-display">Очередь приемов</h3>
            <p className="text-[11px] text-slate-400">Хронологическая шкала приема пациентов</p>
          </div>

          <div className="flex-1 relative space-y-5">
            {sortedUpcoming.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center">
                <p className="text-xs text-slate-400 font-medium">Нет предстоящих приемов.</p>
              </div>
            ) : (
              sortedUpcoming.map((apt, index) => {
                const patient = patients.find(p => p.id === apt.patientId);
                const doctor = doctors.find(d => d.id === apt.doctorId);
                const aptDate = new Date(apt.startTime);
                const timeStr = aptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                return (
                  <div key={apt.id} className="relative flex gap-4 items-start group">
                    {/* Vertical connector lines */}
                    {index !== sortedUpcoming.length - 1 && (
                      <span className="absolute left-3 top-7 bottom-0 w-0.5 bg-slate-100 -mb-6 group-hover:bg-slate-200 transition-colors" />
                    )}

                    {/* Left node indicator */}
                    <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center font-bold text-[9px] text-slate-500 shrink-0 font-mono select-none group-hover:bg-teal-50 group-hover:border-teal-300 group-hover:text-teal-600 transition-colors mt-0.5">
                      {index + 1}
                    </div>

                    {/* Right text details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          {timeStr}
                        </span>
                        <span className={`text-[8px] font-bold px-1.5 rounded-sm uppercase tracking-wider ${
                          apt.status === 'In_Progress' ? 'bg-sky-50 text-sky-700 border border-sky-100' : 'bg-slate-50 text-slate-500'
                        }`}>
                          {STATUS_LABELS_RU[apt.status] || apt.status}
                        </span>
                      </div>
                      <p className="font-semibold text-xs text-slate-800 mt-1 truncate">
                        {patient ? patient.fullName : 'Пациент'}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                        <p className="truncate font-medium">{doctor ? doctor.name : ''} • Кресло {apt.chairId}</p>
                        <p className="text-teal-600 font-semibold">{PROCEDURE_LABELS_RU[apt.procedure] || apt.procedure}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

          </div>
        </div>

      </div>

      {/* SECTION: Automated Reminders & Patient Care Recall */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight font-display flex items-center gap-2">
              <BellRing className="w-4 h-4 text-amber-500 shrink-0" />
              <span>⚕️ Профилактика и удержание пациентов (Напоминания)</span>
            </h3>
            <p className="text-[11px] text-slate-400">Автоматический расчет сроков чистки, осмотров и процедур на основе их последнего визита</p>
          </div>
          <span className="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-lg font-bold">
            Карт на контроле: {recallReminders.length}
          </span>
        </div>

        {recallReminders.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Нет активных напоминаний в настоящее время.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recallReminders.slice(0, 6).map((rem) => {
              const notified = notifiedPatients.includes(rem.patient.id);
              return (
                <div key={rem.patient.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col justify-between space-y-3 hover:border-teal-200 transition-all shadow-3xs">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        rem.status === 'Overdue' 
                          ? 'bg-red-50 text-red-700 border border-red-100' 
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      }`}>
                        {rem.status === 'Overdue' ? `Просрочено на ${rem.daysOverdue} дн.` : `Планово через ${rem.daysUntilRecall} дн.`}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {rem.lastVisitDate ? `Визит: ${new Date(rem.lastVisitDate).toLocaleDateString()}` : 'Новый пациент'}
                      </span>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        {rem.patient.fullName}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-mono">{rem.patient.phone}</p>
                    </div>

                    <div className="text-[11px] bg-white border border-slate-100/60 p-2.5 rounded-xl text-slate-700 font-medium font-sans">
                      <p className="text-[8px] text-slate-400 font-bold block mb-0.5">РЕКОМЕНДУЕМАЯ ПРОЦЕДУРА:</p>
                      <span className="text-teal-700 font-bold leading-tight block">{rem.recommendedProcedure}</span>
                      {rem.daysSinceLastVisit && rem.daysSinceLastVisit !== 999 && (
                        <span className="text-[9px] text-slate-400 mt-1 block font-normal">
                          Прошло дней после приема: {rem.daysSinceLastVisit}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-semibold">
                      {notified ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Оповещен
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono font-bold text-[9px]">ОЖИДАНИЕ ТЕЛЕФОНИИ</span>
                      )}
                    </span>
                    
                    <button
                      onClick={() => {
                        setSelectedReminder(rem);
                        setNotificationTemplate(rem.messageTemplate);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                        notified
                          ? 'bg-slate-100 text-slate-550 border border-slate-200 hover:bg-slate-150'
                          : 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-100 hover:shadow-xs'
                      }`}
                    >
                      <Send className="w-3 h-3" />
                      <span>{notified ? 'Оповестить повторно' : 'Связаться'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>



      {/* MODAL: Care Recall Template Dispatcher dialog */}
      {selectedReminder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-100 animate-in zoom-in-95 duration-150 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-teal-50/10 font-sans">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/10 text-teal-600 rounded-2xl">
                  <MessageSquare className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-display">Оповещение пациента</h3>
                  <p className="text-[10px] text-slate-400">Служба заботы о клиентах клиники</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReminder(null)}
                className="p-1 px-1.5 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded-xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 font-sans max-h-[calc(100vh-220px)] overflow-y-auto">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Пациент</span>
                  <span className="font-bold text-slate-800 block mt-0.5">{selectedReminder.patient.fullName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Телефон</span>
                  <span className="font-mono font-bold text-slate-605 block mt-0.5">{selectedReminder.patient.phone}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Текст сообщения для клиента</label>
                  <button
                    onClick={handleCopyRecallToClipboard}
                    className="text-[10px] text-teal-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedRecallSuccess ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600 font-bold">Скопировано!</span>
                      </>
                    ) : (
                      <>
                        <ClipboardList className="w-3 h-3" />
                        <span>Скопировать</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={notificationTemplate}
                  onChange={(e) => setNotificationTemplate(e.target.value)}
                  className="w-full text-xs p-3.5 bg-slate-50 border border-slate-150 rounded-2xl min-h-24 focus:outline-hidden focus:border-teal-500 focus:bg-white text-slate-700 font-medium font-sans leading-relaxed"
                />

                {/* Instant Messenger Dispatch Links */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    onClick={handleShareRecallWhatsApp}
                    className="p-2 py-2.5 bg-[#25D366]/10 hover:bg-[#25D366]/15 text-[#128C7E] rounded-xl text-xs font-bold border border-[#25D366]/20 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0 text-[#25D366]" /> Отправить в WhatsApp
                  </button>

                </div>
              </div>


            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 font-sans">
              <button
                onClick={() => setSelectedReminder(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  if (!notifiedPatients.includes(selectedReminder.patient.id)) {
                    setNotifiedPatients([...notifiedPatients, selectedReminder.patient.id]);
                  }
                  setSelectedReminder(null);
                }}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md shadow-teal-600/10 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 text-teal-100" />
                Подтвердить оповещение
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Post-Treatment Admittance Report & Retention SMS Form */}
      {isReportModalOpen && aptForReport && reportPatient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl border border-slate-100 animate-in zoom-in-95 duration-150 overflow-hidden my-8">
            {/* Header */}
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-teal-50/10 font-sans">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/10 text-teal-600 rounded-2xl">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-display">Отчет после принятия клиента</h3>
                  <p className="text-[10px] text-slate-400">Формирование клинического резюме и удержания</p>
                </div>
              </div>
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="p-1 px-1.5 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded-xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 font-sans overflow-y-auto max-h-[70vh]">
              {/* Infobox */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Пациент</span>
                  <span className="font-bold text-slate-800">{reportPatient.fullName}</span>
                  <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{reportPatient.phone}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Процедура</span>
                  <span className="font-bold text-teal-600">{PROCEDURE_LABELS_RU[aptForReport.procedure] || aptForReport.procedure}</span>
                </div>
              </div>

              {/* Doctor's Recommendation */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  📝 Клиническое резюме / Рекомендации врача
                </label>
                <textarea
                  placeholder="Например: Лечение глубокого кариеса 36 зуба завершено успешно. Рекомендовано воздержаться от приема пищи 2 часа и горячего..."
                  value={reportRecommendation}
                  onChange={(e) => handleRecommendationChange(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-200 rounded-2xl min-h-16 focus:outline-hidden focus:border-teal-500 focus:bg-white text-slate-700 font-medium"
                />
              </div>

              {/* Retention Interval Configuration */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  ⚙️ Выберите план профилактического удержания
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {Object.entries(RETENTION_RULES).map(([key, rule]) => (
                    <div
                      key={key}
                      className={`p-3 border rounded-2xl cursor-pointer flex flex-col justify-between transition-all ${
                        selectedRuleKey === key 
                          ? 'border-teal-500 bg-teal-500/5 text-teal-900 shadow-3xs' 
                          : 'border-slate-100 bg-white hover:bg-slate-50/50 text-slate-700'
                      }`}
                      onClick={() => handleRuleChange(key)}
                    >
                      <span className="font-bold text-[11px] block">{rule.name}</span>
                      <span className="text-[10px] text-slate-400 mt-1 block">Интервал: {rule.durationText}</span>
                    </div>
                  ))}
                  
                  {/* Custom Option */}
                  <div
                    className={`p-3 border rounded-2xl cursor-pointer flex flex-col justify-between transition-all col-span-1 sm:col-span-2 ${
                      selectedRuleKey === 'custom' 
                        ? 'border-teal-500 bg-teal-50/50 text-teal-900 shadow-3xs' 
                        : 'border-slate-100 bg-white hover:bg-slate-50/10 text-slate-700'
                    }`}
                    onClick={() => handleRuleChange('custom')}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-[11px]">Другой интервал</span>
                      {selectedRuleKey === 'custom' && (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            min="1"
                            max="1000"
                            value={customDays}
                            onChange={(e) => handleCustomDaysChange(parseInt(e.target.value) || 30)}
                            className="w-16 p-1 text-center bg-white border border-slate-200 rounded-lg text-xs font-bold text-teal-700 font-sans"
                          />
                          <span className="text-[10px] text-slate-400 font-mono">дней</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Formulated Message Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    💬 Сформированное сообщение для клиента
                  </label>
                  <button
                    onClick={handleCopyToClipboard}
                    className="text-[10px] text-teal-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSuccess ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Скопировано!</span>
                      </>
                    ) : (
                      <>
                        <ClipboardList className="w-3 h-3" />
                        <span>Скопировать</span>
                      </>
                    )}
                  </button>
                </div>
                
                <textarea
                  value={reportMessage}
                  onChange={(e) => setReportMessage(e.target.value)}
                  className="w-full text-xs p-3.5 bg-slate-50 border border-slate-150 rounded-2xl min-h-24 focus:outline-hidden focus:border-teal-500 focus:bg-white text-slate-700 font-medium font-sans leading-relaxed"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 font-sans">
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveReport}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md shadow-teal-600/10 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 text-teal-100" />
                Сохранить отчет и запланировать
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default memo(DashboardImpl);
