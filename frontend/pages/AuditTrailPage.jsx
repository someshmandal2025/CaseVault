import React, { useState, useEffect } from 'react';
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
  Check,
  RefreshCw,
  Info,
  X,
  Lock,
  Hash
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AuditTrailPage = () => {
  const { currentUser, showToast } = useApp();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  const [filterUser, setFilterUser] = useState('All');
  const [filterAction, setFilterAction] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const headers = {
        'Accept': 'application/json',
        'X-Officer-ID': currentUser?.officer_id || currentUser?.username || '',
        'X-User-Email': currentUser?.email || '',
        'X-User-Role': currentUser?.role || ''
      };

      const queryParams = new URLSearchParams();
      if (filterAction !== 'All') queryParams.append('event_type', filterAction);
      if (filterUser !== 'All') queryParams.append('officer_id', filterUser);
      if (searchTerm) queryParams.append('search', searchTerm);

      const response = await fetch(`/api/audit/?${queryParams.toString()}`, { headers });
      const data = await response.json();

      if (data.success && Array.isArray(data.audit_logs)) {
        setLogs(data.audit_logs);
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs from backend API:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const headers = {
        'Accept': 'application/json',
        'X-Officer-ID': currentUser?.officer_id || currentUser?.username || '',
        'X-User-Email': currentUser?.email || '',
        'X-User-Role': currentUser?.role || ''
      };

      const response = await fetch('/api/audit/verify/', { headers });
      const data = await response.json();

      setVerificationResult(data);
      if (data.success && data.valid) {
        showToast(`✓ Tamper-evident SHA-256 chain verified (${data.records_checked} records intact)`, 'success');
      } else if (data.success && !data.valid) {
        showToast(`⚠️ Tamper alert: ${data.invalid_records?.length || 1} invalid record(s) detected!`, 'error');
      } else {
        showToast(data.message || 'Verification failed.', 'error');
      }
    } catch (err) {
      console.error('Audit verification request error:', err);
      showToast('Audit chain verification failed.', 'error');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [filterUser, filterAction, searchTerm]);

  const actionsList = [
    'All',
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'LOGOUT',
    'OFFICER_CREATED',
    'CASE_CREATED',
    'DOCUMENT_UPLOADED',
    'DOCUMENT_VIEWED',
    'DOCUMENT_VERIFIED',
    'EVIDENCE_CREATED',
    'EVIDENCE_TRANSFERRED',
    'EVIDENCE_VERIFIED',
    'CUSTODY_HISTORY_VIEWED'
  ];

  const getActionBadge = (action) => {
    const actUpper = String(action || '').toUpperCase();
    if (actUpper.includes('LOGIN_SUCCESS') || actUpper.includes('CREATED') || actUpper.includes('UPLOADED')) {
      return { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: UploadCloud, label: actUpper };
    }
    if (actUpper.includes('VIEWED') || actUpper.includes('CUSTODY')) {
      return { bg: 'bg-blue-100 text-blue-800 border-blue-300', icon: Eye, label: actUpper };
    }
    if (actUpper.includes('TRANSFERRED') || actUpper.includes('UPDATED')) {
      return { bg: 'bg-purple-100 text-purple-800 border-purple-300', icon: Edit3, label: actUpper };
    }
    if (actUpper.includes('VERIFIED') || actUpper.includes('ACCEPTED')) {
      return { bg: 'bg-teal-100 text-teal-800 border-teal-300', icon: CheckCircle2, label: actUpper };
    }
    if (actUpper.includes('FAILED') || actUpper.includes('TAMPER') || actUpper.includes('DENIED')) {
      return { bg: 'bg-red-100 text-red-800 border-red-300', icon: AlertTriangle, label: actUpper };
    }
    return { bg: 'bg-slate-100 text-slate-800 border-slate-300', icon: FileText, label: actUpper || 'ACTIVITY' };
  };

  const handleExportCSV = () => {
    if (logs.length === 0) {
      showToast('No audit logs available to export.', 'error');
      return;
    }
    const headers = ['Audit ID,Timestamp,Event Type,Actor Officer ID,Actor Name,Role,Case ID,Document ID,Evidence ID,Description,Record Hash'];
    const rows = logs.map(l => 
      `"${l.audit_id || l.event_id || ''}","${l.timestamp || ''}","${l.event_type || l.action || ''}","${l.actor_officer_id || ''}","${l.actor_name || ''}","${l.actor_role || ''}","${l.case_id || ''}","${l.document_id || ''}","${l.evidence_id || ''}","${(l.action_description || l.description || '').replace(/"/g, '""')}","${l.record_hash || ''}"`
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
      <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] sm:text-xs font-mono font-bold px-2.5 py-1 rounded bg-blue-100 text-blue-900 border border-blue-200">
              🔒 TAMPER-EVIDENT SHA-256 AUDIT TRAIL
            </span>
            {verificationResult?.valid && (
              <span className="text-[10px] sm:text-xs font-mono font-bold px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-600" />
                <span>HASH CHAIN INTACT ({verificationResult.records_checked} RECS)</span>
              </span>
            )}
            {verificationResult && !verificationResult.valid && (
              <span className="text-[10px] sm:text-xs font-mono font-bold px-2.5 py-1 rounded bg-red-100 text-red-800 border border-red-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-600" />
                <span>TAMPER ALERT ({verificationResult.invalid_records?.length} ERRORS)</span>
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            📋 Security Audit Trail & Cryptographic Log
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mt-0.5 leading-relaxed">
            All user operations, authentication attempts, case modifications, document uploads, and evidence transfers are permanently stored with SHA-256 hash chains linked to preceding records.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleVerifyChain}
            disabled={verifying}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold shadow-xs transition cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{verifying ? 'Verifying...' : 'Verify Hash Chain'}</span>
          </button>

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
            placeholder="🔍 Search audit logs by Audit ID, officer ID, name, event type, case ID..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-900 bg-slate-50/50 focus:ring-2 focus:ring-blue-900"
          />
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
          <div>
            <label className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Filter by Action / Event Type
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

          <div>
            <label className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Filter by Officer ID
            </label>
            <input
              type="text"
              value={filterUser === 'All' ? '' : filterUser}
              onChange={(e) => setFilterUser(e.target.value || 'All')}
              placeholder="e.g. OFF-001 or All"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs sm:text-sm flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-900" />
            <span>Loading authoritative audit logs from Django REST API...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs sm:text-sm font-medium">
            No audit activity recorded yet.
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-200 ml-3 sm:ml-6 space-y-4 sm:space-y-6">
            {logs.map((log) => {
              const eventType = log.event_type || log.action || 'ACTIVITY';
              const badgeInfo = getActionBadge(eventType);
              const BadgeIcon = badgeInfo.icon;
              const auditId = log.audit_id || log.event_id || 'AUD-2026-UNKNOWN';

              return (
                <div key={auditId} className="relative pl-5 sm:pl-8 group">
                  {/* Timeline Bullet */}
                  <div className="absolute -left-3 top-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white border-2 border-blue-900 flex items-center justify-center shadow-xs">
                    <BadgeIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-900" />
                  </div>

                  {/* Activity Card */}
                  <div 
                    onClick={() => setSelectedLog(log)}
                    className="p-3.5 sm:p-4 rounded-xl bg-slate-50 hover:bg-blue-50/50 border border-slate-200 transition space-y-2 cursor-pointer"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                          <span>👮</span>
                          <span>{log.actor_name || log.actor_officer_id || 'SYSTEM'}</span>
                        </span>
                        {log.actor_officer_id && (
                          <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-200/80 px-1.5 py-0.5 rounded">
                            {log.actor_officer_id}
                          </span>
                        )}
                        {log.actor_role && (
                          <span className="text-[10px] text-slate-500 font-medium">({log.actor_role})</span>
                        )}
                        
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
                      {log.action_description || log.description}
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                      <div className="flex items-center gap-2 font-mono text-[11px] text-blue-900 font-semibold truncate flex-wrap">
                        <span className="text-slate-400">ID: {auditId}</span>
                        {log.case_id && <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">Case: {log.case_id}</span>}
                        {log.document_id && <span className="text-slate-600">Doc: {log.document_id}</span>}
                        {log.evidence_id && <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Evidence: {log.evidence_id}</span>}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                        {log.record_hash && (
                          <span className="text-slate-600 bg-slate-200/70 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono">
                            <Hash className="w-3 h-3 text-slate-400" />
                            <span>Hash: {log.record_hash.slice(0, 12)}...</span>
                          </span>
                        )}
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Recorded</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Audit Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-900" />
                <h3 className="text-base font-bold text-slate-900">Audit Record Details</h3>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Audit ID</span>
                  <span className="font-mono font-bold text-slate-900">{selectedLog.audit_id || selectedLog.event_id}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Event Type</span>
                  <span className="font-mono font-bold text-blue-900">{selectedLog.event_type || selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Timestamp</span>
                  <span className="font-mono text-slate-700">{selectedLog.timestamp}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Actor Officer ID</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedLog.actor_officer_id || 'SYSTEM'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Actor Name</span>
                  <span className="font-semibold text-slate-800">{selectedLog.actor_name || 'System Process'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Role / Rank</span>
                  <span className="text-slate-700">{selectedLog.actor_role || selectedLog.actor_rank || 'N/A'}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Action Description</span>
                <p className="text-slate-800 font-medium leading-relaxed">{selectedLog.action_description || selectedLog.description}</p>
              </div>

              <div className="bg-slate-900 text-slate-100 p-3 rounded-xl space-y-2 font-mono text-[11px]">
                <div className="flex items-center gap-1.5 text-blue-400 font-bold border-b border-slate-800 pb-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>SHA-256 Cryptographic Chain State</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">PREVIOUS HASH:</span>
                  <span className="text-amber-300 break-all">{selectedLog.previous_hash || 'GENESIS'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">RECORD HASH:</span>
                  <span className="text-emerald-400 break-all">{selectedLog.record_hash || 'N/A'}</span>
                </div>
              </div>

              {(selectedLog.ip_address || selectedLog.user_agent) && (
                <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between border-t border-slate-100 pt-2">
                  <span>IP: {selectedLog.ip_address || '127.0.0.1'}</span>
                  <span className="truncate max-w-[300px]">Agent: {selectedLog.user_agent}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-950 cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
