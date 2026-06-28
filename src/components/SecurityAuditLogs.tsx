/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ShieldAlert, Clock, UserCheck, Terminal, ShieldAlert as ShieldIcon } from 'lucide-react';
import { AuditLog } from '../types.js';

interface SecurityAuditLogsProps {
  auditLogs: AuditLog[];
}

export default function SecurityAuditLogs({ auditLogs }: SecurityAuditLogsProps) {
  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-6 animate-in fade-in duration-200">
      
      {/* Module Intro Headers */}
      <div className="border-b border-slate-50 pb-4">
        <div className="flex items-center gap-2.5 mb-1 bg-red-50 text-red-700 px-3 py-1 rounded-md w-fit text-[10px] uppercase font-bold tracking-wider">
          <ShieldAlert className="w-3.5 h-3.5" /> Контроль безопасности HIPAA активен
        </div>
        <h2 className="text-sm font-bold text-slate-800 tracking-tight font-display">Системный журнал безопасности администратора</h2>
        <p className="text-xs text-slate-400">Криптографически отслеживаемые клинические операции, изменения в базе данных и история авторизации персонала.</p>
      </div>

      {/* Terminal logs panel */}
      <div className="bg-slate-900 rounded-2xl p-5 text-[11px] font-mono text-slate-300 leading-relaxed shadow-lg border border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <span className="text-slate-400 flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider">
            <Terminal className="w-4 h-4 text-teal-400" /> Активный поток событий безопасности (UTC 2026)
          </span>
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
        </div>

        <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
          {auditLogs.length === 0 ? (
            <p className="text-slate-500 italic py-8 text-center">В системных журналах не зарегистрировано ни одной операции.</p>
          ) : (
            auditLogs.map((log) => {
              
              // Custom coloring for specific actions
              const getLogStyles = (act: string) => {
                if (act.includes('LOGIN')) return 'text-emerald-400 font-bold';
                if (act.includes('CLOCK_IN')) return 'text-emerald-300 font-bold';
                if (act.includes('CLOCK_OUT')) return 'text-amber-400 font-bold';
                if (act.includes('DELETE')) return 'text-red-400 font-bold';
                if (act.includes('RECORD_PAYMENT')) return 'text-yellow-300 font-bold';
                return 'text-teal-400 font-semibold';
              };

              return (
                <div key={log.id} className="p-3 bg-slate-950/60 rounded-xl hover:bg-slate-950 transition-colors border border-slate-800/40 flex items-start gap-4 justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded bg-slate-800/80 flex items-center justify-center text-slate-400 shrink-0 text-[10px] mt-0.5">
                      #
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className={getLogStyles(log.action)}>[{log.action}]</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-300 font-medium">{log.userName}</span>
                        <span className="text-slate-600 bg-slate-900 px-1 py-0.2 rounded text-[10px]">({log.userId})</span>
                      </div>
                      <p className="text-slate-400 mt-1 leading-normal font-sans text-xs">{log.details}</p>
                    </div>
                  </div>

                  {/* Timestamp tracking */}
                  <div className="text-right shrink-0">
                    <span className="text-slate-500 text-[10px] block font-semibold">{log.id.toUpperCase()}</span>
                    <span className="text-slate-400 text-[10px] flex items-center gap-1 mt-0.5 justify-end">
                      <Clock className="w-3 h-3 text-slate-500" /> {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
