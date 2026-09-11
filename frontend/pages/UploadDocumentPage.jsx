import React, { useState } from 'react';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  FolderLock, 
  FileCheck, 
  HelpCircle,
  Eye,
  Plus,
  Camera,
  FolderOpen,
  Image as ImageIcon,
  Trash2,
  Lock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DOCUMENT_TYPES } from '../../database/seeds/mockData';

export const UploadDocumentPage = () => {
  const { cases, addDocument, navigate, selectedCaseId, currentUser } = useApp();

  // Form State
  const [caseId, setCaseId] = useState(selectedCaseId || 'CASE-1024');
  const [docType, setDocType] = useState('FIR');
  const [docName, setDocName] = useState('');
  const [classification, setClassification] = useState('Confidential');
  const [fileName, setFileName] = useState('FIR_1024_Certified_Copy.pdf');
  const [docContent, setDocContent] = useState('');
  const [description, setDescription] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedResult, setUploadedResult] = useState(null);

  // Auto-populate sample name when docType changes
  const handleDocTypeChange = (type) => {
    setDocType(type);
    if (!docName || docName.startsWith('FIR') || docName.startsWith('Report') || docName.startsWith('Statement') || docName.startsWith('Photo') || docName.startsWith('Seizure')) {
      const sanitized = type.replace(/\s+/g, '_');
      setDocName(`${sanitized}_Record_${caseId.replace('-', '')}.pdf`);
      setFileName(`${sanitized}_Record_${caseId.replace('-', '')}.pdf`);
    }
  };

  // Sample file select & image camera capture simulation
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setDocName(file.name);

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setPreviewImage(event.target?.result);
          setDocContent(`[DIGITAL PHOTOGRAPHIC EVIDENCE ATTACHED: ${file.name}]\nImage metadata captured and SHA-256 hashed under CASEVAULT protocol.`);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewImage(null);
        const reader = new FileReader();
        reader.onload = (event) => {
          setDocContent(event.target?.result || '');
        };
        reader.readAsText(file);
      }
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);

    const effectiveName = docName || `${docType}_Record_${caseId}.pdf`;
    const effectiveContent = docContent || `GOVERNMENT OF INDIA • POLICE DEPARTMENT\nDOCUMENT: ${effectiveName}\nCASE ID: ${caseId}\nDOC TYPE: ${docType}\nCLASSIFICATION: ${classification}\nDESCRIPTION: ${description || 'Official police record'}\nFILED BY: ${currentUser?.name || 'Authorized Officer'}\nDATE: ${new Date().toLocaleDateString('en-IN')}\n\nThis legal record has been digitized and hashed under the CASEVAULT digital chain of custody protocol. Certified authentic.`;

    setTimeout(async () => {
      const created = await addDocument({
        caseId,
        docType,
        name: effectiveName,
        classification,
        content: effectiveContent,
        fileSize: `${Math.floor(250 + Math.random() * 450)} KB`,
        pageCount: Math.floor(1 + Math.random() * 4)
      });

      setUploadedResult(created);
      setIsUploading(false);
    }, 600);
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      {/* Page Title Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 sm:gap-3">
            <span>📤 Upload Case Document</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Easy mobile & camera-supported upload with instant cryptographic SHA-256 calculation
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4 text-blue-700" />
          <span>SHA-256 Auto-Hashing Enabled</span>
        </div>
      </div>

      {/* Upload Success Modal / Screen */}
      {uploadedResult ? (
        <div className="bg-white rounded-2xl border-2 border-emerald-500 p-6 sm:p-8 shadow-xl text-center space-y-5 sm:space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
              Upload Certified Authentic
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
              Document Successfully Hashed & Archived
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto mt-1">
              Your legal document is sealed under the Indian Police Digital Chain of Custody.
            </p>
          </div>

          {/* Generated Hash Box */}
          <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl max-w-xl mx-auto text-left space-y-2 border border-slate-800 shadow-inner">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-amber-400 uppercase tracking-wider">Assigned Document ID:</span>
              <span className="font-mono font-bold text-white text-sm">{uploadedResult.id}</span>
            </div>

            <div className="text-xs text-slate-400">
              <span className="font-bold uppercase tracking-wider">Generated SHA-256 Fingerprint:</span>
              <div className="font-mono text-xs sm:text-sm text-emerald-400 break-all bg-slate-950 p-2.5 rounded-lg border border-slate-800 mt-1">
                {uploadedResult.sha256}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setUploadedResult(null);
                setDocName('');
                setPreviewImage(null);
              }}
              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer active:scale-95"
            >
              Upload Another Document
            </button>

            <button
              onClick={() => navigate('doc-viewer', { docId: uploadedResult.id })}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs sm:text-sm font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Eye className="w-4 h-4 text-amber-400" />
              <span>View Uploaded Document</span>
            </button>
          </div>
        </div>
      ) : (
        /* Upload Form */
        <form onSubmit={handleUploadSubmit} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 lg:p-8 shadow-xs space-y-4 sm:space-y-6">
          
          {/* Step 1: Select Case */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center font-mono font-bold">1</span>
              <span>Select Case Dossier</span>
            </label>
            <select
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-900"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.title} ({c.policeStation})
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Document Type */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center font-mono font-bold">2</span>
              <span>Document Type</span>
            </label>
            <select
              value={docType}
              onChange={(e) => handleDocTypeChange(e.target.value)}
              className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-900"
            >
              {DOCUMENT_TYPES.map((type) => {
                const val = typeof type === 'object' ? type.value : type;
                const lbl = typeof type === 'object' ? type.label : type;
                return (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Step 3: Document Title */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center font-mono font-bold">3</span>
              <span>Document Title / File Name</span>
            </label>
            <input
              type="text"
              required
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="e.g. FIR_1024_Certified_Copy.pdf"
              className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-900 bg-white focus:ring-2 focus:ring-blue-900 font-mono"
            />
          </div>

          {/* Step 4: Choose File or Take Photo (Requirement 10) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center font-mono font-bold">4</span>
              <span>Choose File or Capture Photo Evidence</span>
            </label>

            {/* Mobile & Multi-Device Picker Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* 📷 Take Photo Button with Camera Capture */}
              <label className="flex items-center justify-center gap-2.5 p-3.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm transition cursor-pointer shadow-xs active:scale-95 text-center">
                <Camera className="w-5 h-5 text-amber-400" />
                <span>📷 Take Photo / Capture Evidence</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>

              {/* 📁 Choose From Device Button */}
              <label className="flex items-center justify-center gap-2.5 p-3.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs sm:text-sm transition cursor-pointer shadow-xs active:scale-95 text-center">
                <FolderOpen className="w-5 h-5 text-amber-400" />
                <span>📁 Choose From Device</span>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>

            {/* Selected File / Photo Preview */}
            {previewImage ? (
              <div className="p-3 bg-white rounded-xl border border-slate-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span>Captured Photo Preview ({fileName})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewImage(null);
                      setFileName('');
                    }}
                    className="text-xs text-red-600 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
                <div className="max-h-56 overflow-hidden rounded-lg bg-slate-900 flex items-center justify-center">
                  <img 
                    src={previewImage} 
                    alt="Captured Evidence Preview" 
                    className="max-h-56 w-auto object-contain rounded-lg shadow-sm"
                  />
                </div>
              </div>
            ) : fileName ? (
              <div className="p-3 bg-white rounded-xl border border-slate-300 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-mono text-slate-800 font-semibold truncate">
                  <FileText className="w-4 h-4 text-blue-900 shrink-0" />
                  <span className="truncate">{fileName}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold shrink-0">
                  Ready to hash
                </span>
              </div>
            ) : null}
          </div>

          {/* Step 5: Classification & Description */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center font-mono font-bold">5</span>
              <span>Security Classification & Notes</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['Confidential', 'Restricted', 'Secret', 'Public Record'].map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setClassification(cls)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    classification === cls
                      ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {cls}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Document Description / Chain of Custody Remarks
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Seizure memo recorded in presence of two independent witnesses..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-blue-900"
              />
            </div>
          </div>

          {/* Submit Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isUploading}
              className="w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-blue-900 hover:bg-blue-950 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-blue-950/20 transition flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Lock className="w-5 h-5 text-amber-400" />
              <span>{isUploading ? 'Hashing & Archiving to Intranet Node...' : 'Upload Securely (Calculate SHA-256)'}</span>
            </button>
          </div>

        </form>
      )}
    </div>
  );
};
