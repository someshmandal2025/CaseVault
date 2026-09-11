import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, 
  UploadCloud, 
  Search, 
  Edit3, 
  FileText, 
  Eye, 
  ShieldCheck, 
  Calendar, 
  User, 
  Building2, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Plus, 
  MessageSquare, 
  X, 
  Send, 
  FileCheck2, 
  Image as ImageIcon,
  ChevronRight,
  Sparkles,
  AlertCircle,
  FolderLock,
  Lock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CaseStatusBadge, ClassificationBadge, IntegrityBadge } from '../components/common/StatusBadge';
import { formatIndianDate } from '../utils/cryptoUtils';

export const CaseDetailPage = () => {
  const { 
    selectedCaseId, 
    cases, 
    documents, 
    tamperedDocs, 
    navigate, 
    updateCase, 
    showToast, 
    logActivity, 
    currentUser 
  } = useApp();

  const currentCase = cases.find(c => c.id === selectedCaseId) || cases[0];
  const caseDocs = documents.filter(d => d.caseId === currentCase.id);

  // Search in Documents state
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  // Update Case Modal State
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    firNumber: currentCase.firNumber || '',
    dateOpened: currentCase.dateOpened || '',
    status: currentCase.status || 'Investigation',
    summary: currentCase.summary || '',
    investigatingOfficer: currentCase.investigatingOfficer || '',
    policeStation: currentCase.policeStation || '',
    location: currentCase.location || 'Sevoke Road Market Area, Siliguri'
  });

  // Officer Notes State
  const [notes, setNotes] = useState([
    {
      id: 'note-1',
      author: 'Inspector Sharma',
      role: 'Station House Officer',
      time: 'Today — 11:15 AM',
      text: 'Awaiting fingerprint comparison certificate from SFSL Kolkata.'
    },
    {
      id: 'note-2',
      author: 'SI Rahul Das',
      role: 'Investigating Officer',
      time: '28 Aug 2026 — 03:30 PM',
      text: 'Accused Ramesh interrogated under Section 27. Stolen articles recovered.'
    }
  ]);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  // Determine if this is a Temporary Case (FIR not registered yet)
  const isTemporaryCase = currentCase.id.startsWith('TEMP-') || currentCase.firNumber === 'FIR-PENDING' || !currentCase.firNumber;

  // Filtered documents inside this case
  const filteredCaseDocs = caseDocs.filter(d => {
    const q = docSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return d.name.toLowerCase().includes(q) || d.docType.toLowerCase().includes(q) || d.uploadedBy.toLowerCase().includes(q);
  });

  // Requires Attention items
  const pendingReviewDocs = caseDocs.filter(d => d.status === 'Under Review');
  const tamperedInCase = caseDocs.filter(d => !!tamperedDocs[d.id]);
  const isFirMissing = isTemporaryCase || !currentCase.firNumber;

  // Handle Save Case Updates
  const handleSaveCaseUpdates = (e) => {
    e.preventDefault();
    updateCase(currentCase.id, editFormData);
    setIsUpdateModalOpen(false);
  };

  // Handle Add Note
  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    const timeStr = `Today — ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const newNoteObj = {
      id: `note-${Date.now()}`,
      author: currentUser?.name || 'Officer',
      role: currentUser?.roleLabel || 'Investigating Officer',
      time: timeStr,
      text: newNoteText.trim()
    };

    setNotes([newNoteObj, ...notes]);
    setNewNoteText('');
    setIsAddNoteOpen(false);
    showToast('Officer internal note added to case dossier.', 'success');
  };

  // Focus document search
  const handleFocusSearch = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      
      {/* ================= 1. CASE HEADER (Requirement 1) ================= */}
      <div className="bg-white p-4 sm:p-6 lg:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        {/* Back Link */}
        <button
          onClick={() => navigate('cases')}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-blue-900 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-blue-900" />
          <span>← Back to My Cases</span>
        </button>

        {/* Title, Category & Status Badges */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-mono font-black px-2.5 py-1 rounded-md bg-slate-900 text-white">
                #{currentCase.id}
              </span>
              
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-md bg-blue-100 text-blue-900">
                {currentCase.caseType} Case
              </span>

              {isTemporaryCase ? (
                <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse"></span>
                  <span>🟣 FIR Not Registered</span>
                </span>
              ) : (
                <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                  <span>🟡 {currentCase.status}</span>
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight mt-2">
              {currentCase.title}
            </h1>
          </div>

          {/* Quick Doc Counter Badge */}
          <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 self-start md:self-auto text-left md:text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Archived Records</div>
            <div className="text-lg font-black text-blue-900 font-mono">{caseDocs.length} Documents</div>
          </div>
        </div>

        {/* Key Metadata Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">FIR Number:</span>
            <span className="font-bold text-slate-900 font-mono">
              {isTemporaryCase ? '🟣 Pending Registration' : currentCase.firNumber}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Police Station:</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-blue-900 shrink-0" />
              <span className="truncate">{currentCase.policeStation}</span>
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Investigating Officer:</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-blue-900 shrink-0" />
              <span className="truncate">{currentCase.investigatingOfficer}</span>
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Case Created Date:</span>
            <span className="font-medium text-slate-700">{formatIndianDate(currentCase.dateOpened)}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Last Updated:</span>
            <span className="font-medium text-slate-700">{formatIndianDate(currentCase.lastUpdated || currentCase.dateOpened)}</span>
          </div>
        </div>

        {/* Temporary Case Notice Banner (Requirement 10) */}
        {isTemporaryCase && (
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-purple-950">
            <div className="flex items-start gap-2.5">
              <FolderLock className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm text-purple-900">
                  Temporary Case ID: {currentCase.id}
                </div>
                <p className="text-purple-800 mt-0.5">
                  This case was created before FIR registration. Documents and photographs can be securely stored here until the FIR is registered.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsUpdateModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-purple-900 hover:bg-purple-950 text-white font-bold shrink-0 self-start sm:self-auto cursor-pointer shadow-xs active:scale-95"
            >
              Update FIR Details
            </button>
          </div>
        )}
      </div>

      {/* ================= 2. IMPORTANT ACTIONS (Requirement 2) ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <button
          onClick={() => navigate('upload')}
          className="p-3.5 sm:p-4 rounded-2xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
        >
          <UploadCloud className="w-4 h-4 text-amber-400" />
          <span>📤 Upload Document</span>
        </button>

        <button
          onClick={handleFocusSearch}
          className="p-3.5 sm:p-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs sm:text-sm shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
        >
          <Search className="w-4 h-4 text-blue-900" />
          <span>🔍 Search Documents</span>
        </button>

        <button
          onClick={() => setIsUpdateModalOpen(true)}
          className="p-3.5 sm:p-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs sm:text-sm shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
        >
          <Edit3 className="w-4 h-4 text-amber-600" />
          <span>✏️ Update Case</span>
        </button>
      </div>

      {/* ================= 3. CASE OVERVIEW & 4. PROGRESS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        
        {/* Left Column: Overview + Progress + Attention (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Case Overview Card (Requirement 3) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <FileText className="w-4 h-4 text-blue-900" />
              <span>Case Overview</span>
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-1 border-b border-slate-50">
                <span className="font-bold text-slate-400 uppercase text-[10px]">Incident Details:</span>
                <span className="sm:col-span-2 font-medium text-slate-800 leading-relaxed">
                  {currentCase.summary || 'Theft of gold ornaments reported at Sevoke Road jewellery store.'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-1 border-b border-slate-50">
                <span className="font-bold text-slate-400 uppercase text-[10px]">Incident Date:</span>
                <span className="sm:col-span-2 font-semibold text-slate-800">
                  {formatIndianDate(currentCase.dateOpened)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-1 border-b border-slate-50">
                <span className="font-bold text-slate-400 uppercase text-[10px]">Location:</span>
                <span className="sm:col-span-2 font-semibold text-slate-800 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>{currentCase.location || 'Sevoke Road Main Market Area, Siliguri'}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-1 border-b border-slate-50">
                <span className="font-bold text-slate-400 uppercase text-[10px]">Investigating Officer:</span>
                <span className="sm:col-span-2 font-bold text-slate-900">
                  {currentCase.investigatingOfficer}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-1 border-b border-slate-50">
                <span className="font-bold text-slate-400 uppercase text-[10px]">Current Status:</span>
                <span className="sm:col-span-2 font-bold text-blue-900">
                  {currentCase.status}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-1">
                <span className="font-bold text-slate-400 uppercase text-[10px]">Available Documents:</span>
                <span className="sm:col-span-2 font-bold text-slate-900 font-mono">
                  {caseDocs.length} Certified Files
                </span>
              </div>
            </div>
          </div>

          {/* Case Progress Indicator (Requirement 4) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Clock className="w-4 h-4 text-blue-900" />
              <span>Case Progress</span>
            </h2>

            {isTemporaryCase ? (
              /* Progress for Temporary Case */
              <div className="flex items-center gap-2 flex-wrap text-xs font-bold pt-1">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Case Created ✓</span>
                </span>
                <span className="text-slate-300">→</span>
                <span className="px-3 py-1.5 rounded-xl bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-700 animate-ping"></span>
                  <span>FIR Registration ●</span>
                </span>
                <span className="text-slate-300">→</span>
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-400">
                  Investigation ○
                </span>
              </div>
            ) : (
              /* Progress for Standard Case */
              <div className="flex items-center gap-2 flex-wrap text-xs font-bold pt-1">
                <span className="px-2.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 flex items-center gap-1">
                  <span>Case Created ✓</span>
                </span>
                <span className="text-slate-300">→</span>
                <span className="px-2.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 flex items-center gap-1">
                  <span>Preliminary Info ✓</span>
                </span>
                <span className="text-slate-300">→</span>
                <span className="px-2.5 py-1.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                  <span>Investigation ●</span>
                </span>
                <span className="text-slate-300">→</span>
                <span className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-400">
                  Charge Sheet ○
                </span>
                <span className="text-slate-300">→</span>
                <span className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-400">
                  Court Proceedings ○
                </span>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: 7. Requires Attention + 8. Recent Activity (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Requires Attention Card (Requirement 7) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Requires Attention</span>
            </h2>

            <div className="space-y-2.5 text-xs">
              {pendingReviewDocs.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2">
                  <div className="font-bold text-amber-950">
                    🟡 {pendingReviewDocs.length} documents waiting for review
                  </div>
                  <button
                    onClick={() => navigate('doc-viewer', { docId: pendingReviewDocs[0].id })}
                    className="px-2.5 py-1 rounded-lg bg-amber-900 text-white font-bold text-[11px] cursor-pointer"
                  >
                    Review
                  </button>
                </div>
              )}

              {tamperedInCase.length > 0 && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-2">
                  <div className="font-bold text-red-950">
                    🔴 {tamperedInCase.length} document requires integrity verification
                  </div>
                  <button
                    onClick={() => navigate('doc-viewer', { docId: tamperedInCase[0].id })}
                    className="px-2.5 py-1 rounded-lg bg-red-900 text-white font-bold text-[11px] cursor-pointer"
                  >
                    Verify
                  </button>
                </div>
              )}

              {isFirMissing && (
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between gap-2">
                  <div className="font-bold text-purple-950">
                    🟣 FIR number has not been added
                  </div>
                  <button
                    onClick={() => setIsUpdateModalOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-purple-900 text-white font-bold text-[11px] cursor-pointer"
                  >
                    Update Case
                  </button>
                </div>
              )}

              {pendingReviewDocs.length === 0 && tamperedInCase.length === 0 && !isFirMissing && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>🟢 No action required</span>
                </div>
              )}
            </div>
          </div>

          {/* Recent Case Activity Timeline (Requirement 8) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Clock className="w-4 h-4 text-blue-900" />
              <span>Recent Activity</span>
            </h2>

            <div className="space-y-3 text-xs relative pl-3 border-l-2 border-slate-200">
              <div className="relative pl-3">
                <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-blue-900"></div>
                <div className="text-slate-400 text-[10px] font-bold">Today — 10:42 AM</div>
                <div className="text-slate-800 font-medium">Inspector Sharma viewed FIR_1024.pdf</div>
              </div>

              <div className="relative pl-3">
                <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-600"></div>
                <div className="text-slate-400 text-[10px] font-bold">Today — 10:30 AM</div>
                <div className="text-slate-800 font-medium">SI Rahul Das uploaded Investigation_Report.pdf</div>
              </div>

              <div className="relative pl-3">
                <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                <div className="text-slate-400 text-[10px] font-bold">Yesterday — 04:15 PM</div>
                <div className="text-slate-800 font-medium">Inspector Sharma updated case information</div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ================= 5. CASE DOCUMENTS SECTION (Requirements 5 & 6) ================= */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        
        {/* Documents Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>📄 Case Documents</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {caseDocs.length} Files
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Certified legal files, evidence photographs, and witness records
            </p>
          </div>

          <button
            onClick={() => navigate('upload')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold shadow-xs transition cursor-pointer self-start sm:self-auto active:scale-95"
          >
            <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
            <span>+ Upload Document</span>
          </button>
        </div>

        {/* In-Case Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={docSearchQuery}
            onChange={(e) => setDocSearchQuery(e.target.value)}
            placeholder="🔍 Search documents in this case by title, type, or officer..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-900"
          />
        </div>

        {/* Document Cards List */}
        {filteredCaseDocs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs space-y-2">
            <div>No documents found in this case matching your search.</div>
            <button
              onClick={() => navigate('upload')}
              className="text-xs font-bold text-blue-900 hover:underline"
            >
              + Upload Document to Case
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredCaseDocs.map((d) => {
              const isTampered = !!tamperedDocs[d.id];
              const isPhoto = d.name.endsWith('.jpg') || d.name.endsWith('.png') || d.docType === 'Evidence Photograph';

              return (
                <div
                  key={d.id}
                  onClick={() => navigate('doc-viewer', { docId: d.id })}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50/40 transition cursor-pointer flex flex-col justify-between space-y-3 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isPhoto ? (
                          <ImageIcon className="w-4 h-4 text-emerald-700 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-blue-900 shrink-0" />
                        )}
                        <span className="text-[11px] font-bold uppercase text-slate-600 font-mono">
                          {d.docType}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                        v{d.version}
                      </span>
                    </div>

                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-900 transition leading-snug truncate">
                      {d.name}
                    </h3>

                    <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
                      <span>{formatIndianDate(d.uploadDate)}</span>
                      <IntegrityBadge isVerified={d.status === 'Verified'} isTampered={isTampered} />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                      {d.uploadedBy}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('doc-viewer', { docId: d.id });
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold transition shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ================= 9. OFFICER INTERNAL NOTES (Requirement 9) ================= */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-900" />
              <span>Officer Notes</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Internal investigation remarks visible only to assigned station officers
            </p>
          </div>

          <button
            onClick={() => setIsAddNoteOpen(!isAddNoteOpen)}
            className="px-3.5 py-1.5 rounded-xl border border-blue-900 text-blue-900 hover:bg-blue-50 text-xs font-bold transition cursor-pointer"
          >
            {isAddNoteOpen ? 'Cancel' : '+ Add Note'}
          </button>
        </div>

        {/* Add Note Form */}
        {isAddNoteOpen && (
          <form onSubmit={handleAddNote} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 animate-in fade-in duration-150">
            <textarea
              rows={2}
              required
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="e.g. Awaiting forensic report from SFSL Kolkata..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 bg-white"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3 h-3" />
                <span>Save Note</span>
              </button>
            </div>
          </form>
        )}

        {/* Notes List */}
        <div className="space-y-2.5">
          {notes.map((n) => (
            <div key={n.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span>👮</span>
                  <span>{n.author}</span>
                  <span className="text-[10px] text-slate-400 font-normal">({n.role})</span>
                </span>
                <span className="text-[10px] font-mono">{n.time}</span>
              </div>
              <p className="text-slate-800 font-medium leading-relaxed pl-5">
                "{n.text}"
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ================= 11. UPDATE CASE MODAL (Requirement 11) ================= */}
      {isUpdateModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsUpdateModalOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-[#072047] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm">Update Case Information</h3>
              </div>
              <button 
                onClick={() => setIsUpdateModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCaseUpdates} className="p-5 space-y-3 text-xs overflow-y-auto flex-1">
              <div>
                <label className="block font-bold text-slate-700 mb-1">FIR Number</label>
                <input
                  type="text"
                  value={editFormData.firNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, firNumber: e.target.value })}
                  placeholder="e.g. FIR-2026-1024"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Incident Date</label>
                  <input
                    type="date"
                    value={editFormData.dateOpened}
                    onChange={(e) => setEditFormData({ ...editFormData, dateOpened: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Case Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  >
                    <option value="Active">Active</option>
                    <option value="Investigation">Investigation</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Investigating Officer (I.O.)</label>
                <input
                  type="text"
                  value={editFormData.investigatingOfficer}
                  onChange={(e) => setEditFormData({ ...editFormData, investigatingOfficer: e.target.value })}
                  placeholder="e.g. Inspector Sharma"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Incident Location</label>
                <input
                  type="text"
                  value={editFormData.location}
                  onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                  placeholder="e.g. Main Market Area, Sevoke Road"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Incident Details / Brief Summary</label>
                <textarea
                  rows={3}
                  value={editFormData.summary}
                  onChange={(e) => setEditFormData({ ...editFormData, summary: e.target.value })}
                  placeholder="Summary of incident..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 leading-relaxed font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsUpdateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
