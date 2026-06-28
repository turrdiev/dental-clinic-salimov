/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo, useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  FileText, 
  Upload, 
  Phone, 
  MapPin, 
  Calendar, 
  User as UserIcon, 
  Stethoscope, 
  Trash2, 
  Activity, 
  Paperclip,
  Download,
  AlertCircle,
  Clock,
  ArrowLeft,
  X,
  PlusCircle,
  Eye
} from 'lucide-react';
import { 
  Patient, 
  MedicalRecord, 
  AttachmentFile, 
  Doctor, 
  User,
  PROCEDURE_CONFIGS,
  ProcedureType,
  PROCEDURE_LABELS_RU
} from '../types.js';

interface PatientManagementProps {
  currentUser: User | null;
  patients: Patient[];
  medicalRecords: MedicalRecord[];
  attachments: AttachmentFile[];
  doctors: Doctor[];
  onAddPatient: (patient: Omit<Patient, 'id' | 'createdAt'>) => Promise<Patient>;
  onUpdatePatient: (id: string, updated: Partial<Patient>) => Promise<Patient>;
  onAddMedicalRecord: (record: Omit<MedicalRecord, 'id' | 'createdAt'>) => Promise<MedicalRecord>;
  onUploadAttachment: (patientId: string, name: string, size: string, category: string, fileData: string) => Promise<AttachmentFile>;
  onDeleteAttachment: (id: string) => void;
  onDeletePatient: (id: string) => Promise<void>;
  selectedPatientIdFromSearch?: string | null;
  onClearSelectedPatientSearch?: () => void;
}

