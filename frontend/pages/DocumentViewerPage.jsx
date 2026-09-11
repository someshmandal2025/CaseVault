import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Download, 
  Printer, 
  History, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Copy, 
  Check, 
  FileText, 
  Layers, 
  Lock, 
  AlertOctagon, 
  ExternalLink,
  GitCompare,
  X,
  FileCheck,
  Building2,
  Calendar,
  UserCheck,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ClipboardList,
  ThumbsUp,
  MessageSquare,
  Archive,
  ChevronDown
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ClassificationBadge, IntegrityBadge } from '../components/common/StatusBadge';
import { formatIndianDate, formatHash } from '../utils/cryptoUtils';

export const DocumentViewerPage = () => {
  const { 
    selectedDocId, 
    documents, 
    cases, 
    tamperedDocs, 
    verifyDocumentIntegrity, 
    toggleTamperDocument, 
    navigate,
    showToast,
    logActivity,
    currentUser
  } = useApp();

  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Photo Zoom & Fullscreen state
  const [photoZoom, setPhotoZoom] = useState(1);
  const [isFullScreenPhoto, setIsFullScreenPhoto] = useState(false);

  // Approval & Changes Request State (Requirement 14)
  const [isRequestChangesOpen, setIsRequestChangesOpen] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [approvalStatus, setApprovalStatus] = useState(null);

  // Delete/Archive Modal
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);

  // Close modals on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsVersionModalOpen(false);
        setIsFullScreenPhoto(false);
        setIsRequestChangesOpen(false);
        setIsArchiveModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const doc = documents.find(d => d.id === selectedDocId) || documents[0];
  const associatedCase = cases.find(c => c.id === doc.caseId) || { title: 'Unknown Case', policeStation: 'Siliguri PS' };

  const isTampered = !!tamperedDocs[doc.id];
  const activeContent = isTampered ? tamperedDocs[doc.id].tamperedContent : doc.content;

  // Check if document is an image / photograph
  const isPhotograph = doc.name.endsWith('.jpg') || doc.name.endsWith('.png') || doc.docType === 'Evidence Photograph';

  // Senior / Legal Officer permissions for Review & Approval
  const canApprove = currentUser?.role === 'senior_officer' || currentUser?.role === 'legal_officer' || currentUser?.role === 'administrator';

  // Handle Verify Integrity action
  const handleVerify = async () => {
    setIsVerifying(true);
    setVerificationResult(null);
    setTimeout(async () => {
      const res = await verifyDocumentIntegrity(doc.id);
      setVerificationResult(res);
      setIsVerifying(false);
    }, 600);
  };

  // Copy Hash
  const handleCopyHash = () => {
    navigator.clipboard.writeText(doc.sha256);
    setCopiedHash(true);
    showToast('SHA-256 Hash copied to clipboard', 'info');
    setTimeout(() => setCopiedHash(false), 2000);
  };

  // Handle Download Action
  const handleDownload = () => {
    const blob = new Blob([activeContent], { type: 'text/plain;charset=utf-8' });
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
      details: `Downloaded certified copy of ${doc.name}.`
    });

    showToast(`Downloading certified copy of ${doc.name}...`, 'success');
  };

  // Handle Senior Officer Approval
  const handleApproveDocument = () => {
    setApprovalStatus('Approved');
    logActivity({
      action: 'Approved',
      actionBadge: 'approved',
      documentId: doc.id,
      documentName: doc.name,
      caseId: doc.caseId,
      details: `Approved by ${currentUser?.name} (${currentUser?.roleLabel}). Document certified for judicial submission.`
    });
    showToast(`Document ${doc.name} approved and signed off.`, 'success');
  };

  // Handle Request Changes
  const handleRequestChangesSubmit = (e) => {
    e.preventDefault();
    if (!changeReason.trim()) return;

    setApprovalStatus('Changes Requested');
    setIsRequestChangesOpen(false);

    logActivity({
      action: 'Request Changes',
      actionBadge: 'warning',
      documentId: doc.id,
      documentName: doc.name,
      caseId: doc.caseId,
      details: `Changes requested by ${currentUser?.name}: "${changeReason}".`
    });

    showToast('Revision request logged and dispatched to investigating officer.', 'warning');
    setChangeReason('');
  };

  // Handle Archive / Restrict
  const handleConfirmArchive = () => {
    setIsArchiveModalOpen(false);
    logActivity({
      action: 'Updated',
      actionBadge: 'update',
      documentId: doc.id,
      documentName: doc.name,
      caseId: doc.caseId,
      details: `Document ${doc.name} archived/restricted from active record view.`
    });
    showToast(`Document ${doc.name} archived and restricted.`, 'success');
    navigate('documents');
  };

  // Restore Version Action
  const handleRestoreVersion = (versionNum) => {
    setIsVersionModalOpen(false);
    logActivity({
      action: 'Version Created',
      actionBadge: 'create',
      documentId: doc.id,
      documentName: doc.name,
      caseId: doc.caseId,
      details: `Restored Version ${versionNum} as active baseline by ${currentUser?.name}.`
    });
    showToast(`Restored Version ${versionNum} as active verified version.`, 'success');
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      
      {/* Top Navigation & Action Controls Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('documents')}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-blue-900 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-blue-900" />
            <span>All Documents</span>
          </button>
          <span className="text-slate-300">/</span>
          <button
            onClick={() => navigate('case-detail', { caseId: doc.caseId })}
            className="text-xs sm:text-sm font-bold text-blue-900 hover:underline truncate max-w-[200px]"
          >
            {doc.caseId}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsVersionModalOpen(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition shadow-xs cursor-pointer active:scale-95"
          >
            <History className="w-4 h-4 text-blue-900" />
            <span>Version History</span>
          </button>

          <button
            onClick={() => navigate('audit')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <ClipboardList className="w-4 h-4 text-slate-700" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold shadow-md transition cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Senior Officer Approval Bar (Requirement 14) */}
      {canApprove && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-blue-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm border border-blue-900">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs sm:text-sm font-bold flex items-center gap-2">
                <span>Senior Officer Sign-off & Review</span>
                {approvalStatus && (
                  <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold uppercase ${
                    approvalStatus === 'Approved' ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'
                  }`}>
                    {approvalStatus}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-300">
                You have judicial authorization to approve this record or request corrections.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleApproveDocument}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>✓ Approve Document</span>
            </button>

            <button
              onClick={() => setIsRequestChangesOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700 active:scale-95"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>↩ Request Changes</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Document Inspection Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        
        {/* ================= LEFT / MAIN: DOCUMENT OR PHOTO PREVIEW CANVAS ================= */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-md overflow-hidden print:border-none print:shadow-none">
            
            {/* Sheet Title Bar */}
            <div className="bg-slate-100 px-4 sm:px-6 py-3 border-b border-slate-200 flex items-center justify-between no-print">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                {isPhotograph ? (
                  <ImageIcon className="w-4 h-4 text-emerald-700" />
                ) : (
                  <FileText className="w-4 h-4 text-blue-900" />
                )}
                <span className="truncate">{doc.name}</span>
              </div>

              {/* Photo Zoom Controls (Requirement 9) */}
              {isPhotograph ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPhotoZoom(Math.max(0.6, photoZoom - 0.2))}
                    className="p-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono text-slate-600 px-1">{Math.round(photoZoom * 100)}%</span>
                  <button
                    onClick={() => setPhotoZoom(Math.min(2.5, photoZoom + 0.2))}
                    className="p-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsFullScreenPhoto(true)}
                    className="p-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-blue-900 cursor-pointer ml-1"
                    title="Full Screen Preview"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-500 font-mono shrink-0">
                  {doc.id} • Page 1/{doc.pageCount}
                </div>
              )}
            </div>

            {/* Document / Evidence Preview Canvas */}
            {isPhotograph ? (
              /* --- A. Photographic Evidence Preview Canvas (Requirement 9) --- */
              <div className="p-6 sm:p-10 bg-slate-950 flex flex-col items-center justify-center min-h-[480px] overflow-hidden relative select-none">
                <div 
                  className="transition-transform duration-200 max-w-full flex flex-col items-center"
                  style={{ transform: `scale(${photoZoom})` }}
                >
                  <div className="relative border-4 border-slate-800 rounded-xl overflow-hidden shadow-2xl bg-slate-900">
                    <svg className="w-80 sm:w-96 h-64 sm:h-72 bg-gradient-to-br from-slate-800 to-slate-950" viewBox="0 0 400 300">
                      <rect width="400" height="300" fill="#0f172a" />
                      <circle cx="200" cy="150" r="70" fill="#1e293b" />
                      <path d="M 130 220 L 200 130 L 270 220 Z" fill="#334155" />
                      <circle cx="160" cy="110" r="18" fill="#f59e0b" opacity="0.8" />
                      <text x="200" y="270" textAnchor="middle" fill="#94a3b8" fontSize="12" fontFamily="monospace">
                        CRIME SCENE EVIDENCE PHOTOGRAPH #{doc.id}
                      </text>
                      <text x="200" y="40" textAnchor="middle" fill="#f59e0b" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
                        POLICE EVIDENCE SEAL • SHA-256 RECORDED
                      </text>
                    </svg>
                  </div>
                </div>

                <div className="mt-4 text-center text-xs text-slate-400 font-mono">
                  Original Resolution: 3840x2160 • EXIF Timestamp: {formatIndianDate(doc.uploadDate)} • Unaltered Sensor Capture
                </div>
              </div>
            ) : (
              /* --- B. Certified Police Legal Record Canvas --- */
              <div className="p-5 sm:p-10 lg:p-12 relative min-h-[520px] bg-white text-slate-900 space-y-5 sm:space-y-6">
                {/* Subtle Government Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none">
                  <div className="text-center">
                    <div className="text-7xl sm:text-9xl font-black font-serif">NCRB</div>
                    <div className="text-xl sm:text-2xl font-bold tracking-widest mt-2">GOVERNMENT OF INDIA</div>
                  </div>
                </div>

                {/* Tamper Alert Stamp (If altered) */}
                {isTampered && (
                  <div className="absolute top-4 right-4 sm:top-6 sm:right-6 rotate-12 bg-red-600/90 text-white font-black text-xs px-3 py-1.5 rounded border-2 border-dashed border-white shadow-lg pointer-events-none animate-pulse z-10">
                    ⚠ TAMPER DETECTED
                  </div>
                )}

                {/* Official Header */}
                <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                  <div className="text-[11px] sm:text-xs tracking-widest font-extrabold uppercase text-slate-700">
                    GOVERNMENT OF WEST BENGAL • POLICE DEPARTMENT
                  </div>
                  <div className="text-[11px] sm:text-xs font-bold text-slate-600 uppercase">
                    {associatedCase.policeStation?.toUpperCase()}
                  </div>
                  <h2 className="text-lg sm:text-2xl font-black text-slate-950 tracking-tight pt-1 uppercase">
                    {doc.docTypeLabel || doc.docType}
                  </h2>
                  <div className="text-[11px] sm:text-xs font-mono font-semibold text-slate-600">
                    Case ID: {doc.caseId} | FIR Ref: {associatedCase.firNumber || '1024/2026'}
                  </div>
                </div>

                {/* Document Metadata Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-medium">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Document ID:</span>
                    <span className="font-mono font-bold text-slate-900">{doc.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Version:</span>
                    <span className="font-bold text-slate-900">v{doc.version}.0 (Final)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Filed By:</span>
                    <span className="font-bold text-slate-900 truncate block">{doc.uploadedBy}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Date of Record:</span>
                    <span className="font-bold text-slate-900">{formatIndianDate(doc.uploadDate)}</span>
                  </div>
                </div>

                {/* Legal Record Content Body */}
                <div className="text-xs sm:text-sm md:text-base leading-relaxed text-slate-900 whitespace-pre-wrap font-serif bg-amber-50/20 p-4 sm:p-6 rounded-xl border border-amber-100/50">
                  {activeContent}
                </div>

                {/* Official Seal & Signature Block */}
                <div className="pt-6 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl border-2 border-blue-900 text-blue-950 font-mono w-full sm:w-auto">
                    <FileCheck className="w-7 h-7 text-blue-900 shrink-0" />
                    <div>
                      <div className="font-bold text-[10px] tracking-wider uppercase">DIGITALLY VERIFIED RECORD</div>
                      <div className="text-[9px] text-slate-500 font-mono">CASEVAULT SHA-256 PROTOCOL</div>
                    </div>
                  </div>

                  <div className="text-center sm:text-right space-y-0.5 w-full sm:w-auto">
                    <div className="font-mono text-[10px] text-slate-400">Digitally signed & sealed by:</div>
                    <div className="font-bold text-slate-900 text-xs sm:text-sm">
                      {doc.uploadedBy}
                    </div>
                    <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                      {doc.uploadedByRole || 'Investigating Officer'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ================= RIGHT: DOCUMENT INFO, INTEGRITY, & ACTIONS ================= */}
        <div className="lg:col-span-4 space-y-4 no-print">
          
          {/* Document Information Card (Requirement 8) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                {doc.id}
              </span>
              <ClassificationBadge classification={doc.classification} />
            </div>

            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight break-all">
              {doc.name}
            </h1>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Document:</span>
                <span className="font-bold text-slate-900 font-mono">{doc.name}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Case Dossier:</span>
                <button
                  onClick={() => navigate('case-detail', { caseId: doc.caseId })}
                  className="font-bold text-blue-900 hover:underline"
                >
                  {doc.caseId}
                </button>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Document Type:</span>
                <span className="font-bold text-slate-900">{doc.docType}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Version:</span>
                <span className="font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                  v{doc.version}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Uploaded By:</span>
                <span className="font-bold text-slate-900">{doc.uploadedBy}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Upload Date:</span>
                <span className="font-medium text-slate-700">{formatIndianDate(doc.uploadDate)}</span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-slate-500">Security Status:</span>
                <IntegrityBadge isVerified={doc.status === 'Verified'} isTampered={isTampered} />
              </div>
            </div>
          </div>

          {/* Document Integrity Card (Requirement 10: Simple for Constables) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Document Integrity</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                {isTampered ? 'Tamper Detected' : '🟢 Verified'}
              </span>
            </div>

            {/* Simple constable-friendly explanation */}
            <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
              isTampered
                ? 'bg-red-50 border-red-200 text-red-900 font-medium'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900 font-medium'
            }`}>
              {isTampered
                ? '⚠ WARNING: The document content has been modified without authorization. Checksum mismatch detected.'
                : '✓ The document has not changed since the stored integrity record was created.'}
            </div>

            {/* Verify Button */}
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-amber-400 ${isVerifying ? 'animate-spin' : ''}`} />
              <span>{isVerifying ? 'Verifying Integrity...' : 'Verify Integrity (SHA-256)'}</span>
            </button>

            {/* Expandable Technical Details (Requirement 10) */}
            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="w-full text-left text-xs font-bold text-blue-900 hover:underline flex items-center justify-between cursor-pointer py-1"
              >
                <span>{showTechnicalDetails ? 'Hide Technical Details' : 'View Technical Details'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTechnicalDetails ? 'rotate-180' : ''}`} />
              </button>

              {showTechnicalDetails && (
                <div className="p-3 bg-slate-900 text-white rounded-xl space-y-2 mt-2 text-xs font-mono animate-in fade-in duration-100">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                      <span>Live SHA-256 Checksum:</span>
                      <button onClick={handleCopyHash} className="text-amber-400 hover:underline text-[10px]">Copy</button>
                    </div>
                    <div className="text-[11px] text-emerald-400 break-all bg-slate-950 p-2 rounded mt-0.5">
                      {doc.sha256}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Stored Blockchain Record:</div>
                    <div className="text-[11px] text-blue-300 break-all bg-slate-950 p-2 rounded mt-0.5">
                      {doc.sha256}
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 flex justify-between pt-1">
                    <span>Verification Node:</span>
                    <span className="text-slate-200">{doc.lastVerified}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2">
            <button
              onClick={handleDownload}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Download Record</span>
            </button>

            <button
              onClick={() => setIsVersionModalOpen(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <History className="w-4 h-4 text-blue-900" />
              <span>Version History</span>
            </button>

            <button
              onClick={() => navigate('audit')}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <ClipboardList className="w-4 h-4 text-blue-900" />
              <span>View Audit Trail</span>
            </button>

            {/* Hackathon Simulation */}
            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => toggleTamperDocument(doc.id)}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                  isTampered
                    ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{isTampered ? 'Restore Original Document' : 'Simulate Document Tampering'}</span>
              </button>
            </div>

            {/* Restrict / Archive */}
            <div className="pt-1">
              <button
                onClick={() => setIsArchiveModalOpen(true)}
                className="w-full py-1.5 text-center text-xs text-red-600 hover:underline font-semibold cursor-pointer"
              >
                Archive or Restrict Document
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* ================= 1. FULLSCREEN PHOTO MODAL (Requirement 9) ================= */}
      {isFullScreenPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsFullScreenPhoto(false)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={() => handleDownload()}
              className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Download</span>
            </button>
            <button
              onClick={() => setIsFullScreenPhoto(false)}
              className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <svg className="w-full max-w-2xl h-auto bg-slate-900 rounded-2xl shadow-2xl" viewBox="0 0 400 300">
              <rect width="400" height="300" fill="#0f172a" />
              <circle cx="200" cy="150" r="70" fill="#1e293b" />
              <path d="M 130 220 L 200 130 L 270 220 Z" fill="#334155" />
              <circle cx="160" cy="110" r="18" fill="#f59e0b" opacity="0.8" />
              <text x="200" y="270" textAnchor="middle" fill="#94a3b8" fontSize="12" fontFamily="monospace">
                CRIME SCENE EVIDENCE PHOTOGRAPH #{doc.id}
              </text>
              <text x="200" y="40" textAnchor="middle" fill="#f59e0b" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
                POLICE EVIDENCE SEAL • SHA-256 RECORDED
              </text>
            </svg>
            <div className="mt-3 text-white text-xs font-mono">{doc.name} • Case {doc.caseId}</div>
          </div>
        </div>
      )}

      {/* ================= 2. REQUEST CHANGES MODAL (Requirement 14) ================= */}
      {isRequestChangesOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsRequestChangesOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-[#072047] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm">Request Changes on Document</h3>
              </div>
              <button 
                onClick={() => setIsRequestChangesOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRequestChangesSubmit} className="p-5 space-y-3 text-xs">
              <p className="text-slate-600">
                Specify the required corrections for <strong>{doc.name}</strong>. This feedback will be recorded in the audit trail.
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason / Instructions *</label>
                <textarea
                  rows={3}
                  required
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="e.g. Please upload a clearer scan with complete seal."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRequestChangesOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
                >
                  Submit Revision Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= 3. VERSION HISTORY MODAL (Requirement 11) ================= */}
      {isVersionModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsVersionModalOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b-2 border-amber-500">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-800 flex items-center justify-center text-amber-400 shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold">Version History — {doc.name}</h2>
                  <p className="text-[11px] text-slate-300">Inspect historical versions without overwriting previous entries</p>
                </div>
              </div>
              <button 
                onClick={() => setIsVersionModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Version List */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {/* Version 2 (Current) */}
              <div className="p-4 rounded-xl border-2 border-blue-300 bg-blue-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-900 text-xs px-2.5 py-0.5 rounded bg-blue-200">
                      Version {doc.version} (Active Verified)
                    </span>
                    <span className="text-slate-500 font-semibold">{formatIndianDate(doc.uploadDate)}</span>
                  </div>
                  <span className="text-emerald-700 font-bold">🟢 Current</span>
                </div>
                <div className="text-slate-700">
                  Uploaded by: <strong>{doc.uploadedBy}</strong> ({doc.uploadedByRole || 'Investigating Officer'})
                </div>
                <div className="font-mono text-[11px] text-slate-500 break-all">
                  SHA-256: {doc.sha256}
                </div>
              </div>

              {/* Version 1 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-xs px-2.5 py-0.5 rounded bg-slate-200">
                      Version 1 (Initial Filing)
                    </span>
                    <span className="text-slate-500">18 Aug 2026</span>
                  </div>
                  <button
                    onClick={() => handleRestoreVersion(1)}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer"
                  >
                    Restore Version 1
                  </button>
                </div>
                <div className="text-slate-700">
                  Uploaded by: <strong>Inspector Sharma</strong> (Station House Officer)
                </div>
                <div className="font-mono text-[11px] text-slate-500 break-all">
                  SHA-256: 3d91ca8e49104fa2890bb7841029471abef1983049102847102948172940182a
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setIsVersionModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. ARCHIVE MODAL (Requirement 17) ================= */}
      {isArchiveModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsArchiveModalOpen(false)}
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
                onClick={() => setIsArchiveModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs text-slate-700 leading-relaxed">
              <p>
                Are you sure you want to restrict <strong>{doc.name}</strong> from normal case access?
              </p>
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-950">
                This document will be archived and hidden from general view. Under evidentiary laws, the action will be recorded in the permanent audit trail.
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setIsArchiveModalOpen(false)}
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
