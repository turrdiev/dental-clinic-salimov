/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  DollarSign, 
  ShieldCheck, 
  LogOut, 
  Stethoscope,
  Activity,
  X
} from 'lucide-react';
import { User } from '../types.js';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User | null;
  onLogout: () => void;
  onOpenLoginModal: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
  onOpenLoginModal,
  isOpen = false,
  onClose
}: SidebarProps) {
  
  const isChief = currentUser?.role === 'CHIEF_DOCTOR';
  const role = currentUser?.role;

  const menuItems = [
    { id: 'dashboard', label: 'Панель управления', icon: LayoutDashboard },
    { id: 'calendar', label: 'Календарь приемов', icon: CalendarDays },
    { id: 'patients', label: 'Реестр пациентов', icon: Users },
    ...(role === 'CHIEF_DOCTOR' || role === 'DOCTOR' ? [{ id: 'financials', label: 'Финансы и отчеты', icon: DollarSign }] : []),
    ...(role === 'CHIEF_DOCTOR' || role === 'ADMINISTRATOR' ? [{ id: 'doctors', label: 'Управление врачами', icon: Stethoscope }] : [])
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden transition-all duration-300"
          onClick={onClose}
        />
      )}

      <aside className={`w-64 bg-slate-900 text-slate-100 flex flex-col h-screen shrink-0 shadow-lg select-none z-50 transition-transform duration-300 ease-in-out fixed lg:relative lg:sticky lg:top-0 inset-y-0 left-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Brand Logo header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <span className="text-2xl font-black text-white tracking-wider font-display">
            Dent<span className="text-teal-400">Pro</span>
          </span>
          {/* Mobile close button */}
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1 lg:hidden hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-4 py-8 space-y-1.5 overflow-y-auto">
          <span className="px-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Главная консоль</span>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  onClose?.();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20 translate-x-1'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 text-left">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white block animate-ping" />
                )}
              </button>
            );
          })}
        </nav>

      {/* User profile footer controls */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/45">
        <div className="p-3.5 bg-slate-800/60 border border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/15 flex items-center justify-center font-bold text-xs text-teal-400 font-display">
              {currentUser?.name.split(' ').map(n => n[0]).join('') || 'ВР'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate leading-tight font-display">{currentUser?.name}</p>
              <p className="text-[9px] font-bold text-teal-400 uppercase tracking-wider block mt-0.5">
                {currentUser?.role === 'CHIEF_DOCTOR' ? 'Гл. Врач (Админ)' : currentUser?.role === 'ADMINISTRATOR' ? 'Администратор' : 'Врач'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-slate-800/80">
            <button
              onClick={onLogout}
              className="text-[10px] text-red-400 hover:text-red-350 cursor-pointer flex items-center gap-1.5 font-bold transition-all duration-150"
              title="Выход"
            >
              <LogOut className="w-3.5 h-3.5" /> Выйти из системы
            </button>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}