function PatientManagementImpl({
  currentUser,
  patients,
  medicalRecords,
  attachments,
  doctors,
  onAddPatient,
  onUpdatePatient,
  onAddMedicalRecord,
  onUploadAttachment,
  onDeleteAttachment,
  onDeletePatient,
  selectedPatientIdFromSearch,
  onClearSelectedPatientSearch
}: PatientManagementProps) {

  const isChief = currentUser?.role === 'CHIEF_DOCTOR';
  const doctorId = currentUser?.doctorId;

  // Selected Patient for detailed profile sheet
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  
  // Modals list
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);

  // Search filter
  const [searchText, setSearchText] = useState('');

  // New Patient Form state
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newBirthDate, setNewBirthDate] = useState('1990-01-01');
  const [newGender, setNewGender] = useState<'Male' | 'Female' | 'Other'>('Female');
  const [newAddress, setNewAddress] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // New Medical Record Form state
  const [recordComplaints, setRecordComplaints] = useState('');
  const [recordSymptoms, setRecordSymptoms] = useState('');
  const [recordDiagnosis, setRecordDiagnosis] = useState('');
  const [recordPlan, setRecordPlan] = useState('');
  const [recordProcedures, setRecordProcedures] = useState<string[]>([]);
  const [recordPrescriptions, setRecordPrescriptions] = useState('');
  const [recordDoctorId, setRecordDoctorId] = useState(isChief ? (doctors[0]?.id || '') : (doctorId || ''));

  // Support search jump request from header!
  useMemo(() => {
    if (selectedPatientIdFromSearch) {
      setSelectedPatientId(selectedPatientIdFromSearch);
      if (onClearSelectedPatientSearch) onClearSelectedPatientSearch();
    }
  }, [selectedPatientIdFromSearch]);

  // Handle local state filter
  const filteredPatients = useMemo(() => {
    if (searchText.trim() === '') return patients;
    return patients.filter(p =>
      p.fullName.toLowerCase().includes(searchText.toLowerCase()) ||
      p.phone.includes(searchText) ||
      p.address.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [patients, searchText]);

  // Selected patient details structure
  const activePatient = useMemo(() => {
    if (!selectedPatientId) return null;
    return patients.find(p => p.id === selectedPatientId) || null;
  }, [patients, selectedPatientId]);

  const handleDeletePatient = async (id: string, name: string) => {
    const isConfirmed = window.confirm(`Вы уверены, что хотите БЕЗВОЗВРАТНО удалить карту пациента "${name}"?\nВсе медицинские записи, приемы и сопутствующие данные будут стерты!`);
    if (isConfirmed) {
      try {
        await onDeletePatient(id);
        setSelectedPatientId(null);
      } catch (err: any) {
        alert("Не удалось завершить удаление пациента: " + (err.message || err));
      }
    }
  };

  const activeRecords = useMemo(() => {
    if (!selectedPatientId) return [];
    return medicalRecords.filter(r => r.patientId === selectedPatientId);
  }, [medicalRecords, selectedPatientId]);

  const activeFiles = useMemo(() => {
    if (!selectedPatientId) return [];
    return attachments.filter(a => a.patientId === selectedPatientId);
  }, [attachments, selectedPatientId]);

  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName || !newPhone) return;
    const btn = (e.currentTarget as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement;
    if (btn) btn.disabled = true;
    

    try {
      const p = await onAddPatient({
        fullName: newFullName,
        phone: newPhone,
        birthDate: newBirthDate,
        gender: newGender,
        address: newAddress,
        notes: newNotes
      });
      setIsNewPatientModalOpen(false);
      setSelectedPatientId(p.id); // auto open profile card!
      
      // Reset form
      setNewFullName('');
      setNewPhone('');
      setNewAddress('');
      setNewNotes('');
    } catch (e) {
      alert('Ошибка при регистрации пациента.');
    }
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !recordDiagnosis) return;

    try {
      await onAddMedicalRecord({
        patientId: selectedPatientId,
        doctorId: recordDoctorId || (doctors[0]?.id || ''),
        complaints: recordComplaints,
        symptoms: recordSymptoms,
        diagnosis: recordDiagnosis,
        treatmentPlan: recordPlan,
        proceduresPerformed: recordProcedures,
        prescriptions: recordPrescriptions,
        date: new Date().toISOString().split('T')[0]
      });

      setIsAddRecordModalOpen(false);
      
      // Reset Record
      setRecordComplaints('');
      setRecordSymptoms('');
      setRecordDiagnosis('');
      setRecordPlan('');
      setRecordPrescriptions('');
      setRecordProcedures([]);
    } catch (e) {
      alert('Не удалось добавить клиническую запись.');
    }
  };

  // Base64 file converter emulator
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files;
    if (!filesList || filesList.length === 0 || !selectedPatientId) return;

    const file = filesList[0];
    const sizeFormatted = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    
    // Choose file category dynamically based on extension
    let category: 'X-Ray' | 'CT Scan' | 'Photo' | 'PDF' | 'Report' = 'Photo';
    if (file.name.endsWith('.pdf')) category = 'PDF';
    else if (file.name.includes('ct') || file.name.includes('scan')) category = 'CT Scan';
    else if (file.name.includes('xray') || file.name.includes('pan')) category = 'X-Ray';
    else if (file.name.endsWith('.txt') || file.name.endsWith('.doc')) category = 'Report';

    // Base64 Read
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;
      try {
        await onUploadAttachment(selectedPatientId, file.name, sizeFormatted, category, base64Data);
      } catch (e) {
        alert('Размер файла превышает допустимый лимит загрузки.');
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleProcedureInRecordForm = (procName: string) => {
    if (recordProcedures.includes(procName)) {
      setRecordProcedures(recordProcedures.filter(p => p !== procName));
    } else {
      setRecordProcedures([...recordProcedures, procName]);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 font-sans">
      
      {/* 1. LIST SCREEN (WHEN NO PATIENT SELECT) OR MAIN REGISTRY */}
      {!activePatient ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight font-display">Реестр амбулаторных карт</h2>
              <p className="text-xs text-slate-400">Поиск и управление картами пациентов, клинической историей, диагнозами и снимками (КТ/Рентген).</p>
            </div>
            
            <button
              onClick={() => setIsNewPatientModalOpen(true)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all self-start"
            >
              <Plus className="w-4 h-4" /> Новый пациент
            </button>
          </div>

          {/* Table / Grid with search bar input */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs">
            <div className="relative w-full max-w-md mb-6">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск по ФИО пациента, номеру телефона, адресу..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:bg-white transition-all cursor-text"
              />
            </div>

            {filteredPatients.length === 0 ? (
              <div className="py-16 text-center">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Записи о пациентах не обнаружены.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredPatients.map(p => {
                  const recordCount = medicalRecords.filter(r => r.patientId === p.id).length;
                  const docCount = attachments.filter(a => a.patientId === p.id).length;
                  
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPatientId(p.id)}
                      className="border border-slate-100 rounded-2xl p-5 hover:border-teal-400/80 hover:shadow-md transition-all cursor-pointer bg-white flex flex-col justify-between group"
                    >
                      <div>
                        {/* Name & Gender Icon details */}
                        <div className="flex items-start justify-between gap-2.5 mb-3">
                          <div>
                            <h3 className="font-bold text-slate-800 text-sm tracking-tight group-hover:text-teal-600 transition-colors font-sans">
                              {p.fullName}
                            </h3>
                            <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400">
                              МЕД. КАРТА #{p.id.toUpperCase().substring(0, 8)}
                            </span>
                          </div>
                          
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            p.gender === 'Male' ? 'bg-sky-50 text-sky-700' :
                            p.gender === 'Female' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {p.gender === 'Male' ? 'Мужской' : p.gender === 'Female' ? 'Женский' : 'Другой'}
                          </span>
                        </div>

                        {/* Direct coordinates metadata lines */}
                        <div className="space-y-1.5 text-xs text-slate-500 mb-4 pt-2 border-t border-slate-50">
                          <p className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400" /> {p.phone}
                          </p>
                          <p className="flex items-center gap-2 truncate">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" /> {p.address}
                          </p>
                          <p className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" /> ДР: {new Date(p.birthDate).toLocaleDateString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      {/* Footer tags counts indicators */}
                      <div className="flex items-center justify-between text-[10px] pt-3 border-t border-slate-50 font-medium text-slate-400 w-full">
                        <span className="bg-slate-50 px-2 py-1 rounded-md">Клинических записей: {recordCount}</span>
                        <span className="bg-slate-50 px-2 py-1 rounded-md">Снимков/файлов: {docCount}</span>
                        <span className="text-teal-600 font-bold group-hover:translate-x-1 transition-all">Открыть &rarr;</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        
        // 2. DETAILED CLIENT SHEET WORKSTATION (IF PATIENT SELECTED)
        <div className="space-y-6">
          
          {/* Back Navigation header ribbon */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedPatientId(null)}
                className="p-1 px-3 bg-white border border-slate-100 hover:bg-slate-50 text-slate-500 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <ArrowLeft className="w-4 h-4" /> Вернуться в реестр
              </button>
              <span className="text-xs text-slate-400">/ Электронная медкарта /</span>
              <span className="text-xs font-bold font-mono text-slate-800 uppercase bg-slate-50 px-2 py-0.5 rounded">{activePatient.fullName}</span>
            </div>

            <button
              onClick={() => handleDeletePatient(activePatient.id, activePatient.fullName)}
              className="p-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-650 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border border-red-100 shadow-xs"
              title="Удалить карточку клиента безвозвратно"
            >
              <Trash2 className="w-3.5 h-3.5" /> Удалить карточку клиента
            </button>
          </div>

          {/* Profile Header Block */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
            
            {/* Col 1: Personal Profile snapshot */}
            <div className="lg:border-r lg:border-slate-100 flex flex-col justify-between pr-0 lg:pr-6">
              <div className="space-y-3.5">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 tracking-tight font-display font-sans">{activePatient.fullName}</h3>
                  <p className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider">КОД КАРТЫ: {activePatient.id}</p>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">КОНТАКТНЫЙ ТЕЛЕФОН</span>
                      <span className="font-semibold">{activePatient.phone}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">АДРЕС ПРОЖИВАНИЯ</span>
                      <span>{activePatient.address}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">ДАТА РОЖДЕНИЯ (ПОЛ)</span>
                      <span>{new Date(activePatient.birthDate).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })} ({activePatient.gender === 'Female' ? 'Женский' : activePatient.gender === 'Male' ? 'Мужской' : 'Другой'})</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Patient Note */}
              <div className="p-3 bg-teal-50/40 border border-teal-100/50 rounded-xl mt-4">
                <span className="text-[9px] font-bold text-teal-700 uppercase tracking-widest block mb-0.5">Аллергии и противопоказания</span>
                <p className="text-[11px] text-teal-800 leading-relaxed font-medium">{activePatient.notes || 'Аллергических реакций и хронических заболеваний не выявлено.'}</p>
              </div>
            </div>

            {/* Col 2: Diagnostics history and clinical reports */}
            <div className="lg:col-span-2 flex flex-col justify-between">
              
              {/* Header inside Col 2 */}
              <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-display font-sans">Клиническая история болезни ({activeRecords.length})</h4>
                  <p className="text-[10px] text-slate-400 font-sans">Журнал посещений и диагнозов, зафиксированных врачами</p>
                </div>

                <button
                  onClick={() => setIsAddRecordModalOpen(true)}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Внести запись в карту
                </button>
              </div>

              {/* Records Loop list */}
              <div className="overflow-y-auto space-y-4 max-h-60 pr-1 font-sans">
                {activeRecords.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-100">
                    <FileText className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                    <p className="text-xs">В данной амбулаторной карте пока нет клинических лечений.</p>
                  </div>
                ) : (
                  activeRecords.map(record => {
                    const attendingDoc = doctors.find(d => d.id === record.doctorId);
                    return (
                      <div key={record.id} className="p-4 border border-slate-100/80 rounded-2xl hover:bg-slate-50/30 transition-all text-xs bg-white shadow-xs">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-2 mb-2.5">
                          <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-md font-bold text-[10px] tracking-wide uppercase font-sans">
                            ДИАГНОЗ: {record.diagnosis}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Дата: {new Date(record.date).toLocaleDateString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        </div>

                        {/* Grid details complaints */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2 get-layout font-sans">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Жалобы и симптомы</span>
                            <p className="text-[11px] text-slate-700 leading-normal">{record.complaints || 'Отсутствуют'} / {record.symptoms || 'Отсутствуют'}</p>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">План лечения / Рекомендации</span>
                            <p className="text-[11px] text-slate-700 leading-normal">{record.treatmentPlan || 'Лечение завершено на приеме.'}</p>
                          </div>
                        </div>

                        {/* Prescriptions and procedures tagging */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-slate-50 mt-2 gap-2 font-sans">
                          <div>
                            <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest block font-sans">Назначенные медикаменты</span>
                            <p className="text-[11px] font-mono font-medium text-slate-800">{record.prescriptions || 'Не требуются (только терапевтический уход)'}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 italic font-medium font-sans font-sans">Врач: {attendingDoc ? attendingDoc.name : 'Дантист'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>

          </div>

          {/* Secure File upload CT/X-Rays area panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Drag Drop File Upload Panel (Col 1) */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 font-display">Диагностические снимки пациента</h4>
                <p className="text-[11px] text-slate-400 mb-4">Безопасный цифровой сейф для ортопантомограмм (ОПТГ), снимков КТ (DICOM) или направлений в формате PDF.</p>
                
                {/* Drag zone container */}
                <div className="border border-dashed border-slate-150 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:bg-teal-50/10 hover:border-teal-400 transition-all relative">
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-xs text-slate-700 font-medium">Нажмите для выбора файла</p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono">PNG, CT JPG, PDF до 45МБ</p>
                  
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Загрузить снимок"
                  />
                </div>
              </div>


            </div>

            {/* List of uploaded files (Col 2-3) */}
            <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-xs flex flex-col justify-between font-sans">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 font-display">Файловое облако пациента ({activeFiles.length})</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                  {activeFiles.length === 0 ? (
                    <div className="col-span-1 sm:col-span-2 py-12 text-center text-slate-400 border border-dashed border-slate-100/80 rounded-2xl bg-slate-50/50">
                      <Paperclip className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                      <p className="text-xs">Диагностические снимки пока не прикреплены к этой медкарте.</p>
                    </div>
                  ) : (
                    activeFiles.map(file => (
                      <div key={file.id} className="p-3 border border-slate-100 rounded-xl flex items-center justify-between gap-3 bg-white hover:shadow-xs transition-shadow">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* File logo box */}
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
                            file.category === 'X-Ray' ? 'bg-amber-50 text-amber-600 border-amber-100/50' :
                            file.category === 'CT Scan' ? 'bg-indigo-50 text-indigo-600 border-indigo-100/50' : 'bg-slate-50 text-slate-600 border-slate-100/50'
                          }`}>
                            <Paperclip className="w-4 h-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800 truncate" title={file.name}>{file.name}</p>
                            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{file.category === 'X-Ray' ? 'Рентген' : file.category === 'CT Scan' ? 'КТ-Снимок' : file.category} ({file.size})</span>
                          </div>
                        </div>

                        {/* File controllers */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={async () => {
                              try {
                                const { url, name } = await import('../utils/api.js').then(m => m.api.downloadAttachment(file.id));
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = name;
                                a.click();
                              } catch {
                                alert('Ошибка загрузки файла');
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-100 flex items-center justify-center cursor-pointer"
                            title="Скачать снимок"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Удалить данный файл из медкарты?')) {
                                onDeleteAttachment(file.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 bg-red-50/50 hover:bg-red-50 border border-red-100 flex items-center justify-center cursor-pointer"
                            title="Удалить файл"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Patient details edit triggers etc */}
              <div className="flex items-center justify-end pt-4 border-t border-slate-50 mt-4">
                <span className="text-[10px] text-slate-400 font-mono">Карта заведена: {new Date(activePatient.createdAt).toLocaleDateString('ru-RU')}</span>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* --- MODAL 1: REGISTER NEW PATIENT --- */}
      {isNewPatientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handlePatientSubmit}
            className="bg-white rounded-3xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
          >
            
            <div className="p-6 pb-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" />
                <h3 className="text-sm font-semibold text-slate-800 tracking-tight font-display">Регистрация нового пациента</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewPatientModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Закрыть
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto">
              
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">ФИО пациента *</label>
                <input
                  type="text"
                  placeholder="например, Иванова Анна Ивановна"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-teal-500 focus:bg-white cursor-text"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Номер телефона *</label>
                  <input
                    type="tel"
                    placeholder="например, +7 (999) 123-45-67"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-teal-500 focus:bg-white cursor-text"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Дата рождения</label>
                  <input
                    type="date"
                    value={newBirthDate}
                    onChange={(e) => setNewBirthDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-teal-500 focus:bg-white cursor-text"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Биологический пол</label>
                <div className="flex gap-4">
                  {(['Female', 'Male'] as const).map(g => (
                    <label key={g} className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="gender"
                        checked={newGender === g}
                        onChange={() => setNewGender(g)}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      {g === 'Female' ? 'Женский' : g === 'Male' ? 'Мужской' : 'Другой'}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Адрес проживания</label>
                <input
                  type="text"
                  placeholder="например, г. Москва, ул. Ленина, д. 10, кв. 5"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Противопоказания и аллергии</label>
                <textarea
                  placeholder="например, повышенная чувствительность зубов, аллергия на пенициллин..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-teal-500 min-h-16"
                />
              </div>

            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewPatientModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
              >
                Зарегистрировать пациента
              </button>
            </div>

          </form>
        </div>
      )}

      {/* --- MODAL 2: LOG NEW DENTAL RECORD EVENT --- */}
      {isAddRecordModalOpen && activePatient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleRecordSubmit}
            className="bg-white rounded-3xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
          >
            
            <div className="p-6 pb-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-teal-600" />
                <h3 className="text-sm font-semibold text-slate-800 tracking-tight font-display">Внесение записи в амбулаторную карту</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddRecordModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Закрыть
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto">
              
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Клинический диагноз *</label>
                <input
                  type="text"
                  placeholder="например, глубокий кариес 37 зуба, пульпит"
                  value={recordDiagnosis}
                  onChange={(e) => setRecordDiagnosis(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-teal-500 focus:bg-white cursor-text"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Лечащий врач *</label>
                  <select
                    value={recordDoctorId}
                    onChange={(e) => setRecordDoctorId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 cursor-pointer"
                    disabled={!isChief}
                  >
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Симптомы</label>
                  <input
                    type="text"
                    placeholder="например, реакция на холодное/горячее"
                    value={recordSymptoms}
                    onChange={(e) => setRecordSymptoms(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Жалобы пациента</label>
                <textarea
                  placeholder="например, ноющая боль при накусывании..."
                  value={recordComplaints}
                  onChange={(e) => setRecordComplaints(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-teal-500 font-sans min-h-14"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Выполненные процедуры</label>
                <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto p-1 border border-slate-100 rounded-xl bg-slate-50">
                  {Object.keys(PROCEDURE_CONFIGS).map(pType => (
                    <label key={pType} className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-600 bg-white p-1 rounded border border-slate-50">
                      <input
                        type="checkbox"
                        checked={recordProcedures.includes(pType)}
                        onChange={() => toggleProcedureInRecordForm(pType)}
                        className="text-teal-600 focus:ring-teal-500 rounded-xs"
                      />
                      {PROCEDURE_LABELS_RU[pType as ProcedureType] || pType}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Назначения и рецепты</label>
                <input
                  type="text"
                  placeholder="например, Амоксициллин 500 мг по 1 таб. 3 раза в день..."
                  value={recordPrescriptions}
                  onChange={(e) => setRecordPrescriptions(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">План дальнейшего лечения</label>
                <textarea
                  placeholder="например, установка коронки через 2 недели..."
                  value={recordPlan}
                  onChange={(e) => setRecordPlan(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-teal-500 min-h-14"
                />
              </div>

            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddRecordModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
              >
                Сохранить запись
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}

export default memo(PatientManagementImpl);
