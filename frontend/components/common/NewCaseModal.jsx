import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  FilePlus, 
  Calendar, 
  MapPin, 
  User, 
  Building2, 
  FileText, 
  AlertCircle,
  Hash,
  Clock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { POLICE_STATIONS } from '../../../database/seeds/mockData';

export const NewCaseModal = () => {
  const { 
    isNewCaseModalOpen, 
    closeNewCaseModal, 
    addCase, 
    currentUser, 
    showToast, 
    navigate 
  } = useApp();

  const [formData, setFormData] = useState({
    title: '',
    caseType: 'Theft',
    firNumber: '',
    dateOpened: new Date().toISOString().split('T')[0],
    policeStation: '',
    investigatingOfficer: '',
    assistingOfficer: 'Const. S. Dey',
    status: 'Open',
    priority: 'Medium',
    complainantName: '',
    suspectName: '',
    incidentLocation: '',
    description: '',
    applicableActs: 'IPC 379 / BNS 303'
  });

  const [errors, setErrors] = useState({});

  // Initialize defaults whenever modal opens or current user changes
  useEffect(() => {
    if (isNewCaseModalOpen) {
      const randomFIR = `FIR/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;
      setFormData({
        title: '',
        caseType: 'Theft',
        firNumber: randomFIR,
        dateOpened: new Date().toISOString().split('T')[0],
        policeStation: currentUser?.policeStation || 'Kolkata Cyber PS',
        investigatingOfficer: currentUser?.name || 'Insp. Rajesh Sharma',
        assistingOfficer: 'Const. S. Dey',
        status: 'Open',
        priority: 'Medium',
        complainantName: '',
        suspectName: '',
        incidentLocation: '',
        description: '',
        applicableActs: 'IPC 379 / BNS 303'
      });
      setErrors({});
    }
  }, [isNewCaseModalOpen, currentUser]);

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isNewCaseModalOpen) {
        closeNewCaseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNewCaseModalOpen, closeNewCaseModal]);

  if (!isNewCaseModalOpen) return null;

  // Auto-update applicable act based on case type
  const handleCaseTypeChange = (type) => {
    let act = 'IPC / BNS';
    if (type === 'Theft') act = 'IPC 379 (BNS 303)';
    else if (type === 'Cybercrime') act = 'IT Act Sec 66C/66D & IPC 420';
    else if (type === 'Fraud') act = 'IPC 420 (Cheating & Dishonesty)';
    else if (type === 'Assault') act = 'IPC 323 / 324 (Voluntarily Causing Hurt)';
    else if (type === 'Missing Person') act = 'General Diary / Sec 154 CrPC';
    else if (type === 'Robbery') act = 'IPC 392 / 395';

    setFormData(prev => ({
      ...prev,
      caseType: type,
      applicableActs: act
    }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Case title or subject is required';
    if (!formData.policeStation) newErrors.policeStation = 'Police Station is required';
    if (!formData.investigatingOfficer.trim()) newErrors.investigatingOfficer = 'Investigating Officer is required';
    if (!formData.description.trim()) newErrors.description = 'Incident description or FIR summary is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const newCase = addCase({
      ...formData,
      documentsCount: 0,
      verifiedHashStatus: 'Pending First Document'
    });

    closeNewCaseModal();
    showToast(`Case ${newCase.id} (${newCase.firNumber}) registered successfully!`, 'success');
    
    // Smoothly navigate directly to the new case detail page
    setTimeout(() => {
      navigate('case-detail', { caseId: newCase.id });
    }, 150);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={closeNewCaseModal}
    >
      
      {/* Modal Container */}
      <div 
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="bg-[#071c3d] text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-900/80 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
              <FilePlus className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base lg:text-lg font-black tracking-tight text-white flex items-center gap-2 truncate">
                Register New Case / FIR
              </h3>
              <p className="text-[10px] sm:text-xs text-amber-400 font-medium truncate">
                National Crime Records Bureau • First Information Report
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeNewCaseModal}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
            title="Close (Esc)"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1">
          
          {/* FIR Number & Case Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                FIR / GD Reference No. <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={formData.firNumber}
                  onChange={(e) => setFormData({ ...formData, firNumber: e.target.value })}
                  placeholder="e.g. FIR/2026/0892"
                  className="w-full pl-9 pr-3 py-2 sm:py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold font-mono text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Case Category / Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.caseType}
                onChange={(e) => handleCaseTypeChange(e.target.value)}
                className="w-full px-3 py-2 sm:py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-900"
              >
                <option value="Theft">Theft (Sec 379)</option>
                <option value="Cybercrime">Cybercrime / Online Fraud (IT Act)</option>
                <option value="Fraud">Financial Fraud / Cheating (Sec 420)</option>
                <option value="Missing Person">Missing Person / GD</option>
                <option value="Assault">Physical Assault / Violence</option>
                <option value="Robbery">Robbery / Dacoity</option>
              </select>
            </div>
          </div>

          {/* Case Title / Primary Subject */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Case Title / Incident Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={formData.title}
              onChange={(e) => {
                setFormData({ ...formData, title: e.target.value });
                if (errors.title) setErrors({ ...errors, title: null });
              }}
              placeholder="e.g. Jewelry Theft at Park Street Residence"
              className={`w-full px-3 py-2 sm:py-2.5 rounded-xl border text-xs sm:text-sm font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-blue-900 ${
                errors.title ? 'border-red-500 bg-red-50/30' : 'border-slate-300'
              }`}
            />
            {errors.title && (
              <div className="text-red-600 text-xs font-semibold mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.title}</span>
              </div>
            )}
          </div>

          {/* Station & Incident Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Police Station <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <select
                  value={formData.policeStation}
                  onChange={(e) => setFormData({ ...formData, policeStation: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 sm:py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-blue-900"
                >
                  {POLICE_STATIONS.map((ps) => (
                    <option key={ps} value={ps}>{ps}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Incident / Filing Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="date"
                  value={formData.dateOpened}
                  onChange={(e) => setFormData({ ...formData, dateOpened: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 sm:py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-blue-900"
                  required
                />
              </div>
            </div>
          </div>

          {/* Investigating Officer & Sections */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Investigating Officer (I.O.) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={formData.investigatingOfficer}
                  onChange={(e) => setFormData({ ...formData, investigatingOfficer: e.target.value })}
                  placeholder="e.g. Insp. Rajesh Sharma"
                  className="w-full pl-9 pr-3 py-2 sm:py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-blue-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Applicable Legal Sections
              </label>
              <input
                type="text"
                value={formData.applicableActs}
                onChange={(e) => setFormData({ ...formData, applicableActs: e.target.value })}
                placeholder="e.g. IPC 379 / BNS 303"
                className="w-full px-3 py-2 sm:py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-900"
              />
            </div>
          </div>

          {/* Description / Summary */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Incident Narrative / FIR Brief <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                if (errors.description) setErrors({ ...errors, description: null });
              }}
              placeholder="Provide a factual summary of the complaint or incident as stated by the informant..."
              className={`w-full px-3 py-2 sm:py-2.5 rounded-xl border text-xs sm:text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-900 ${
                errors.description ? 'border-red-500 bg-red-50/30' : 'border-slate-300'
              }`}
            />
            {errors.description && (
              <div className="text-red-600 text-xs font-semibold mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.description}</span>
              </div>
            )}
          </div>

          {/* Form Actions (Responsive full-width on mobile) */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={closeNewCaseModal}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-black transition shadow-md shadow-blue-950/20 cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Register & Create Dossier</span>
            </button>
          </div>

        </form>
      </div>

    </div>
  );
};
