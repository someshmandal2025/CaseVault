import React, { useState } from 'react';
import { 
  ClipboardList, 
  Filter, 
  ShieldCheck, 
  Download, 
  Eye, 
  UploadCloud, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  User, 
  FileText, 
  Search,
  Printer,
  FileCheck2,
  Check
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AuditTrailPage = () => {
  const { auditLogs, navigate, showToast } = useApp();

  const [filterUser, setFilterUser] = useState('All');
  const [filterAction, setFilterAction] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const actionsList = ['All', 'Viewed', 'Uploaded', 'Downloaded', 'Updated', 'Approved', 'Verified', 'Created', 'Tamper Detected'];
  const usersList = ['All', 'SI Rahul Das', 'Inspector Sharma', 'Adv. Ananya Roy', 'Rajesh Verma, IPS'];

  const filteredLogs = auditLogs.filter(log => {
    const matchesUser = filterUser === 'All' || log.user === filterUser;
    const matchesAction = filterAction === 'All' || log.action.toLowerCase() === filterAction.toLowerCase();
    const matchesSearch = !searchTerm ||
      log.documentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.caseId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesUser && matchesAction && matchesSearch;
  });

  const getActionBadge = (action) => {
    switch (action?.toLowerCase()) {
      case 'uploaded':
      case 'created':
        return { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: UploadCloud, label: 'Uploaded' };
      case 'viewed':
        return { bg: 'bg-blue-100 text-blue-800 border-blue-300', icon: Eye, label: 'Viewed' };
      case 'downloaded':
        return { bg: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: Download, label: 'Downloaded' };
      case 'updated':
        return { bg: 'bg-purple-100 text-purple-800 border-purple-300', icon: Edit3, label: 'Updated' };
      case 'approved':
      case 'verified':
        return { bg: 'bg-teal-100 text-teal-800 border-teal-300', icon: CheckCircle2, label: 'Verified' };
      case 'tamper detected':
        return { bg: 'bg-red-100 text-red-800 border-red-300 animate-pulse', icon: AlertTriangle, label: 'Tamper Alert' };
      default:
        return { bg: 'bg-slate-100 text-slate-800 border-slate-300', icon: FileText, label: action };
    }
  };

  const handleExportCSV = () => {
    const headers = ['Log ID,Timestamp,Officer Name,Role,Action,Document Name,Case ID,Details,Station/IP'];
    const rows = filteredLogs.map(l => 
      `"${l.id}","${l.timestamp}","${l.user}","${l.role}","${l.action}","${l.documentName}","${l.caseId}","${l.details}","${l.ip}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CASEVAULT_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Audit Trail exported to CSV successfully', 'success');
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900">
              IMMUTABLE CHAIN OF CUSTODY
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            📋 Document Activity & Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mt-0.5 leading-relaxed">
            Every legal document action is stamped with date, officer credentials, and cryptographic integrity state.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold shadow-xs transition cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 Search activity by officer name, action, document title, case..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-900 bg-slate-50/50 focus:ring-2 focus:ring-blue-900"
          />
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
          <div>
            <label className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Filter by Officer
            </label>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            >
              {usersList.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Filter by Action Type
            </label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            >
              {actionsList.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Activity Timeline List (Requirement 12) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 lg:p-8">
        <div className="relative border-l-2 border-slate-200 ml-3 sm:ml-6 space-y-4 sm:space-y-6">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs sm:text-sm">
              No audit records match the selected criteria.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const badgeInfo = getActionBadge(log.action);
              const BadgeIcon = badgeInfo.icon;

              return (
                <div key={log.id} className="relative pl-5 sm:pl-8 group">
                  {/* Timeline Bullet */}
                  <div className="absolute -left-3 top-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white border-2 border-blue-900 flex items-center justify-center shadow-xs">
                    <BadgeIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-900" />
                  </div>

                  {/* Activity Card */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 hover:bg-blue-50/40 border border-slate-200 transition space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                          <span>👮</span>
                          <span>{log.user}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">({log.role})</span>
                        
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border ${badgeInfo.bg}`}>
                          {badgeInfo.label}
                        </span>
                      </div>

                      <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{log.timestamp}</span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-800 font-medium leading-relaxed">
                      {log.details}
                    </div>

                    {log.documentName && (
                      <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-blue-900 font-semibold truncate">
                          <FileText className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                          <span className="truncate">{log.documentName}</span>
                          {log.caseId && <span className="text-slate-400 shrink-0">({log.caseId})</span>}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>✓ Successful</span>
                          </span>
                          <span className="hidden sm:inline">• Node: {log.ip}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
