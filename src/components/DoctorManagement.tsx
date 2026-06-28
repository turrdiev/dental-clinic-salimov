/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo, useState, useMemo } from 'react';
import { 
  Stethoscope, 
  Plus, 
  Trash2, 
  Mail, 
  Phone, 
  UserCheck, 
  Award, 
  TrendingUp, 
  Calendar, 
  Activity, 
  PlusCircle, 
  X, 
  Users, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { Doctor, Appointment, Payment, User } from '../types.js';

interface DoctorManagementProps {
  currentUser: User | null;
  doctors: Doctor[];
  appointments: Appointment[];
  payments: Payment[];
  onAddDoctor: (doc: Omit<Doctor, 'id' | 'status'>) => Promise<Doctor>;
  onDeleteDoctor: (id: string) => Promise<void>;
}

function DoctorManagementImpl({
  currentUser,
  doctors,
  appointments,
  payments,
  onAddDoctor,
  onDeleteDoctor
}: DoctorManagementProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const hideFinances = currentUser?.role === 'ADMINISTRATOR';

  // Form states
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [color, setColor] = useState('teal');

  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');

  const colors = [
    { value: 'teal', label: 'Бирюзовый (Teal)', bg: 'bg-teal-500' },
    { value: 'sky', label: 'Голубой (Sky)', bg: 'bg-sky-500' },
    { value: 'emerald', label: 'Зеленый (Emerald)', bg: 'bg-emerald-500' },
    { value: 'indigo', label: 'Синий (Indigo)', bg: 'bg-indigo-500' },
    { value: 'violet', label: 'Фиолетовый (Violet)', bg: 'bg-violet-500' },
    { value: 'amber', label: 'Янтарный (Amber)', bg: 'bg-amber-500' },
    { value: 'rose', label: 'Розовый (Rose)', bg: 'bg-rose-500' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setSuccessText('');
    
    if (!name.trim()) {
      setErrorText('ФИО врача обязательно для заполнения');
      return;
    }
    if (!specialty.trim()) {
      setErrorText('Специальность обязательна для заполнения');
      return;
    }

    try {
      await onAddDoctor({
        name: name.trim(),
        specialty: specialty.trim(),
        email: email.trim(),
        phone: phone.trim(),
        color
      });
      
      setSuccessText('Врач успешно добавлен!');
      setName('');
      setSpecialty('');
      setEmail('');
      setPhone('');
      setColor('teal');
      
      setTimeout(() => {
        setIsAddModalOpen(false);
        setSuccessText('');
      }, 1000);
    } catch (err: any) {
      setErrorText(err.message || 'Ошибка добавления врача');
    }
  };

  const handleDelete = async (id: string, docName: string) => {
    const confirmed = window.confirm(`Вы уверены, что хотите удалить врача "${docName}" и все связанные записи?`);
    if (confirmed) {
      try {
        await onDeleteDoctor(id);
        if (selectedDoctorId === id) {
          setSelectedDoctorId(null);
        }
      } catch (err: any) {
        alert(err.message || 'Ошибка при удалении врача');
      }
    }
  };

  // Doctors statistics / monitoring
  const doctorStats = useMemo(() => {
    const stats: Record<string, {
      totalVisits: number;
      completedVisits: number;
      upcomingVisits: number;
      revenue: number;
    }> = {};

    doctors.forEach(d => {
      stats[d.id] = {
        totalVisits: 0,
        completedVisits: 0,
        upcomingVisits: 0,
        revenue: 0
      };
    });

    appointments.forEach(apt => {
      if (stats[apt.doctorId]) {
        stats[apt.doctorId].totalVisits++;
        if (apt.status === 'Completed') {
          stats[apt.doctorId].completedVisits++;
        } else if (apt.status === 'Scheduled' || apt.status === 'In_Progress') {
          stats[apt.doctorId].upcomingVisits++;
        }
      }
    });

    payments.forEach(pay => {
      if (stats[pay.doctorId]) {
        stats[pay.doctorId].revenue += pay.amountReceived;
      }
    });

    return stats;
  }, [doctors, appointments, payments]);

  // Overall statistics for summary highlights
  const totalCompletedAppointments = useMemo(() => {
    return appointments.filter(a => a.status === 'Completed').length;
  }, [appointments]);

  const activeDoc = useMemo(() => {
    return doctors.find(d => d.id === selectedDoctorId) || null;
  }, [doctors, selectedDoctorId]);

  return (
    <div className="space-y-6">
      {/* Page header and controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight font-sans">Управление медицинским персоналом</h2>
          <p className="text-xs text-slate-500 mt-1">Добавление, удаление врачей и контроль их загруженности, графиков и финансовых показателей.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer select-none shrink-0"
        >
          <Plus className="w-4 h-4" /> Добавить врача
        </button>
      </div>

      {/* Summary Highlight Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-100 p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Штат клиники</span>
            <span className="text-2xl font-bold font-display text-slate-800 block">{doctors.length} врачей</span>
            <span className="text-[10px] text-teal-600 font-medium">Активный сертифицированный персонал</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
            <Stethoscope className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Обработано приемов</span>
            <span className="text-2xl font-bold font-display text-slate-800 block">{totalCompletedAppointments} приемов</span>
            <span className="text-[10px] text-emerald-600 font-medium">Завершенные процедуры лечения</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Doctors Grid/List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-150/60 rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-slate-50/70 p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Зарегистрированные специалисты</span>
              <span className="text-[10px] font-semibold text-slate-400">Нажмите на врача для мониторинга</span>
            </div>

            <div className="divide-y divide-slate-100">
              {doctors.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Нет добавленных врачей.
                </div>
              ) : (
                doctors.map(doc => {
                  const stats = doctorStats[doc.id] || { totalVisits: 0, completedVisits: 0, upcomingVisits: 0, revenue: 0 };
                  const isSelected = selectedDoctorId === doc.id;
                  
                  return (
                    <div 
                      key={doc.id}
                      onClick={() => setSelectedDoctorId(doc.id)}
                      className={`p-4 flex flex-col xs:flex-row xs:items-center justify-between gap-3 xs:gap-4 transition-all hover:bg-slate-50/50 cursor-pointer ${
                        isSelected ? 'bg-teal-50/30 border-l-4 border-teal-500' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 w-full xs:w-auto">
                        {/* Dynamic initials logo badge */}
                        <div className="w-10 h-10 rounded-full relative flex items-center justify-center font-bold text-white text-xs shrink-0 select-none font-display uppercase border border-white shadow-xs" style={{ backgroundColor: doc.color === 'rose' ? '#f43f5e' : doc.color === 'sky' ? '#0ea5e9' : doc.color === 'emerald' ? '#10b981' : doc.color === 'indigo' ? '#6366f1' : doc.color === 'violet' ? '#8b5cf6' : doc.color === 'amber' ? '#f59e0b' : '#14b8a6' }}>
                          {doc.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white bg-emerald-500" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 leading-tight font-sans hover:text-teal-600">{doc.name}</h4>

                        </div>
                      </div>

                      <div className="flex items-center justify-between xs:justify-end gap-4 xs:gap-6 shrink-0 w-full xs:w-auto border-t xs:border-t-0 pt-2.5 xs:pt-0 mt-1 xs:mt-0">
                        {!hideFinances && (
                          <div className="hidden sm:flex flex-col text-right">
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Выручка</span>
                            <span className="text-xs font-bold font-mono text-slate-800">
                              {stats.revenue.toLocaleString()} ₸
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col text-left xs:text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Приемы</span>
                          <span className="text-xs font-bold text-slate-700">
                            {stats.completedVisits} заверш / {stats.upcomingVisits} заплан
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(doc.id, doc.name);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer ml-auto xs:ml-0"
                          title="Удалить профиль"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Control & Monitoring Dashboard */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-150/60 rounded-2xl overflow-hidden shadow-xs p-5">
            {!activeDoc ? (
              <div className="py-12 text-center">
                <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2 animate-pulse" />
                <h5 className="text-xs font-bold text-slate-700">Выберите врача для мониторинга</h5>
                <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
                  Здесь отображается статистика врачебного времени, выручка, показатели удовлетворенности и будущие загрузки.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Монитор показателей</h3>
                    <h4 className="text-sm font-bold text-slate-800 mt-0.5">{activeDoc.name}</h4>
                  </div>

                </div>

                {/* Email / Phone card */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5 text-xs text-slate-600">
                  <p className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {activeDoc.email || 'Почта не указана'}
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {activeDoc.phone || 'Телефон не указан'}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-white shadow-xs" style={{ backgroundColor: activeDoc.color === 'rose' ? '#f43f5e' : activeDoc.color === 'sky' ? '#0ea5e9' : activeDoc.color === 'emerald' ? '#10b981' : activeDoc.color === 'indigo' ? '#6366f1' : activeDoc.color === 'violet' ? '#8b5cf6' : activeDoc.color === 'amber' ? '#f59e0b' : '#14b8a6' }} />
                    <span>Цвет в календаре: <strong className="capitalize">{activeDoc.color}</strong></span>
                  </p>
                </div>

                {/* Financial KPI stats */}
                <div className="grid grid-cols-2 gap-3.5 pt-1">
                  {!hideFinances && (
                    <div className="bg-teal-50/20 border border-teal-100/30 p-3 rounded-xl">
                      <span className="text-[9px] font-bold text-teal-600 uppercase tracking-wider block">Выручка врача</span>
                      <span className="text-sm font-bold font-mono text-teal-700 mt-1 block">
                        {((doctorStats[activeDoc.id]?.revenue) || 0).toLocaleString()} ₸
                      </span>
                    </div>
                  )}
                  <div className={`bg-amber-50/20 border border-amber-100/30 p-3 rounded-xl ${hideFinances ? 'col-span-2' : ''}`}>
                    <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block">Индекс приемов</span>
                    <span className="text-sm font-bold text-slate-800 mt-1 block">
                      {(doctorStats[activeDoc.id]?.totalVisits) || 0} контактов
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-50 pb-1">Загрузка врача</span>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-500">Завершенные приемы (Лечение):</span>
                      <span className="text-slate-800">{doctorStats[activeDoc.id]?.completedVisits}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-500">Запланировано (Предстоящие):</span>
                      <span className="text-slate-800 text-teal-600">{doctorStats[activeDoc.id]?.upcomingVisits}</span>
                    </div>
                  </div>
                </div>

                {/* Doctor active agenda queue list preview */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Calendar className="w-3 h-3 text-teal-500" /> Ближайшие в графике</span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {appointments.filter(a => a.doctorId === activeDoc.id && a.status === 'Scheduled').slice(0, 4).length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">Нет запланированных приемов на ближайшие дни.</p>
                    ) : (
                      appointments.filter(a => a.doctorId === activeDoc.id && a.status === 'Scheduled').slice(0, 4).map(apt => (
                        <div key={apt.id} className="p-2 border border-slate-50 rounded-lg bg-slate-50/50 text-[10px] flex items-center justify-between gap-2">
                          <div>
                            <span className="font-semibold text-slate-700 block">{new Date(apt.startTime).toLocaleDateString('ru-RU')} в {new Date(apt.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="text-slate-400 block mt-0.5">Код записи: {apt.id}</span>
                          </div>
                          <span className="text-teal-600 font-bold bg-teal-50 px-1 py-0.2 rounded shrink-0">{apt.procedure}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add New Doctor Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-white border border-slate-100 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-teal-500" /> Добавление специалиста
              </span>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorText && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorText}</span>
              </div>
            )}

            {successText && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successText}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 pt-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">ФИО Врача *</label>
                <input
                  type="text"
                  required
                  placeholder="Д-р Алия Нургалиева"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-150 py-2 px-3 rounded-xl text-xs font-medium focus:outline-hidden focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Специализация *</label>
                <input
                  type="text"
                  required
                  placeholder="Терапевт, Ортодонт, Имплантолог"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-150 py-2 px-3 rounded-xl text-xs font-medium focus:outline-hidden focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="example@clinic.kz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-150 py-2 px-3 rounded-xl text-xs focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Телефон</label>
                  <input
                    type="tel"
                    placeholder="+7 (707) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-150 py-2 px-3 rounded-xl text-xs focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Цветовой маркер в календаре</label>
                <div className="grid grid-cols-1 gap-2">
                  <select
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-150 py-2 px-3 rounded-xl text-xs focus:outline-hidden focus:border-teal-500 focus:bg-white capitalize"
                  >
                    {colors.map(col => (
                      <option key={col.value} value={col.value}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(DoctorManagementImpl);
