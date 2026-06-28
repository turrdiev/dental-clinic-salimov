/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback, lazy, Suspense, FormEvent } from 'react';
import { 
  Stethoscope, 
  Activity, 
  Lock, 
  ShieldCheck, 
  User as UserIcon, 
  Clock, 
  ServerCrash 
} from 'lucide-react';
import Sidebar from './components/Sidebar.js';
import Header from './components/Header.js';
// Lazy load heavy tab components — only bundle what's needed when it's needed
const Dashboard = lazy(() => import('./components/Dashboard.js'));
const CalendarSystem = lazy(() => import('./components/CalendarSystem.js'));
const PatientManagement = lazy(() => import('./components/PatientManagement.js'));
const DoctorManagement = lazy(() => import('./components/DoctorManagement.js'));
const FinancialAnalytics = lazy(() => import('./components/FinancialAnalytics.js'));
const SecurityAuditLogs = lazy(() => import('./components/SecurityAuditLogs.js'));
import { api } from './utils/api.js';

import { 
  User, 
  Patient, 
  Doctor, 
  Appointment, 
  MedicalRecord, 
  AttachmentFile, 
  Payment, 
  ClinicNotification, 
  AuditLog, 
  PROCEDURE_CONFIGS,
  ProcedureType,
  UserRole,
  WorkSession
} from './types.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  // Master API database states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notifications, setNotifications] = useState<ClinicNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);

  // Controls UI overlays
  const [loading, setLoading] = useState(true);
  const [errorString, setErrorString] = useState<string | null>(null);
  
  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Jump hooks triggered by global search selections
  const [selectedPatientIdFromSearch, setSelectedPatientIdFromSearch] = useState<string | null>(null);

  // Quick Session authentication check on start
  useEffect(() => {
    async function loadSession() {
      try {
        const { user } = await api.getMe();
        setCurrentUser(user);
        
        // Fetch all clinic tables — pass role so fetchAllTables can gate requests
        await fetchAllTables(user?.role);
      } catch (e) {
        console.error('Failed to initiate current staff session.', e);
        setErrorString('Server unreachable: Check Express service start logs on Port 3000.');
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, []);

  // Background notifications polling every 30 seconds
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      api.getNotifications().then(data => setNotifications(data)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Fetch helper — only request data the current role is allowed to access
  const fetchAllTables = async (role?: string) => {
    const userRole = role ?? currentUser?.role;
    const isChiefOrAdmin = userRole === 'CHIEF_DOCTOR' || userRole === 'ADMINISTRATOR';

    try {
      const data = await api.getInit();
        setPatients(data.patients);
        setDoctors(data.doctors);
        setAppointments(data.appointments);
        setMedicalRecords(data.medicalRecords);
        setAttachments(data.attachments);
        setPayments(data.payments);
        setNotifications(data.notifications);
        if (isChiefOrAdmin) {
          setAuditLogs(data.auditLogs || []);
          setWorkSessions(data.workSessions || []);
        }
    } catch (e) {
      console.error('Failure reloading database indices.', e);
    }
  };

  // --- REACTION FLOW MUTATION HANDLERS ---

  const handleFormLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError('Пожалуйста, введите логин и пароль');
      return;
    }
    setLoading(true);
    setLoginError(null);
    try {
      const res = await api.login(loginUsername.trim(), loginPassword.trim());
      if (res.success) {
        setCurrentUser(res.user);
        await fetchAllTables(res.user.role);
        setActiveTab('dashboard');
        setLoginUsername('');
        setLoginPassword('');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Неверный логин или пароль');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await api.logout();
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Toggle procedures status from cards immediately — optimistic update
  const handleSetAppointmentStatus = useCallback(async (id: string, status: any) => {
    try {
      const updated = await api.updateAppointment(id, { status });
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a));
      // Also sync payments if status changed to Completed (background refresh)
      if (status === 'Completed') {
        api.getInit().then(data => {
          setPayments(data.payments);
          setNotifications(data.notifications);
        }).catch(() => {});
      }
    } catch (e: any) {
      alert(e.message || 'Validation conflict.');
    }
  }, []);

  const handleAddPatient = useCallback(async (p: Omit<Patient, 'id' | 'createdAt'>) => {
    const res = await api.createPatient(p);
    setPatients(prev => [res, ...prev]);
    return res;
  }, []);

  const handleUpdatePatient = useCallback(async (id: string, updated: Partial<Patient>) => {
    const res = await api.updatePatient(id, updated);
    setPatients(prev => prev.map(p => p.id === id ? { ...p, ...res } : p));
    return res;
  }, []);

  const handleDeletePatient = useCallback(async (id: string) => {
    await api.deletePatient(id);
    setPatients(prev => prev.filter(p => p.id !== id));
    setAppointments(prev => prev.filter(a => a.patientId !== id));
  }, []);

  const handleAddDoctor = useCallback(async (doc: Omit<Doctor, 'id' | 'status'>) => {
    const res = await api.createDoctor(doc);
    setDoctors(prev => [...prev, res].sort((a, b) => a.name.localeCompare(b.name)));
    return res;
  }, []);

  const handleDeleteDoctor = useCallback(async (id: string) => {
    await api.deleteDoctor(id);
    setDoctors(prev => prev.filter(d => d.id !== id));
  }, []);

  const handleAddAppointment = useCallback(async (apt: {
    patientId: string;
    doctorId: string;
    procedure: string;
    startTime: string;
    chairId: number;
    notes?: string;
    status?: string;
    paymentAmount?: number;
  }) => {
    try {
      const res = await api.createAppointment(apt);
      setAppointments(prev => [res, ...prev]);
      // If completed, refresh payments in background
      if (apt.status === 'Completed') {
        api.getInit().then(data => setPayments(data.payments)).catch(() => {});
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }, []);

  const handleUpdateAppointment = useCallback(async (id: string, dataset: any) => {
    try {
      const res = await api.updateAppointment(id, dataset);
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...res } : a));
      // If status changed to Completed, refresh payments in background
      if (dataset.status === 'Completed') {
        api.getInit().then(data => setPayments(data.payments)).catch(() => {});
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }, []);

  const handleDeleteAppointment = useCallback(async (id: string) => {
    await api.deleteAppointment(id);
    setAppointments(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleAddMedicalRecord = useCallback(async (record: Omit<MedicalRecord, 'id' | 'createdAt'>) => {
    const res = await api.createMedicalRecord(record);
    setMedicalRecords(prev => [res, ...prev]);
    return res;
  }, []);

  const handleUploadAttachment = useCallback(async (patientId: string, name: string, size: string, category: string, fileData: string) => {
    const res = await api.uploadAttachment(patientId, name, size, category, fileData);
    setAttachments(prev => [res, ...prev]);
    return res;
  }, []);

  const handleDeleteAttachment = useCallback(async (id: string) => {
    await api.deleteAttachment(id);
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleAddPayment = useCallback(async (payment: Omit<Payment, 'id' | 'createdAt'>) => {
    const res = await api.createPayment(payment);
    setPayments(prev => [res, ...prev]);
    return res;
  }, []);

  const handleMarkNotificationsRead = useCallback(async () => {
    await api.readAllNotifications();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // Jump selections from global search inputs
  const handleSearchSelectPatient = useCallback((patientId: string) => {
    setSelectedPatientIdFromSearch(patientId);
    setActiveTab('patients');
  }, []);

  const handleSearchSelectDate = (startTime: string) => {
    // Navigate straight to Calendar tab that defaults to active day view
    setActiveTab('calendar');
  };

  // Loading Indicator state
  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center font-display">
        <div className="flex items-center justify-center mb-6">
          <span className="text-4xl font-extrabold text-slate-800 tracking-tight font-display">
            Dent<span className="text-teal-500">Pro</span>
          </span>
        </div>
        <p className="text-xs font-semibold text-slate-800 tracking-tight">Accessing DentPro Clinic Cloud...</p>
        <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-mono">Loading data ledger</span>
      </div>
    );
  }

  // Server error warning
  if (errorString) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center font-display max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 mb-4 animate-bounce">
          <ServerCrash className="w-6 h-6" />
        </div>
        <h1 className="text-sm font-bold text-slate-900 tracking-tight">DentPro Clinic System Offline</h1>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{errorString}</p>
        <span className="text-[10px] text-slate-400 mt-3 uppercase font-mono font-bold bg-slate-200 px-2 py-0.5 rounded">PORT: 3000 REQUIRES START</span>
      </div>
    );
  }

  // Render Login overlay when session of practitioner is empty
  if (!currentUser) {
    return (
      <div className="h-screen w-screen bg-slate-50/50 flex flex-col items-center justify-center p-4 font-sans antialiased relative overflow-hidden">
        
        {/* Ambient clinical-tech visual background */}
        <div className="absolute top-[-15%] right-[-15%] w-[50%] h-[50%] rounded-full bg-teal-500/5 blur-3xl -z-10" />
        <div className="absolute bottom-[-15%] left-[-15%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-3xl -z-10" />

        <div className="bg-white border border-slate-100 p-8 rounded-[32px] max-w-md w-full shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
          <div className="flex flex-col items-center text-center mb-5">
            <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600 mb-4 shadow-sm">
              <Stethoscope className="w-6 h-6" />
            </div>
            <span className="text-3xl font-extrabold text-slate-950 tracking-tight font-display">
              Dent<span className="text-teal-600">Pro</span>
            </span>
          </div>

          <form onSubmit={handleFormLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl font-medium text-center animate-pulse">
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                Логин (Username)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => {
                    setLoginUsername(e.target.value);
                    setLoginError(null);
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white focus:ring-1 focus:ring-teal-500/20 rounded-2xl text-xs font-semibold text-slate-800 transition-all outline-hidden"
                  placeholder="Например: admin"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                Пароль (Password)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    setLoginError(null);
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white focus:ring-1 focus:ring-teal-500/20 rounded-2xl text-xs font-semibold text-slate-800 transition-all outline-hidden"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs transition-all shadow-md shadow-teal-600/10 hover:shadow-teal-600/20 active:scale-[0.98] cursor-pointer mt-2"
            >
              Войти в кабинет
            </button>
          </form>
        </div>

      </div>
    );
  }

  return (
    <div className="bg-slate-50/50 min-h-screen text-slate-600 font-sans antialiased flex items-stretch">
      
      {/* 1. SIDEBAR NAVIGATION CONSOLE */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLoginModal={() => {}}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* 2. WORKSTATION INNER WORKSPACE */}
      <main className="flex-1 flex flex-col min-h-screen w-full relative">
        
        {/* Dynamic header row with globalsearch indexes */}
        <Header
          currentUser={currentUser}
          patients={patients}
          doctors={doctors}
          appointments={appointments}
          notifications={notifications}
          onMarkNotificationsRead={handleMarkNotificationsRead}
          onSearchSelectPatient={handleSearchSelectPatient}
          onSearchSelectDate={handleSearchSelectDate}
          workSessions={workSessions}
          onClockIn={async (loc) => {
            const session = await api.clockIn(loc);
            setWorkSessions(prev => [session, ...prev]);
          }}
          onClockOut={async (loc) => {
            const session = await api.clockOut(loc);
            setWorkSessions(prev => prev.map(s => s.id === session.id ? session : s));
          }}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* Global tab sub-views */}
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><span className="text-xs text-slate-400">Загрузка...</span></div>}>
        <section className="p-6 md:p-8 flex-1 max-w-[1400px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              currentUser={currentUser}
              appointments={appointments}
              patients={patients}
              doctors={doctors}
              payments={payments}
              onSelectTab={setActiveTab}
              onSetAppointmentStatus={handleSetAppointmentStatus}
              onAddMedicalRecord={handleAddMedicalRecord}
              workSessions={workSessions}
              onClockIn={async (loc) => {
                const session = await api.clockIn(loc);
                setWorkSessions(prev => [session, ...prev]);
              }}
              onClockOut={async (loc) => {
                const session = await api.clockOut(loc);
                setWorkSessions(prev => prev.map(s => s.id === session.id ? session : s));
              }}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarSystem
              currentUser={currentUser}
              appointments={appointments}
              patients={patients}
              doctors={doctors}
              onAddAppointment={handleAddAppointment}
              onUpdateAppointment={handleUpdateAppointment}
              onDeleteAppointment={handleDeleteAppointment}
              workSessions={workSessions}
            />
          )}

          {activeTab === 'patients' && (
            <PatientManagement
              currentUser={currentUser}
              patients={patients}
              medicalRecords={medicalRecords}
              attachments={attachments}
              doctors={doctors}
              onAddPatient={handleAddPatient}
              onUpdatePatient={handleUpdatePatient}
              onAddMedicalRecord={handleAddMedicalRecord}
              onUploadAttachment={handleUploadAttachment}
              onDeleteAttachment={handleDeleteAttachment}
              onDeletePatient={handleDeletePatient}
              selectedPatientIdFromSearch={selectedPatientIdFromSearch}
              onClearSelectedPatientSearch={() => setSelectedPatientIdFromSearch(null)}
            />
          )}

          {activeTab === 'doctors' && (currentUser.role === 'CHIEF_DOCTOR' || currentUser.role === 'ADMINISTRATOR') && (
            <DoctorManagement
              currentUser={currentUser}
              doctors={doctors}
              appointments={appointments}
              payments={payments}
              onAddDoctor={handleAddDoctor}
              onDeleteDoctor={handleDeleteDoctor}
            />
          )}

          {activeTab === 'financials' && (currentUser.role === 'CHIEF_DOCTOR' || currentUser.role === 'DOCTOR') && (
            <FinancialAnalytics
              currentUser={currentUser}
              payments={payments}
              doctors={doctors}
              patients={patients}
              onAddPayment={handleAddPayment}
            />
          )}

          {activeTab === 'logs' && (currentUser.role === 'CHIEF_DOCTOR' || currentUser.role === 'ADMINISTRATOR') && (
            <SecurityAuditLogs auditLogs={auditLogs} />
          )}
        </section>
        </Suspense>

      </main>

    </div>
  );
}
