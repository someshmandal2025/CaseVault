import React, { useState } from 'react';
import { 
  FolderPlus, 
  UploadCloud, 
  Search, 
  FileCheck2, 
  FolderLock, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  ArrowUpRight, 
  ChevronRight,
  Eye,
  Plus,
  FileText,
  AlertTriangle,
  Activity,
  Building2,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CaseStatusBadge } from '../components/common/StatusBadge';
import { GlobalSearchBar } from '../components/common/GlobalSearchBar';

export const DashboardPage = () => {
  const { 
    currentUser, 
    cases, 
    documents, 
    auditLogs, 
    navigate, 
    openNewCaseModal, 
    setSearchQuery 
  } = useApp();

  const [mobileSearchInput, setMobileSearchInput] = useState('');

  // Statistics calculations
  const totalCases = 24 + (cases.length - 5);
  const activeCases = 16 + (cases.filter(c => c.status === 'Active' || c.status === 'Investigation').length - 4);
  const totalDocuments = 186 + (documents.length - 20);
  const pendingReview = 7 + (cases.filter(c => c.status === 'Under Review').length - 1);

  const handleMobileSearchSubmit = (e) => {
    e.preventDefault();
    if (mobileSearchInput.trim()) {
      setSearchQuery(mobileSearchInput);
      navigate('search');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* 1. TOP WELCOME HEADER (Compact on mobile, rich on desktop) */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 rounded-2xl p-4 sm:p-7 text-white shadow-xl border border-blue-900/60 relative overflow-hidden">
        {/* Subtle background seal */}
        <div className="absolute right-2 -bottom-6 opacity-10 pointer-events-none hidden sm:block">
          <ShieldCheck className="w-56 h-56 text-white" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 mb-1.5">
              <span>🇮🇳</span>
              <span className="truncate">NCRB Police Portal</span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight leading-snug">
              Good Day, {currentUser?.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              Welcome to <strong className="text-white">CASEVAULT</strong> — {currentUser?.policeStation}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 text-left sm:text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-300 font-semibold">Security Protocol</div>
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                SHA-256 Verified
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. PROMINENT SMART SEARCH BAR WITH AUTO-SUGGESTIONS */}
      <GlobalSearchBar 
        placeholder="🔍 Search cases, FIR numbers, documents, officers..." 
        className="w-full shadow-xs"
      />

      {/* 3. QUICK ACTIONS (1-col on mobile, 3-col on desktop) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <span>⚡ Quick Actions</span>
          <span className="text-[10px] text-slate-400 font-normal">(Instant one-touch access)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Action 1: + New Case */}
          <button
            onClick={openNewCaseModal}
            className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold transition shadow-sm active:scale-[0.98] cursor-pointer text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition">
              <Plus className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold">+ New Case</div>
              <div className="text-[11px] text-blue-200 font-normal truncate">Register FIR / GD Record</div>
            </div>
          </button>

          {/* Action 2: 📤 Upload Document */}
          <button
            onClick={() => navigate('upload')}
            className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold transition shadow-sm active:scale-[0.98] cursor-pointer text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition">
              <UploadCloud className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold">📤 Upload Document</div>
              <div className="text-[11px] text-emerald-200 font-normal truncate">Upload FIR, Evidence, Forensics</div>
            </div>
          </button>

          {/* Action 3: 🔍 Search Documents */}
          <button
            onClick={() => navigate('search')}
            className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold transition shadow-sm active:scale-[0.98] cursor-pointer text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition">
              <Search className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold">🔍 Search Records</div>
              <div className="text-[11px] text-slate-300 font-normal truncate">Filter by Case, Acts, Witness</div>
            </div>
          </button>
        </div>
      </div>

      {/* 4. IMPORTANT STATISTICS (1-col on mobile, 2-col on tablet, 4-col on desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Cases */}
        <div 
          onClick={() => navigate('cases')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition cursor-pointer flex sm:flex-col justify-between items-center sm:items-start group"
        >
          <div className="flex sm:w-full items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Cases
            </span>
            <div className="hidden sm:flex w-9 h-9 rounded-xl bg-blue-50 text-blue-900 items-center justify-center group-hover:scale-110 transition">
              <FolderLock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-right sm:text-left">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {totalCases}
            </div>
            <div className="text-[11px] text-blue-800 font-semibold mt-0.5">
              All recorded police files
            </div>
          </div>
        </div>

        {/* Active Cases */}
        <div 
          onClick={() => navigate('cases')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition cursor-pointer flex sm:flex-col justify-between items-center sm:items-start group"
        >
          <div className="flex sm:w-full items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Cases
            </span>
            <div className="hidden sm:flex w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 items-center justify-center group-hover:scale-110 transition">
              <FolderPlus className="w-4 h-4" />
            </div>
          </div>
          <div className="text-right sm:text-left">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight">
              {activeCases}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              Under active investigation
            </div>
          </div>
        </div>

        {/* Documents */}
        <div 
          onClick={() => navigate('documents')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition cursor-pointer flex sm:flex-col justify-between items-center sm:items-start group"
        >
          <div className="flex sm:w-full items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Documents
            </span>
            <div className="hidden sm:flex w-9 h-9 rounded-xl bg-indigo-50 text-indigo-800 items-center justify-center group-hover:scale-110 transition">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-right sm:text-left">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {totalDocuments}
            </div>
            <div className="text-[11px] text-indigo-700 font-semibold mt-0.5">
              100% SHA-256 Hashed
            </div>
          </div>
        </div>

        {/* Pending Review */}
        <div 
          onClick={() => navigate('cases')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-300 transition cursor-pointer flex sm:flex-col justify-between items-center sm:items-start group"
        >
          <div className="flex sm:w-full items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Pending Review
            </span>
            <div className="hidden sm:flex w-9 h-9 rounded-xl bg-amber-50 text-amber-800 items-center justify-center group-hover:scale-110 transition">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-right sm:text-left">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 tracking-tight">
              {pendingReview}
            </div>
            <div className="text-[11px] text-amber-700 font-medium mt-0.5">
              Requires supervisory sign-off
            </div>
          </div>
        </div>
      </div>

      {/* 5. REQUIRES ATTENTION ALERT BANNER */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-950 text-xs sm:text-sm">
              Action Required: 3 Documents in CASE-1024 Awaiting Final Supervisory Approval
            </div>
            <div className="text-amber-800 text-[11px] mt-0.5">
              SFSL Forensic and Witness statements must be countersigned by SHO before court submission.
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('case-detail', { caseId: 'CASE-1024' })}
          className="px-3.5 py-1.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs shrink-0 self-start sm:self-auto cursor-pointer transition"
        >
          Review Dossier
        </button>
      </div>

      {/* 6. RECENT CASES (Responsive: Table on Desktop, Cards on Mobile/Tablet) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>Recent Cases</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              High-priority matters across Siliguri & adjacent police divisions
            </p>
          </div>
          <button
            onClick={() => navigate('cases')}
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-900 hover:text-blue-700 transition cursor-pointer shrink-0"
          >
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* --- A. Mobile Card View (< 768px) --- */}
        <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
          {cases.slice(0, 4).map((c) => (
            <div 
              key={c.id}
              onClick={() => navigate('case-detail', { caseId: c.id })}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-blue-50/40 transition cursor-pointer space-y-2.5 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-extrabold text-blue-950 text-base">{c.id}</div>
                  <div className="text-xs text-slate-500 font-mono">{c.firNumber}</div>
                </div>
                <CaseStatusBadge status={c.status} />
              </div>

              <div>
                <div className="text-xs font-bold text-slate-800">{c.caseType}</div>
                <div className="text-xs text-slate-600 font-medium line-clamp-1">{c.title}</div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-200/60">
                <div className="flex items-center gap-1 truncate">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{c.policeStation}</span>
                </div>
                <span className="font-bold text-slate-700 shrink-0">
                  📄 {c.id === 'CASE-1024' ? 12 : c.id === 'CASE-1023' ? 18 : c.id === 'CASE-1022' ? 9 : 21} Docs
                </span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('case-detail', { caseId: c.id });
                }}
                className="w-full py-2.5 rounded-xl bg-blue-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Case Dossier</span>
              </button>
            </div>
          ))}
        </div>

        {/* --- B. Desktop Table View (>= 768px) --- */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-bold">
                <th className="py-3.5 px-6">Case ID</th>
                <th className="py-3.5 px-6">Case Title & Type</th>
                <th className="py-3.5 px-6">Police Station</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-center">Documents</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium">
              {cases.slice(0, 4).map((c) => (
                <tr 
                  key={c.id} 
                  className="hover:bg-blue-50/40 transition group cursor-pointer"
                  onClick={() => navigate('case-detail', { caseId: c.id })}
                >
                  <td className="py-4 px-6">
                    <div className="font-extrabold text-blue-900 group-hover:underline">
                      {c.id}
                    </div>
                    <div className="text-xs text-slate-500 font-normal">{c.firNumber}</div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-bold text-slate-800">{c.caseType}</span>
                    <div className="text-xs text-slate-500 truncate max-w-xs">{c.title}</div>
                  </td>
                  <td className="py-4 px-6 text-slate-700 text-xs font-semibold">
                    {c.policeStation}
                  </td>
                  <td className="py-4 px-6">
                    <CaseStatusBadge status={c.status} />
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                      📄 {c.id === 'CASE-1024' ? 12 : c.id === 'CASE-1023' ? 18 : c.id === 'CASE-1022' ? 9 : 21}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('case-detail', { caseId: c.id });
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. RECENT ACTIVITY PREVIEW (Timeline List) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-900" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Live Investigation Activity Stream
            </h2>
          </div>
          <button
            onClick={() => navigate('audit')}
            className="text-xs font-bold text-blue-900 hover:underline cursor-pointer"
          >
            Full Audit Trail →
          </button>
        </div>

        <div className="space-y-2.5">
          {auditLogs.slice(0, 3).map((log) => (
            <div 
              key={log.id} 
              className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 text-xs"
            >
              <span className="text-base shrink-0">👮</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5">
                  <span className="font-bold text-slate-900">{log.officerName}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{log.timestamp}</span>
                </div>
                <div className="text-slate-600 mt-0.5">
                  <span className="font-semibold text-blue-900">{log.action}: </span>
                  <span>{log.details}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
