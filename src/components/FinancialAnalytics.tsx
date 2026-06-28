/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo, useState, useMemo, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { 
  DollarSign, 
  Plus, 
  Calendar, 
  FileCheck, 
  User as UserIcon, 
  TrendingUp, 
  Layers, 
  Lock, 
  CheckCircle,
  HelpCircle,
  Trash2
} from 'lucide-react';
import { Payment, Doctor, Patient, User, PROCEDURE_CONFIGS, ProcedureType, PaymentMethod } from '../types.js';

interface Expense {
  id: string;
  category: 'Materials' | 'Laboratory';
  amount: number;
  comment: string;
  date: string;
}

interface FinancialAnalyticsProps {
  currentUser: User | null;
  payments: Payment[];
  doctors: Doctor[];
  patients: Patient[];
  onAddPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => Promise<Payment>;
}

function FinancialAnalyticsImpl({
  currentUser,
  payments,
  doctors,
  patients,
  onAddPayment
}: FinancialAnalyticsProps) {

  const isChief = currentUser?.role === 'CHIEF_DOCTOR';
  const doctorId = currentUser?.doctorId;

  // Modals list
  const [isCashierModalOpen, setIsCashierModalOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'earnings' | 'expenses'>('earnings');

  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (payments && payments.length > 0) {
      try {
        const saved = localStorage.getItem('dentadmin_expenses');
        if (saved) {
          setExpenses(JSON.parse(saved));
        } else {
          setExpenses([
            { id: 'exp-1', category: 'Materials', amount: 45000, comment: 'Закупка пломбировочных материалов зуботехнических', date: '2026-05-28' },
            { id: 'exp-2', category: 'Laboratory', amount: 60000, comment: 'Изготовление металлокерамических коронок', date: '2026-05-29' }
          ]);
        }
      } catch {
        setExpenses([]);
      }
    } else {
      setExpenses([]);
      localStorage.removeItem('dentadmin_expenses');
    }
  }, [payments]);

  useEffect(() => {
    if (payments && payments.length > 0 && expenses.length > 0) {
      localStorage.setItem('dentadmin_expenses', JSON.stringify(expenses));
    }
  }, [expenses, payments]);

  // Expenses insertion form state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<'Materials' | 'Laboratory'>('Materials');
  const [expenseAmount, setExpenseAmount] = useState<number>(15000);
  const [expenseComment, setExpenseComment] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Cashier form state
  const [cashierPatientId, setCashierPatientId] = useState('');
  const [cashierDoctorId, setCashierDoctorId] = useState(isChief ? (doctors[0]?.id || '') : (doctorId || ''));
  const [cashierProcedure, setCashierProcedure] = useState<ProcedureType>('Consultation');
  const [cashierAmount, setCashierAmount] = useState<number>(50);
  const [cashierMethod, setCashierMethod] = useState<PaymentMethod>('Kaspi');
  const [cashierDate, setCashierDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [cashierNotes, setCashierNotes] = useState('');

  // 1. FILTER TRANS BASED ON RBAC
  const filteredPayments = useMemo(() => {
    if (isChief) return payments;
    return payments.filter(p => p.doctorId === doctorId);
  }, [payments, isChief, doctorId]);

  // Handle Procedure price autocomplete
  const handleProcedureChange = (pType: ProcedureType) => {
    setCashierProcedure(pType);
    const cost = PROCEDURE_CONFIGS[pType]?.estimatedPrice || 100;
    setCashierAmount(cost);
  };

  const handleCashierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierPatientId || !cashierDoctorId || cashierAmount <= 0) return;

    try {
      await onAddPayment({
        appointmentId: '',
        patientId: cashierPatientId,
        doctorId: cashierDoctorId,
        procedure: cashierProcedure,
        amountReceived: Number(cashierAmount),
        paymentMethod: cashierMethod,
        date: cashierDate,
        notes: cashierNotes
      });

      setIsCashierModalOpen(false);
      setCashierNotes('');
    } catch {
       alert('Failed to insert cash log');
     }
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount <= 0) return;
    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      category: expenseCategory,
      amount: Number(expenseAmount),
      comment: expenseComment.trim(),
      date: expenseDate
    };
    setExpenses(prev => [...prev, newExpense]);
    setIsExpenseModalOpen(false);
    setExpenseComment('');
    setExpenseAmount(15000);
  };

  const handleDeleteExpense = (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот расход?')) {
      setExpenses(prev => prev.filter(exp => exp.id !== id));
    }
  };

  const expensesTotal = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const materialsTotal = useMemo(() => {
    return expenses.filter(e => e.category === 'Materials').reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const laboratoryTotal = useMemo(() => {
    return expenses.filter(e => e.category === 'Laboratory').reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  // 2. CHART AGGREGATIONS
  
  // A. DAILY REVENUE ARCHIVE
  const dailyChartData = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    
    // Seed days surrounding May 30
    const seedDays = Array.from({length: 6}, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - 5 + i);
        return d.toISOString().split('T')[0];
      });
    seedDays.forEach(d => dailyMap[d] = 0);

    filteredPayments.forEach(p => {
      if (dailyMap[p.date] !== undefined) {
        dailyMap[p.date] += p.amountReceived;
      } else {
        // Only map May days for clean charts
        const curYM = new Date().toISOString().slice(0,7); if (p.date.startsWith(curYM)) {
          dailyMap[p.date] = p.amountReceived;
        }
      }
    });

    return Object.keys(dailyMap).sort().map(date => {
      const parts = date.split('-');
      return {
        label: `${parts[1]}/${parts[2]}`,
        'Revenue': dailyMap[date]
      };
    });
  }, [filteredPayments]);

  // B. REVENUE BY DOCTOR PIE
  const doctorPieData = useMemo(() => {
    if (!isChief) return []; // Staff can't see this stats logic!

    const doctorMap: Record<string, number> = {};
    doctors.forEach(d => doctorMap[d.name] = 0);

    payments.forEach(p => {
      const doc = doctors.find(d => d.id === p.doctorId);
      if (doc) {
        doctorMap[doc.name] += p.amountReceived;
      }
    });

    return Object.keys(doctorMap).map(name => ({
      name,
      value: doctorMap[name]
    })).filter(item => item.value > 0);
  }, [payments, doctors, isChief]);

  // C. REVENUE BY PROCEDURE BAR
  const procedureBarData = useMemo(() => {
    const procedureMap: Record<string, number> = {};
    
    filteredPayments.forEach(p => {
      procedureMap[p.procedure] = (procedureMap[p.procedure] || 0) + p.amountReceived;
    });

    return Object.keys(procedureMap).map(proc => ({
      procedure: proc.length > 12 ? `${proc.slice(0, 10)}.` : proc,
      'Income': procedureMap[proc]
    })).sort((a,b) => b['Income'] - a['Income']);
  }, [filteredPayments]);

  // Colors list for Pie
  const COLORS = ['#0d9488', '#4f46e5', '#10b981', '#f59e0b', '#3b82f6'];

  // Sum Stats
  const revenueTotal = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + p.amountReceived, 0);
  }, [filteredPayments]);

  const transactionsCount = filteredPayments.length;

  const paymentMethodStats = useMemo(() => {
    const methods: Record<string, number> = { Cash: 0, Card: 0, 'Bank_Transfer': 0, Kaspi: 0 };
    filteredPayments.forEach(p => {
      if (methods[p.paymentMethod] !== undefined) {
        methods[p.paymentMethod]++;
      }
    });
    return methods;
  }, [filteredPayments]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Metrics Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight font-display">Финансовый журнал и аудит платежей</h2>
          <p className="text-xs text-slate-400">
            {isChief ? 'Просмотр медицинских сборов по всем лечащим врачам.' : 'Отслеживайте свой личный доход от проведенных приемов.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
          <button
            onClick={() => {
              setCashierPatientId(patients[0]?.id || '');
              handleProcedureChange('Consultation');
              setIsCashierModalOpen(true);
            }}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95 hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> Внести платеж вручную
          </button>
          
          <button
            onClick={() => {
              setIsExpenseModalOpen(true);
            }}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95 hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> Внести расход
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* KPI: Total ledger */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Общая выручка</span>
            <span className="text-xl font-bold text-slate-800 font-display block">{revenueTotal.toLocaleString()} ₸</span>
            <p className="text-[9px] text-teal-600 font-semibold mt-0.5">В кассе от лечения</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        {/* KPI: Total expenses */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Общие расходы</span>
            <span className="text-xl font-bold text-slate-800 font-display block">{expensesTotal.toLocaleString()} ₸</span>
            <p className="text-[9px] text-rose-650 font-semibold mt-0.5">Материалы и лаб.</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <TrendingUp className="w-4 h-4 rotate-180" />
          </div>
        </div>

        {/* KPI: Net earnings */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Чистая прибыль</span>
            <span className="text-xl font-bold text-slate-850 font-display block">{(revenueTotal - expensesTotal).toLocaleString()} ₸</span>
            <p className="text-[9px] text-emerald-600 font-semibold mt-0.5">Прибыль за вычетом затрат</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle className="w-4 h-4" />
          </div>
        </div>

      </div>

      {/* Sub-tabs selector for layout view mode */}
      <div className="flex border-b border-slate-200 gap-6 mb-2">
        <button
          onClick={() => setActiveSubTab('earnings')}
          className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
            activeSubTab === 'earnings'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Доходы и аналитика
        </button>
        <button
          onClick={() => setActiveSubTab('expenses')}
          className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
            activeSubTab === 'expenses'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Внесение и учет расходов
        </button>
      </div>

      {activeSubTab === 'earnings' ? (
        <>
          {/* СВОДКА ЗАРАБОТКА (DOCTOR EARNINGS SUMMARY) - РАСЧЕТ И ОПЛАТА */}
          <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight font-display mb-3">
              {isChief ? 'Детализированный заработок врачей клиники' : 'Ваш подтвержденный финансовый заработок'}
            </h3>
            
            {isChief ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-600 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-2.5">Врач-специалист</th>
                      <th className="py-2.5 text-right">Накопленный доход</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {doctors.map(doc => {
                      const docEarnings = payments
                        .filter(p => p.doctorId === doc.id)
                        .reduce((sum, p) => sum + p.amountReceived, 0);

                      return (
                        <tr key={doc.id} className="hover:bg-slate-50/45 transition-colors">
                          <td className="py-3 font-semibold text-slate-800">{doc.name}</td>
                          <td className="py-3 font-mono font-bold text-teal-600 text-right text-sm">{docEarnings.toLocaleString()} ₸</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-teal-50/50 border border-teal-100 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600 font-bold font-mono">
                    ₸
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 leading-none">Личный отчет врача: <span className="font-semibold text-slate-700">{currentUser?.name}</span></p>
                    <p className="text-[10px] text-slate-405 mt-1">Отображается заработок на основе ваших завершенных приемов и оказанных услуг.</p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Ваш общий заработок</span>
                  <span className="text-xl font-mono font-bold text-teal-600">{revenueTotal.toLocaleString()} ₸</span>
                </div>
              </div>
            )}
          </div>

          {/* CHARTS CONTAINER GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Daily Revenue Distribution Line style Bar */}
            <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-xs">
              <div className="mb-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-display font-sans">Дневная выручка (за май)</h3>
                <p className="text-[10px] text-slate-400">Доходы в национальной валюте (Тенге)</p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChartData}>
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(v) => [`${v} ₸`, 'Доход']} />
                    <Bar dataKey="Revenue" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={35} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Dynamic Second Chart: PIE by Doctor (Admin) or BAR by Procedures (Doctor) */}
            {isChief ? (
              // Admin sees Multi-doctor allocations
              <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-xs">
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-display font-display">Распределение доходов по врачам</h3>
                  <p className="text-[10px] text-slate-400">Процент прибыли от общего объема клиники</p>
                </div>
                
                <div className="h-64 w-full flex flex-col sm:flex-row items-center justify-around gap-2">
                  <div className="w-48 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={doctorPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {doctorPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => [`${v} ₸`, 'Доход врача']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend details */}
                  <div className="space-y-2 text-xs">
                    {doctorPieData.map((item, index) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="font-semibold text-slate-700">{item.name}:</span>
                        <span className="text-slate-500 font-mono font-bold">{item.value.toLocaleString()} ₸</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              // General Doctor sees Procedures breakdown which blocks seeing other doctors!
              <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-xs">
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-display font-sans">Статистика доходов по процедурам</h3>
                  <p className="text-[10px] text-slate-400">Общие сборы за проведенное лечение</p>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={procedureBarData} layout="vertical">
                      <XAxis type="number" stroke="#94a3b8" fontSize={8} />
                      <YAxis type="category" dataKey="procedure" stroke="#94a3b8" fontSize={9} width={90} tickLine={false} />
                      <Tooltip formatter={(v) => [`${v} ₸`, 'Общая сумма']} />
                      <Bar dataKey="Income" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={15} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

          </div>

          {/* TABULAR LOG TRANSACTION SHEET */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs">
            <div className="border-b border-slate-50 pb-3 mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 tracking-tight font-display">Реестр выставленных счетов и оплат</h3>
                <p className="text-[11px] text-slate-400">Аудируемый журнал финансовых поступлений клиники</p>
              </div>
              
              {/* HIPAA statement label */}
              <span className="text-[9px] font-bold text-slate-400 tracking-wider">БЕЗОПАСНЫЙ ЦИФРОВОЙ РЕЕСТР</span>
            </div>

            <div className="overflow-x-auto">
              {filteredPayments.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-xs">Нет активных транзакций в финансовом реестре.</p>
                </div>
              ) : (
                <table className="w-full text-xs text-left text-slate-600 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-2.5">Дата оплаты</th>
                      <th className="py-2.5">Пациент</th>
                      <th className="py-2.5">Лечащий врач</th>
                      <th className="py-2.5">Тип процедуры</th>
                      <th className="py-2.5 text-right">Сумма проводимая</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredPayments.map(p => {
                      const pat = patients.find(patient => patient.id === p.patientId);
                      const doc = doctors.find(doctor => doctor.id === p.doctorId);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="py-3 font-mono font-medium text-slate-500">{p.date}</td>
                          <td className="py-3 font-bold text-slate-800">{pat ? pat.fullName : 'Гость'}</td>
                          <td className="py-3 text-[11px] text-slate-550 font-medium">{doc ? doc.name : 'Штат клиники'}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 text-slate-700 font-semibold rounded-md">
                              {p.procedure}
                            </span>
                          </td>
                          <td className="py-3 font-mono font-bold text-slate-800 text-right text-sm">{p.amountReceived.toLocaleString()} ₸</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {/* EXPENSES BREAKDOWN CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Расходные материалы</span>
                <p className="text-2xl font-bold text-rose-600 font-display mt-1">{materialsTotal.toLocaleString()} ₸</p>
                <p className="text-[10px] text-slate-400 mt-1">Композиты, боры, перчатки, анестезия и стоматологические инструменты</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 font-bold text-lg shrink-0">
                М
              </div>
            </div>

            <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Зуботехническая лаборатория</span>
                <p className="text-2xl font-bold text-fuchsia-600 font-display mt-1">{laboratoryTotal.toLocaleString()} ₸</p>
                <p className="text-[10px] text-slate-400 mt-1">Изготовление коронок, протезов, виниров, брекетов и капп</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-fuchsia-50 flex items-center justify-center text-fuchsia-500 font-bold text-lg shrink-0">
                Л
              </div>
            </div>
          </div>

          {/* EXPENSE TABLE CARD */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs">
            <div className="border-b border-slate-50 pb-3 mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 tracking-tight font-display">Журнал расходов клиники</h3>
                <p className="text-xs text-slate-400 font-sans">Аудируемый перечень стоматологических расходов</p>
              </div>
              
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                + Записать расход
              </button>
            </div>

            <div className="overflow-x-auto">
              {expenses.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-xs">Журнал расходов пуст. Нажмите «Записать расход» для внесения данных.</p>
                </div>
              ) : (
                <table className="w-full text-xs text-left text-slate-600 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-2.5">Дата расхода</th>
                      <th className="py-2.5">Категория</th>
                      <th className="py-2.5">Комментарий / Описание расходов</th>
                      <th className="py-2.5 text-right">Сумма расхода</th>
                      <th className="py-2.5 text-center">Действие</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {[...expenses].sort((a, b) => b.date.localeCompare(a.date)).map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 font-mono text-slate-500">{exp.date}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            exp.category === 'Materials' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100'
                          }`}>
                            {exp.category === 'Materials' ? 'Материалы' : 'Лаборатория'}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-700 max-w-md break-words pr-4 font-sans">
                          {exp.comment || <span className="text-slate-300 italic">Комментарий отсутствует</span>}
                        </td>
                        <td className="py-2.5 font-mono font-bold text-rose-600 text-right text-sm">
                          {exp.amount.toLocaleString()} ₸
                        </td>
                        <td className="py-2.5 text-center">
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-all cursor-pointer inline-flex items-center"
                            title="Удалить запись"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ADD PAYMENT CASHIER MODAL --- */}
      {isCashierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleCashierSubmit}
            className="bg-white rounded-3xl max-w-md w-full border border-slate-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
          >
            
            <div className="p-6 pb-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-teal-600" />
                <h3 className="text-sm font-semibold text-slate-800 tracking-tight font-display">Регистрация оплаты клиента</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCashierModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Закрыть
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto">
              
              {/* Select Patient */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Пациент *</label>
                <select
                  value={cashierPatientId}
                  onChange={(e) => setCashierPatientId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden"
                  required
                >
                  <option value="" disabled>-- Выберите пациента из реестра --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.fullName} ({p.phone})</option>
                  ))}
                </select>
              </div>

              {/* Select Doctor Specialist */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Лечащий врач *</label>
                <select
                  value={cashierDoctorId}
                  onChange={(e) => setCashierDoctorId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden"
                  required
                  disabled={!isChief}
                >
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>
                  ))}
                </select>
              </div>

              {/* Select Procedure */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Процедура *</label>
                <select
                  value={cashierProcedure}
                  onChange={(e) => handleProcedureChange(e.target.value as ProcedureType)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden"
                >
                  {Object.keys(PROCEDURE_CONFIGS).map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              {/* Payment details Amount */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Сумма к оплате (₸) *</label>
                <input
                  type="number"
                  value={cashierAmount}
                  onChange={(e) => setCashierAmount(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden font-semibold font-mono"
                  required
                  min={1}
                />
              </div>

              {/* Fee Date */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Дата платежа</label>
                <input
                  type="date"
                  value={cashierDate}
                  onChange={(e) => setCashierDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden font-mono"
                />
              </div>

            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCashierModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
              >
                Провести чек
              </button>
            </div>

          </form>
        </div>
      )}

      {/* --- ADD EXPENSE MODAL --- */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleExpenseSubmit}
            className="bg-white rounded-3xl max-w-md w-full border border-slate-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
          >
            
            <div className="p-6 pb-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-rose-600 rotate-180" />
                <h3 className="text-sm font-semibold text-slate-800 tracking-tight font-display">Внесение расходов клиники</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Закрыть
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto">
              
              {/* Category selector */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Категория расхода *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpenseCategory('Materials')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      expenseCategory === 'Materials'
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100/50'
                    }`}
                  >
                    Материалы
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseCategory('Laboratory')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      expenseCategory === 'Laboratory'
                        ? 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700'
                        : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100/50'
                    }`}
                  >
                    Лаборатория
                  </button>
                </div>
              </div>

              {/* Amount input */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Сумма затрат (₸) *</label>
                <input
                  type="number"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden font-semibold font-mono"
                  required
                  min={1}
                />
              </div>

              {/* Comment field */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Комментарий / Описание *</label>
                <textarea
                  value={expenseComment}
                  onChange={(e) => setExpenseComment(e.target.value)}
                  placeholder="Заполните описание (например: закупка шприцев, оплата за слепки и т.д.)"
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden font-sans h-20 resize-none"
                  required
                />
              </div>

              {/* Date */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Дата транзакции</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden font-mono"
                />
              </div>

            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
              >
                Записать расход
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}

export default memo(FinancialAnalyticsImpl);
