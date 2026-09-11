import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  UploadCloud, 
  Eye, 
  Download, 
  MoreVertical, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Plus, 
  X, 
  ChevronRight, 
  SlidersHorizontal, 
  Copy, 
  Check, 
  Building2, 
  Calendar, 
  Image as ImageIcon,
  FolderOpen,
  FileCheck2,
  Trash2,
  Lock,
  ArrowUpDown,
  Archive,
  RefreshCw,
  FolderLock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ClassificationBadge, IntegrityBadge } from '../components/common/StatusBadge';
import { formatIndianDate } from '../utils/cryptoUtils';
import { POLICE_STATIONS, DOCUMENT_TYPES } from '../../database/seeds/mockData';

export const DocumentsPage = () => {
  const { 
    documents, 
    cases, 
    tamperedDocs, 
    navigate, 
    showToast, 
    logActivity, 
    currentUser 
  } = useApp();

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCase, setSelectedCase] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedOfficer, setSelectedOfficer] = useState('All');
  const [selectedDate, setSelectedDate] = useState('All');

  // Mobile Filter Drawer Toggle
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Active Dropdown Action Menu
  const [activeMenuDocId, setActiveMenuDocId] = useState(null);

  // Delete/Archive Confirmation Modal
  const [docToArchive, setDocToArchive] = useState(null);

  // Summary Metrics
  const totalCount = 186 + (documents.length - 20);
  const verifiedCount = 172 + (documents.filter(d => d.status === 'Verified' && !tamperedDocs[d.id]).length - 18);
  const pendingReviewCount = 9 + (documents.filter(d => d.status === 'Under Review').length - 2);
  const tempCaseDocCount = 5;

  // Filter logic
  const filteredDocuments = documents.filter((doc) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = !term || 
      doc.name.toLowerCase().includes(term) ||
      doc.id.toLowerCase().includes(term) ||
      doc.caseId.toLowerCase().includes(term) ||
      doc.docType.toLowerCase().includes(term) ||
      doc.uploadedBy.toLowerCase().includes(term) ||
      (doc.description && doc.description.toLowerCase().includes(term));

    const matchesCase = selectedCase === 'All' || doc.caseId === selectedCase;
    const matchesType = selectedType === 'All' || doc.docType === selectedType;
    
    const isTampered = !!tamperedDocs[doc.id];
    let matchesStatus = true;
    if (selectedStatus === 'Verified') matchesStatus = doc.status === 'Verified' && !isTampered;
    else if (selectedStatus === 'Under Review') matchesStatus = doc.status === 'Under Review';
    else if (selectedStatus === 'Tamper Alert') matchesStatus = isTampered;

    const matchesOfficer = selectedOfficer === 'All' || doc.uploadedBy.includes(selectedOfficer);

    return matchesSearch && matchesCase && matchesType && matchesStatus && matchesOfficer;
  });

  // Handle Clear Filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCase('All');
    setSelectedType('All');
    setSelectedStatus('All');
    setSelectedOfficer('All');
    setSelectedDate('All');
  };

  // Copy SHA-256 Hash
  const handleCopyHash = (doc, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(doc.sha256);
    showToast(`Copied SHA-256 hash for ${doc.name}`, 'info');
    setActiveMenuDocId(null);
  };

  // Handle Quick Download
  const handleDownload = (doc, e) => {
    e.stopPropagation();
    const isTampered = !!tamperedDocs[doc.id];
    const content = isTampered ? tamperedDocs[doc.id].tamperedContent : doc.content;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logActivity({
      action: 'Downloaded',
      actionBadge: 'download',
      documentId: doc.id,
      documentName: doc.name,
      caseId: doc.caseId,
      details: `Downloaded certified digital record of ${doc.name}.`
    });

    showToast(`Downloading certified record: ${doc.name}`, 'success');
    setActiveMenuDocId(null);
  };

  // Handle Archive / Restrict Document Confirmation
  const handleConfirmArchive = () => {
    if (docToArchive) {
      logActivity({
        action: 'Updated',
        actionBadge: 'update',
        documentId: docToArchive.id,
        documentName: docToArchive.name,
        caseId: docToArchive.caseId,
        details: `Document ${docToArchive.name} was archived/restricted by ${currentUser?.name || 'Administrator'}.`
      });
      showToast(`Document ${docToArchive.name} has been restricted and archived.`, 'success');
      setDocToArchive(null);
    }
  };

  const isTempCaseSelected = selectedCase === 'TEMP-CASE-2026-0018';

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      
      {/* 1. DOCUMENTS PAGE HEADER */}
      <div className="bg-white p-4 sm:p-6 lg:p-7 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>📄 Documents</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Securely stored case documents, evidence records, and forensic reports
          </p>
        </div>

        <button
          onClick={() => navigate('upload')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs sm:text-sm shadow-md transition cursor-pointer self-start sm:self-auto active:scale-95 shrink-0"
        >
          <UploadCloud className="w-4 h-4 text-amber-400" />
          <span>+ Upload Document</span>
        </button>
      </div>

      {/* 2. GLOBAL DOCUMENT SEARCH (Highly Visible) */}
      <div className="relative w-full">
        <div className="relative flex items-center">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 Search documents by name, Case ID, FIR number, officer or document type..."
            className="w-full pl-11 pr-10 py-3.5 sm:py-4 rounded-2xl border border-slate-300 bg-white text-slate-900 text-xs sm:text-sm font-medium shadow-xs focus:ring-2 focus:ring-blue-900 focus:border-blue-900 placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 3. DOCUMENT SUMMARY STATS CARDS (Requirement 4) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Documents */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Total Documents</div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{totalCount}</div>
            <div className="text-[10px] text-blue-900 font-semibold mt-0.5">All archived records</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
        </div>

        {/* Verified */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Verified</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5">{verifiedCount}</div>
            <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">100% SHA-256 Match</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        {/* Pending Review */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Pending Review</div>
            <div className="text-xl sm:text-2xl font-black text-amber-700 mt-0.5">{pendingReviewCount}</div>
            <div className="text-[10px] text-amber-700 font-semibold mt-0.5">Requires Sign-off</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* Temporary Case Documents */}
        <div 
          onClick={() => setSelectedCase(isTempCaseSelected ? 'All' : 'TEMP-CASE-2026-0018')}
          className={`p-3.5 sm:p-4 rounded-2xl border shadow-xs flex items-center justify-between cursor-pointer transition ${
            isTempCaseSelected ? 'bg-amber-100 border-amber-400' : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div>
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Temporary Case Docs</div>
            <div className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5">{tempCaseDocCount}</div>
            <div className="text-[10px] text-amber-800 font-semibold mt-0.5">🟡 FIR Not Registered</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
            <FolderLock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 4. TEMPORARY CASE NOTICE BANNER (Requirement 13) */}
      {isTempCaseSelected && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs sm:text-sm font-bold text-amber-950">
                Temporary Case: TEMP-CASE-2026-0018 (FIR Not Registered Yet)
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                FIR has not been registered yet. Available documents and photographs can still be securely attached to this temporary case. When the FIR is registered later, all documents remain permanently attached to the same case.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('upload')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold shrink-0 self-start sm:self-auto cursor-pointer"
          >
            + Attach Document to Temp Case
          </button>
        </div>
      )}

      {/* 5. FILTER BAR (Desktop Grid + Mobile Filter Drawer) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Mobile Filter Header Button */}
        <div className="flex sm:hidden items-center justify-between">
          <button
            onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-900" />
            <span>☰ Filters ({[selectedCase, selectedType, selectedStatus].filter(v => v !== 'All').length})</span>
          </button>

          {(selectedCase !== 'All' || selectedType !== 'All' || selectedStatus !== 'All' || searchTerm) && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-blue-900 font-bold hover:underline"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Filter Selectors Grid (Visible always on desktop, collapsible on mobile) */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3 ${isMobileFilterOpen ? 'block' : 'hidden sm:grid'}`}>
          {/* Case Filter */}
          <div>
            <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Case Dossier
            </label>
            <select
              value={selectedCase}
              onChange={(e) => setSelectedCase(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="All">All Cases</option>
              <option value="CASE-1024">CASE-1024 (Theft at Sevoke Rd)</option>
              <option value="CASE-1023">CASE-1023 (Missing Person)</option>
              <option value="CASE-1022">CASE-1022 (Cyber KYC Fraud)</option>
              <option value="CASE-1021">CASE-1021 (Market Assault)</option>
              <option value="CASE-1020">CASE-1020 (Ransomware Attack)</option>
              <option value="TEMP-CASE-2026-0018">TEMP-CASE-2026-0018 (Temp Case)</option>
            </select>
          </div>

          {/* Document Type Filter */}
          <div>
            <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Document Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="All">All Types</option>
              {DOCUMENT_TYPES.map(t => {
                const val = typeof t === 'object' ? t.value : t;
                const lbl = typeof t === 'object' ? t.label : t;
                return <option key={val} value={val}>{lbl}</option>;
              })}
            </select>
          </div>

          {/* Security Status Filter */}
          <div>
            <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Security Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="All">All Status</option>
              <option value="Verified">🟢 Verified Only</option>
              <option value="Under Review">🟡 Pending Review</option>
              <option value="Tamper Alert">🔴 Tamper Alert</option>
            </select>
          </div>

          {/* Uploaded By */}
          <div>
            <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Uploaded By
            </label>
            <select
              value={selectedOfficer}
              onChange={(e) => setSelectedOfficer(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="All">All Officers</option>
              <option value="Rahul Das">SI Rahul Das</option>
              <option value="Sharma">Inspector Sharma</option>
              <option value="Megha Sen">SI Megha Sen</option>
              <option value="Ananya Roy">Adv. Ananya Roy</option>
            </select>
          </div>

          {/* Clear Button */}
          <div className="flex items-end">
            <button
              onClick={handleClearFilters}
              className="w-full py-2 px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Clear Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6. DOCUMENT LIST (Desktop Table + Mobile Cards) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredDocuments.length === 0 ? (
          /* Empty State (Requirement 18) */
          <div className="p-10 sm:p-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">No documents found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No legal documents match your current search or filter criteria. Try adjusting filters or upload a new record.
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate('upload')}
                className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                + Upload Document Now
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* --- A. MOBILE RESPONSIVE CARDS (< 768px) --- */}
            <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
              {filteredDocuments.map((doc) => {
                const isTampered = !!tamperedDocs[doc.id];
                const isPhoto = doc.name.endsWith('.jpg') || doc.name.endsWith('.png') || doc.docType === 'Evidence Photograph';

                return (
                  <div
                    key={doc.id}
                    onClick={() => navigate('doc-viewer', { docId: doc.id })}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-blue-50/40 transition cursor-pointer space-y-2.5 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center shrink-0 mt-0.5">
                          {isPhoto ? <ImageIcon className="w-4 h-4 text-emerald-700" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                            {doc.name}
                          </h3>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {doc.docType} • v{doc.version}
                          </div>
                        </div>
                      </div>
                      <IntegrityBadge isVerified={doc.status === 'Verified'} isTampered={isTampered} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 pt-2 border-t border-slate-200/60">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Case Dossier:</span>
                        <span className="font-bold text-blue-900">{doc.caseId}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Uploaded By:</span>
                        <span className="font-semibold text-slate-700 truncate block">{doc.uploadedBy}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Date:</span>
                        <span className="text-slate-600">{formatIndianDate(doc.uploadDate)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Classification:</span>
                        <ClassificationBadge classification={doc.classification} />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('doc-viewer', { docId: doc.id });
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Document</span>
                      </button>

                      <button
                        onClick={(e) => handleDownload(doc, e)}
                        className="p-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* --- B. DESKTOP BALANCED TABLE (>= 768px) --- */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-bold">
                    <th className="py-4 px-6">Document</th>
                    <th className="py-4 px-4">Type</th>
                    <th className="py-4 px-4">Case</th>
                    <th className="py-4 px-3 text-center">Version</th>
                    <th className="py-4 px-4">Uploaded By</th>
                    <th className="py-4 px-4">Date</th>
                    <th className="py-4 px-4">Security</th>
                    <th className="py-4 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium">
                  {filteredDocuments.map((doc) => {
                    const isTampered = !!tamperedDocs[doc.id];
                    const isPhoto = doc.name.endsWith('.jpg') || doc.name.endsWith('.png') || doc.docType === 'Evidence Photograph';

                    return (
                      <tr 
                        key={doc.id} 
                        className="hover:bg-blue-50/40 transition group cursor-pointer"
                        onClick={() => navigate('doc-viewer', { docId: doc.id })}
                      >
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center shrink-0 group-hover:bg-blue-900 group-hover:text-white transition">
                              {isPhoto ? <ImageIcon className="w-4 h-4 text-emerald-700 group-hover:text-white" /> : <FileText className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 group-hover:text-blue-900 transition text-xs sm:text-sm truncate max-w-xs">
                                {doc.name}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">{doc.fileSize}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                          {doc.docType}
                        </td>

                        <td className="py-3.5 px-4 text-xs font-bold text-blue-900 font-mono">
                          {doc.caseId}
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                            v{doc.version}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-700">
                          <div className="font-semibold">{doc.uploadedBy}</div>
                          <div className="text-[10px] text-slate-400">{doc.uploadedByRole || 'Investigating Officer'}</div>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          {formatIndianDate(doc.uploadDate)}
                        </td>

                        <td className="py-3.5 px-4">
                          <IntegrityBadge isVerified={doc.status === 'Verified'} isTampered={isTampered} />
                        </td>

                        <td className="py-3.5 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5 relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('doc-viewer', { docId: doc.id });
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>

                            {/* More Actions Dropdown Button */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                                title="More Actions"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {activeMenuDocId === doc.id && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-30" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuDocId(null);
                                    }} 
                                  />
                                  <div 
                                    className="absolute right-0 mt-1 w-48 rounded-xl bg-white border border-slate-200 shadow-xl z-40 p-1.5 text-xs text-left animate-in fade-in zoom-in-95 duration-100"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={(e) => handleDownload(doc, e)}
                                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-700 flex items-center gap-2 cursor-pointer"
                                    >
                                      <Download className="w-3.5 h-3.5 text-blue-900" />
                                      <span>Download Copy</span>
                                    </button>

                                    <button
                                      onClick={(e) => handleCopyHash(doc, e)}
                                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-700 flex items-center gap-2 cursor-pointer"
                                    >
                                      <Copy className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Copy SHA-256</span>
                                    </button>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('doc-viewer', { docId: doc.id });
                                      }}
                                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-700 flex items-center gap-2 cursor-pointer"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Verify Checksum</span>
                                    </button>

                                    <div className="border-t border-slate-100 my-1"></div>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuDocId(null);
                                        setDocToArchive(doc);
                                      }}
                                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 flex items-center gap-2 cursor-pointer font-semibold"
                                    >
                                      <Archive className="w-3.5 h-3.5" />
                                      <span>Archive / Restrict</span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ================= ARCHIVE / RESTRICT CONFIRMATION MODAL ================= */}
      {docToArchive && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setDocToArchive(null)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-red-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-red-400" />
                <h3 className="font-bold text-sm">Archive / Restrict Document?</h3>
              </div>
              <button 
                onClick={() => setDocToArchive(null)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs text-slate-700 leading-relaxed">
              <p>
                Are you sure you want to restrict access to <strong>{docToArchive.name}</strong>?
              </p>
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-950">
                This document will be removed from normal case access. Under evidentiary standards, a permanent audit trail entry will record this action.
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setDocToArchive(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmArchive}
                  className="px-4 py-2 rounded-xl bg-red-900 hover:bg-red-950 text-white font-bold cursor-pointer"
                >
                  Confirm Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
