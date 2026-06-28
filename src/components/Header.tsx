/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { memo, useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  Bell, 
  X, 
  Sparkles, 
  Check, 
  Calendar, 
  User as UserIcon, 
  Scissors, 
  TrendingUp,
  Inbox,
  Clock,
  MapPin,
  Users,
  LogOut,
  Play,
  CheckCircle,
  Navigation,
  Map,
  Menu
} from 'lucide-react';
import { User, Patient, Doctor, Appointment, ClinicNotification, WorkSession } from '../types.js';

interface HeaderProps {
  currentUser: User | null;
  patients: Patient[];
  doctors: Doctor[];
  appointments: Appointment[];
  notifications: ClinicNotification[];
  onMarkNotificationsRead: () => void;
  onSearchSelectPatient: (patientId: string) => void;
  onSearchSelectDate: (startTime: string) => void;
  workSessions: WorkSession[];
  onClockIn: (location?: { latitude: number; longitude: number; accuracy?: number }) => Promise<void>;
  onClockOut: (location?: { latitude: number; longitude: number; accuracy?: number }) => Promise<void>;
  onToggleSidebar?: () => void;
}

function HeaderImpl({
  currentUser,
  patients,
  doctors,
  appointments,
  notifications,
  onMarkNotificationsRead,
  onSearchSelectPatient,
  onSearchSelectDate,
  workSessions,
  onClockIn,
  onClockOut,
  onToggleSidebar
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // --- Attendance Work Session states ---
  const [trackingGeo, setTrackingGeo] = useState(true);
  const [geoPending, setGeoPending] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [elapsedText, setElapsedText] = useState('00:00:00');



  const activeSession = useMemo(() => {
    if (!currentUser) return null;
    return workSessions.find(s => s.userId === currentUser.id && s.status === 'active') || null;
  }, [workSessions, currentUser]);

  // Compute live elapsed session duration
  useEffect(() => {
    if (!activeSession) {
      setElapsedText('00:00:00');
      return;
    }
    const interval = setInterval(() => {
      const diffMs = new Date().getTime() - new Date(activeSession.clockInTime).getTime();
      const hrs = Math.floor(diffMs / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      setElapsedText(
        `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    }, 1000);

    const diffMs = new Date().getTime() - new Date(activeSession.clockInTime).getTime();
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    setElapsedText(
      `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    );

    return () => clearInterval(interval);
  }, [activeSession]);

  const handleClockInAction = async () => {
    setGeoPending(true);
    setGeoError(null);
    
    if (trackingGeo && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await onClockIn({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
          } catch (e: any) {
            alert(`Ошибка: ${e.message}`);
          } finally {
            setGeoPending(false);
          }
        },
        async (err) => {
          console.warn('Geolocation failed', err);
          let reason = 'Геоданные недоступны или заблокированы.';
          if (err.code === 1) reason = 'Вы отклонили запрос на доступ к геолокации.';
          else if (err.code === 2) reason = 'Ваше местоположение временно недоступно.';
          else if (err.code === 3) reason = 'Истекло время ожидания координат.';
          
          setGeoError(reason);
          
          const confirmWithout = window.confirm(`${reason}\n\nХотите отметиться без геолокации?`);
          if (confirmWithout) {
            try {
              await onClockIn();
            } catch (e: any) {
              alert(`Ошибка: ${e.message}`);
            }
          }
          setGeoPending(false);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      try {
        await onClockIn();
      } catch (e: any) {
        alert(`Ошибка: ${e.message}`);
      } finally {
        setGeoPending(false);
      }
    }
  };

  const handleClockOutAction = async () => {
    setGeoPending(true);
    setGeoError(null);
    
    if (trackingGeo && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await onClockOut({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
          } catch (e: any) {
            alert(`Ошибка: ${e.message}`);
          } finally {
            setGeoPending(false);
          }
        },
        async (err) => {
          console.warn('Geolocation failed', err);
          let reason = 'Геоданные недоступны или заблокированы.';
          setGeoError(reason);
          
          const confirmWithout = window.confirm(`${reason}\n\nХотите завершить день без геолокации?`);
          if (confirmWithout) {
            try {
              await onClockOut();
            } catch (e: any) {
              alert(`Ошибка: ${e.message}`);
            }
          }
          setGeoPending(false);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      try {
        await onClockOut();
      } catch (e: any) {
        alert(`Ошибка: ${e.message}`);
      } finally {
        setGeoPending(false);
      }
    }
  };

  // Live Clock Updater
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false);
      }
      if (trackerRef.current && !trackerRef.current.contains(event.target as Node)) {
        setShowTrackerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadNotifs = notifications.filter(n => !n.read);

  // Search matches across: Patients, Doctors, Procedures, Scheduled Dates
  const matchedPatients = searchQuery.trim() === '' ? [] : patients.filter(p =>
    p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone.includes(searchQuery)
  );

  const matchedDoctors = searchQuery.trim() === '' ? [] : doctors.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const matchedAppointments = searchQuery.trim() === '' ? [] : appointments.filter(a => {
    const p = patients.find(pItem => pItem.id === a.patientId);
    return (
      a.procedure.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p && p.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }).slice(0, 5);

  const totalResultsCount = matchedPatients.length + matchedDoctors.length + matchedAppointments.length;

  return (
    <header className="h-16 border-b border-slate-100 bg-white/95 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          className="p-2 -ml-2 mr-2 hover:bg-slate-50 rounded-xl text-slate-500 hover:text-slate-800 transition-colors lg:hidden cursor-pointer flex items-center justify-center"
          title="Открыть меню"
        >
          <Menu className="w-5.5 h-5.5" />
        </button>
      )}
      
      {/* Search Bar matching Patients, Doctors, Appointments */}
      <div ref={searchRef} className="relative w-full max-w-[130px] xs:max-w-[180px] sm:max-w-xs md:max-w-md lg:w-96">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Глобальный поиск..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:bg-white transition-all cursor-text text-ellipsis whitespace-nowrap overflow-hidden"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Global Instant Results Panel */}
        {showSearchResults && searchQuery.trim() !== '' && (
          <div className="absolute top-13 left-0 w-full min-w-[280px] xs:w-[320px] sm:w-[420px] bg-white border border-slate-100 rounded-xl shadow-xl p-4 max-h-[480px] overflow-y-auto mt-1 animate-in fade-in slide-in-from-top-2 duration-150 z-50">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2 mb-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Результаты поиска ({totalResultsCount})</span>
              <button onClick={() => setShowSearchResults(false)} className="text-xs text-slate-400 hover:text-slate-600">Закрыть</button>
            </div>

            {totalResultsCount === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-slate-400">Совпадений не найдено для "{searchQuery}"</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Patients Search Matches */}
                {matchedPatients.length > 0 && (
                  <div>
                    <span className="text-[9px] font-semibold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-sm uppercase tracking-wider block mb-1.5 w-fit">Пациенты</span>
                    <div className="space-y-1">
                      {matchedPatients.map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            onSearchSelectPatient(p.id);
                            setShowSearchResults(false);
                            setSearchQuery('');
                          }}
                          className="w-full text-left p-2 hover:bg-slate-50 rounded-lg flex items-center justify-between group transition-all text-xs"
                        >
                          <div>
                            <p className="font-medium text-slate-800">{p.fullName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{p.phone}</p>
                          </div>
                          <span className="text-[10px] text-teal-600 opacity-0 group-hover:opacity-100 transition-all font-medium">Открыть карту &rarr;</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Doctors Search Matches */}
                {matchedDoctors.length > 0 && (
                  <div>
                    <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-sm uppercase tracking-wider block mb-1.5 w-fit">Врачи</span>
                    <div className="space-y-1">
                      {matchedDoctors.map(d => (
                        <div
                          key={d.id}
                          className="p-2 hover:bg-slate-50 rounded-lg flex items-center gap-2 text-xs"
                        >
                          <div className={`w-2 h-2 rounded-full bg-${d.color}-500`} />
                          <div>
                            <p className="font-medium text-slate-800">{d.name}</p>
                            <p className="text-[10px] text-slate-400">{d.specialty}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Appointments Search Matches */}
                {matchedAppointments.length > 0 && (
                  <div>
                    <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-sm uppercase tracking-wider block mb-1.5 w-fit">Приемы и процедуры</span>
                    <div className="space-y-1">
                      {matchedAppointments.map(a => {
                        const pat = patients.find(p => p.id === a.patientId);
                        const doc = doctors.find(d => d.id === a.doctorId);
                        const aptDate = new Date(a.startTime);
                        return (
                          <button
                            key={a.id}
                            onClick={() => {
                              onSearchSelectDate(a.startTime);
                              setShowSearchResults(false);
                              setSearchQuery('');
                            }}
                            className="w-full text-left p-2 hover:bg-slate-50 rounded-lg flex items-start justify-between group transition-all text-xs"
                          >
                            <div>
                              <p className="font-medium text-slate-800">
                                {pat ? pat.fullName : 'Не указан'} — {a.procedure}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {doc ? doc.name : 'Неизвестный врач'} • Стоматологическое кресло {a.chairId}
                              </p>
                              <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                                {aptDate.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric', year: 'numeric' })} @ {aptDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <span className="text-[10px] text-amber-600 opacity-0 group-hover:opacity-100 transition-all font-medium block shrink-0">Перейти к дню &rarr;</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Header info and alert bells */}
      <div className="flex items-center gap-2 sm:gap-6">
        
        <div className="text-right hidden sm:block">
          <p className="text-xs font-semibold text-slate-700 tracking-tight font-display">
            {currentTime.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="text-[10px] font-semibold text-teal-600 tracking-wider font-mono flex items-center justify-end gap-1.5 mt-0.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
            {currentTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>

        {/* Dynamic Alerts Banner */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => {
              setShowNotifDropdown(!showNotifDropdown);
            }}
            className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100/60 flex items-center justify-center text-slate-600 relative cursor-pointer"
          >
            <Bell className="w-4.5 h-4.5" />
            {unreadNotifs.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center animate-pulse">
                {unreadNotifs.length}
              </span>
            )}
          </button>

          {/* Trigger Alert List */}
          {showNotifDropdown && (
            <div className="absolute top-11 right-0 w-80 bg-white border border-slate-100 rounded-xl shadow-xl mt-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 font-sans z-50">
              <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider animate-pulse">Оповещения ({unreadNotifs.length} новые)</span>
                {unreadNotifs.length > 0 && (
                  <button
                    onClick={() => {
                      onMarkNotificationsRead();
                      setShowNotifDropdown(false);
                    }}
                    className="text-[10px] text-teal-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3 h-3" /> Прочитать все
                  </button>
                )}
              </div>

              <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-50">
                {notifications.length === 0 ? (
                  <div className="py-8 px-4 text-center">
                    <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs text-slate-400">В клинике всё спокойно.</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n.id} 
                      className={`p-3.5 transition-colors ${n.read ? 'bg-white opacity-70' : 'bg-teal-50/20'}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                          n.type === 'success' ? 'bg-emerald-500' :
                          n.type === 'warning' ? 'bg-amber-500' :
                          n.type === 'error' ? 'bg-red-500' : 'bg-sky-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium text-slate-800 ${!n.read ? 'font-semibold' : ''}`}>{n.title}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                          <span className="text-[9px] text-slate-400 block mt-1 font-mono">
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>


      </div>
    </header>
  );
}

export default memo(HeaderImpl);
