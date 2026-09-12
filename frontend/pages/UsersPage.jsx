import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  CheckCircle2, 
  Ban, 
  X, 
  Building2,
  Lock,
  Camera,
  Upload,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Search,
  Filter,
  Check,
  AlertCircle,
  Scan,
  Shield,
  Edit,
  User,
  Calendar,
  Clock,
  Trash2,
  FileText
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { POLICE_STATIONS } from '../../database/seeds/mockData';
import { 
  runOcrOnIdImage, 
  preprocessImageForOcr,
  generateSampleBadgeCardFile,
  mapRankToCategoryAndRank,
  isValidIdCardImage,
  evaluateFieldConfidence
} from '../utils/idOcrEngine';

const CATEGORY_RANKS = {
  police_officer: ['Constable', 'Head Constable', 'ASI', 'SI'],
  senior_officer: ['Inspector', 'ACP / DSP', 'Addl. SP', 'SP / SSP', 'DIG', 'IG', 'ADGP', 'DGP'],
  legal_officer: ['Legal Officer', 'Public Prosecutor', 'Legal Advisor', 'Law Officer'],
  administrator: ['System Administrator', 'Administrative Officer', 'Department Administrator', 'IT / System Manager']
};

const CATEGORY_BADGES = {
  police_officer: { label: 'Officer', icon: '👮', color: 'bg-blue-100 text-blue-900 border-blue-200' },
  senior_officer: { label: 'Senior Officer', icon: '⭐', color: 'bg-amber-100 text-amber-900 border-amber-300' },
  legal_officer: { label: 'Legal Officer', icon: '⚖️', color: 'bg-purple-100 text-purple-900 border-purple-200' },
  administrator: { label: 'Administrator', icon: '🛡️', color: 'bg-[#0B2D4D] text-white border-slate-700' }
};

export const UsersPage = () => {
  const { users, currentUser, toggleUserStatus, addUser, updateUser, deleteUser, showToast, logActivity } = useApp();

  // Search & Role / Rank / Status Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL'); // 'ALL' | 'police_officer' | 'senior_officer' | 'legal_officer' | 'administrator' | 'Active' | 'Disabled'
  const [rankFilter, setRankFilter] = useState('ALL');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('scan'); // 'scan' | 'manual'
  const fileInputRef = useRef(null);

  // Confirmation Modals
  const [isConfirmAddModalOpen, setIsConfirmAddModalOpen] = useState(false);
  const [statusConfirmTarget, setStatusConfirmTarget] = useState(null);
  const [profileViewTarget, setProfileViewTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  // OCR Scan State
  const [ocrStatus, setOcrStatus] = useState('idle'); // 'idle' | 'reading' | 'success' | 'error'
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState('');
  const [idImagePreview, setIdImagePreview] = useState(null);
  const [idCardFile, setIdCardFile] = useState(null);

  // Detected OCR fields for review
  const [ocrDetectedInfo, setOcrDetectedInfo] = useState({
    name: '',
    officerId: '',
    rank: '',
    policeStation: '',
    email: '',
    phone: ''
  });

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

  // New Officer Form State
  const initialFormState = {
    name: '',
    officerId: '',
    role: 'police_officer',
    badge: 'Constable',
    rank: 'Constable',
    policeStation: 'Siliguri Police Station',
    district: 'Darjeeling District',
    email: '',
    phone: '',
    password: '',
    avatar: '👮',
    idCardUploaded: false
  };

  const [newUserData, setNewUserData] = useState(initialFormState);
  const [editFormData, setEditFormData] = useState({});

  // Reset Add Officer Form & OCR
  const resetFormAndOcr = () => {
    setNewUserData(initialFormState);
    setOcrStatus('idle');
    setOcrProgress(0);
    setOcrError('');
    setIdImagePreview(null);
    setIdCardFile(null);
    setOcrDetectedInfo({
      name: '',
      officerId: '',
      rank: '',
      policeStation: '',
      email: '',
      phone: ''
    });
    setShowPassword(false);
    setFormError('');
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsAddModalOpen(false);
        setIsConfirmAddModalOpen(false);
        setStatusConfirmTarget(null);
        setProfileViewTarget(null);
        setEditTarget(null);
        setDeleteConfirmTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle Category Selection Change in Add Officer Form
  const handleCategoryChange = (newRole) => {
    const defaultRanks = CATEGORY_RANKS[newRole] || ['Constable'];
    const avatarMap = {
      police_officer: '👮',
      senior_officer: '👮‍♂️',
      legal_officer: '⚖️',
      administrator: '🛡️'
    };

    setNewUserData(prev => ({
      ...prev,
      role: newRole,
      rank: defaultRanks[0],
      badge: defaultRanks[0],
      avatar: prev.avatar && (prev.avatar.startsWith('data:image') || prev.avatar.startsWith('http')) ? prev.avatar : (avatarMap[newRole] || '👮')
    }));
  };

  // Handle Category Selection Change in Edit Officer Form
  const handleEditCategoryChange = (newRole) => {
    const defaultRanks = CATEGORY_RANKS[newRole] || ['Constable'];
    setEditFormData(prev => ({
      ...prev,
      role: newRole,
      rank: defaultRanks[0],
      badge: defaultRanks[0]
    }));
  };

  // Handle OCR File Scan (Assistive only - does NOT auto-create user)
  const handleOcrFile = async (file) => {
    if (!file) return;

    const check = isValidIdCardImage(file);
    if (!check.valid && !(file instanceof Blob)) {
      setOcrStatus('error');
      setOcrError(check.message || 'Supported image formats: PNG, JPG, JPEG, WEBP.');
      return;
    }

    setOcrStatus('reading');
    setOcrProgress(15);
    setOcrError('');
    setIdCardFile(file);

    try {
      const processed = await preprocessImageForOcr(file);
      setIdImagePreview(processed.previewUrl || processed.dataUrl);
      setOcrProgress(40);

      const result = await runOcrOnIdImage(processed.dataUrl, (p) => {
        setOcrProgress(Math.min(95, 40 + Math.floor(p * 0.55)));
      });

      if (result && result.success) {
        setOcrProgress(100);
        setOcrStatus('success');

        const mapped = mapRankToCategoryAndRank(result.rank || 'Constable');
        const evalRes = evaluateFieldConfidence(result);

        const detected = {
          categoryKey: result.categoryKey || mapped.categoryKey,
          categoryLabel: result.categoryLabel || mapped.categoryLabel,
          name: result.name || '',
          officerId: result.officerId || result.badgeId || '',
          rank: result.rank || mapped.rank,
          policeStation: result.policeStation || 'Siliguri Police Station',
          email: result.email || '',
          phone: result.phone || '',
          confidenceFlags: evalRes.confidenceFlags
        };

        setOcrDetectedInfo(detected);

        setNewUserData(prev => {
          const targetRole = detected.categoryKey || prev.role;
          const validRanks = CATEGORY_RANKS[targetRole] || ['Constable'];
          const targetRank = validRanks.includes(detected.rank) ? detected.rank : validRanks[0];

          return {
            ...prev,
            role: targetRole,
            rank: targetRank,
            badge: targetRank,
            name: detected.name || prev.name,
            officerId: detected.officerId || prev.officerId,
            policeStation: detected.policeStation || prev.policeStation,
            email: detected.email || prev.email,
            phone: detected.phone || prev.phone,
            avatar: result.officerPhoto || prev.avatar,
            idCardUploaded: true
          };
        });

        logActivity({
          action: 'OCR Scan Performed',
          actionBadge: 'upload',
          details: `OCR scan performed on official ID card for candidate ${detected.name || 'officer candidate'} (${detected.officerId || 'Pending'}).`
        });

        showToast(`✓ ID Card scanned successfully! Category (${detected.categoryLabel}) & Rank (${detected.rank}) auto-selected.`, 'success');
      } else {
        setOcrStatus('error');
        setOcrError(result?.error || 'Unable to detect text cleanly from ID card. You may enter details manually below.');
      }
    } catch (err) {
      console.error('OCR Error:', err);
      setOcrStatus('error');
      setOcrError('OCR notice: Image could not be parsed cleanly. Please fill in officer details manually.');
    }
  };

  const handleUseSampleBadge = (sampleType) => {
    const sampleFile = generateSampleBadgeCardFile(sampleType);
    handleOcrFile(sampleFile);
  };

  // Step 1: Admin clicks "Confirm Officer Details" -> Validates form & opens Confirmation Modal
  const handleProceedToConfirmation = (e) => {
    e.preventDefault();
    setFormError('');

    if (!newUserData.name.trim()) {
      setFormError('Officer Full Name is required.');
      return;
    }
    if (!newUserData.officerId.trim()) {
      setFormError('Officer / Badge ID is required.');
      return;
    }
    if (!newUserData.email.trim()) {
      setFormError('Official Login Email is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUserData.email.trim())) {
      setFormError('Please enter a valid email address.');
      return;
    }

    const pass = newUserData.password || '';
    if (pass) {
      if (pass.length < 8) {
        setFormError('Password must be at least 8 characters long.');
        return;
      }
      if (!/[A-Z]/.test(pass) || !/[a-z]/.test(pass) || !/[0-9]/.test(pass) || !/[^A-Za-z0-9]/.test(pass)) {
        setFormError('Password must meet all complexity requirements (8+ chars, uppercase, lowercase, number, special character).');
        return;
      }
    }

    // Duplicate Check requirement #10
    const cleanEmail = newUserData.email.trim().toLowerCase();
    const cleanId = newUserData.officerId.trim().toLowerCase();

    const isIdDuplicate = users.some(u => (cleanId && (u.officerId || u.officer_id || u.badgeNumber || u.badge_number || u.badgeId || '').toString().trim().toLowerCase() === cleanId));
    const isEmailDuplicate = users.some(u => (cleanEmail && (u.email || '').toString().trim().toLowerCase() === cleanEmail));

    if (isIdDuplicate) {
      setFormError('Officer ID already exists.');
      logActivity({
        action: 'Duplicate Officer Creation Attempt',
        actionBadge: 'tamper',
        details: `Attempted to create duplicate Officer ID '${newUserData.officerId}'. Action blocked.`
      });
      return;
    }

    if (isEmailDuplicate) {
      setFormError('An account with this email already exists.');
      logActivity({
        action: 'Duplicate Officer Creation Attempt',
        actionBadge: 'tamper',
        details: `Attempted to create duplicate officer email '${newUserData.email}'. Action blocked.`
      });
      return;
    }

    setIsConfirmAddModalOpen(true);
  };

  // Step 2: Admin clicks "Create Officer" in Confirmation Modal -> Creates record
  const handleFinalCreateOfficer = async () => {
    const result = await addUser(newUserData);
    if (result && result.success) {
      setIsConfirmAddModalOpen(false);
      setIsAddModalOpen(false);
      resetFormAndOcr();
    } else if (result && result.error) {
      setFormError(result.error);
      setIsConfirmAddModalOpen(false);
    }
  };

  // Edit Officer Modal Handlers
  const handleOpenEdit = (officer) => {
    setEditTarget(officer);
    setEditFormData({
      name: officer.name || '',
      officerId: officer.officerId || officer.officer_id || '',
      rank: officer.rank || officer.badge || 'Constable',
      policeStation: officer.policeStation || officer.police_station || 'Siliguri Police Station',
      email: officer.email || '',
      phone: officer.phone || '',
      role: officer.role || 'police_officer'
    });
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editFormData.name.trim() || !editFormData.officerId.trim() || !editFormData.email.trim()) {
      showToast('Name, Officer ID, and Email are required fields.', 'error');
      return;
    }

    if (editTarget) {
      if (editTarget.role !== editFormData.role) {
        logActivity({
          action: 'Category Changed',
          actionBadge: 'edit',
          details: `Category changed from '${CATEGORY_BADGES[editTarget.role]?.label || editTarget.role}' to '${CATEGORY_BADGES[editFormData.role]?.label || editFormData.role}' for ${editTarget.name} (${editTarget.officerId}).`
        });
      }
      if (editTarget.rank !== editFormData.rank) {
        logActivity({
          action: 'Rank Changed',
          actionBadge: 'edit',
          details: `Rank changed from '${editTarget.rank}' to '${editFormData.rank}' for ${editTarget.name} (${editTarget.officerId}).`
        });
      }
    }

    const result = updateUser(editTarget.id, editFormData);
    if (result && result.success) {
      setEditTarget(null);
    }
  };

  // Confirm Status Toggle (Enable / Disable)
  const handleConfirmToggleStatus = () => {
    if (statusConfirmTarget) {
      const nextStatus = statusConfirmTarget.status === 'Active' ? 'Disabled' : 'Active';
      logActivity({
        action: nextStatus === 'Disabled' ? 'Officer Disabled' : 'Officer Enabled',
        actionBadge: nextStatus === 'Disabled' ? 'tamper' : 'verify',
        details: `Officer account ${statusConfirmTarget.name} (${statusConfirmTarget.officerId || statusConfirmTarget.id}) set to ${nextStatus} by ${currentUser?.name || 'Administrator'}.`
      });
      toggleUserStatus(statusConfirmTarget.id);
      setStatusConfirmTarget(null);
    }
  };

  // Confirm Delete Officer
  const handleConfirmDeleteUser = () => {
    if (deleteConfirmTarget) {
      deleteUser(deleteConfirmTarget.id);
      setDeleteConfirmTarget(null);
    }
  };

  // Available ranks for rank filter dropdown
  const getAvailableRanksForFilter = () => {
    if (roleFilter !== 'ALL' && CATEGORY_RANKS[roleFilter]) {
      return CATEGORY_RANKS[roleFilter];
    }
    // All ranks across all categories
    return Array.from(new Set(Object.values(CATEGORY_RANKS).flat()));
  };

  // Reset rank filter if invalid for current category filter
  useEffect(() => {
    if (roleFilter !== 'ALL' && CATEGORY_RANKS[roleFilter]) {
      if (rankFilter !== 'ALL' && !CATEGORY_RANKS[roleFilter].includes(rankFilter)) {
        setRankFilter('ALL');
      }
    }
  }, [roleFilter]);

  // Filter Users List
  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.officerId || u.officer_id || u.badgeNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.policeStation || u.police_station || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.rank || u.badge || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (roleFilter !== 'ALL') {
      if (roleFilter === 'Active' || roleFilter === 'Disabled') {
        if (u.status !== roleFilter) return false;
      } else {
        const uRole = (u.role || 'police_officer').toLowerCase();
        if (uRole !== roleFilter.toLowerCase()) return false;
      }
    }

    if (rankFilter !== 'ALL') {
      const uRank = (u.rank || u.badge || '').toLowerCase();
      if (uRank !== rankFilter.toLowerCase()) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200 font-sans">
      
      {/* Header Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200 uppercase tracking-wider">
              ADMINISTRATION • CATEGORY & RANK HIERARCHY (RBAC)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>👥 Authorized System Users</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Manage law enforcement officers, senior supervisory SHO/commanders, legal counsel, and system administrators.
          </p>
        </div>

        <button
          onClick={() => {
            resetFormAndOcr();
            setIsAddModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#0052cc] hover:bg-[#0043a8] text-white font-bold text-sm shadow-md transition cursor-pointer self-start sm:self-auto active:scale-95"
        >
          <UserPlus className="w-4.5 h-4.5 text-amber-300" />
          <span>+ Add Officer</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col xl:flex-row items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative w-full xl:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, badge ID, rank, station, email..."
            className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#0052cc] focus:border-[#0052cc]"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 xl:pb-0">
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" />
            {[
              { id: 'ALL', label: 'All Categories' },
              { id: 'police_officer', label: 'Officer' },
              { id: 'senior_officer', label: 'Senior Officer' },
              { id: 'legal_officer', label: 'Legal Officer' },
              { id: 'administrator', label: 'Administrator' },
              { id: 'Active', label: 'Active' },
              { id: 'Disabled', label: 'Disabled' }
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setRoleFilter(r.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  roleFilter === r.id
                    ? 'bg-[#0B2D4D] text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Dynamic Rank Filter Dropdown */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Rank:</span>
            <select
              value={rankFilter}
              onChange={(e) => setRankFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-[#0052cc]"
            >
              <option value="ALL">All Ranks</option>
              {getAvailableRanksForFilter().map((rnk) => (
                <option key={rnk} value={rnk}>{rnk}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Users Table / Responsive Grid Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* 1. DESKTOP & TABLET TABLE VIEW */}
        <div className="hidden md:block overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full text-left border-collapse min-w-full">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 text-[11px] uppercase tracking-wider font-extrabold">
                <th className="py-3.5 px-4">Officer Name</th>
                <th className="py-3.5 px-3">Officer ID</th>
                <th className="py-3.5 px-3">Category</th>
                <th className="py-3.5 px-3">Rank / Designation</th>
                <th className="py-3.5 px-3">Police Station / Unit</th>
                <th className="py-3.5 px-3">Email</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="max-w-sm mx-auto space-y-3">
                      <Users className="w-10 h-10 text-slate-300 mx-auto" />
                      <div className="font-bold text-slate-800 text-base">No officers added yet.</div>
                      <p className="text-xs text-slate-500">
                        {searchQuery || roleFilter !== 'ALL' || rankFilter !== 'ALL'
                          ? 'No authorized officers match your current search or filter criteria.'
                          : 'Enroll registered officers to manage law enforcement credentials and access roles.'}
                      </p>
                      <button
                        onClick={() => {
                          resetFormAndOcr();
                          setIsAddModalOpen(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0052cc] hover:bg-[#0043a8] text-white font-bold text-xs shadow-xs transition cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-amber-300" />
                        <span>+ Add Officer</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((usr) => {
                  const roleKey = (usr.role || 'police_officer').toLowerCase();
                  const catInfo = CATEGORY_BADGES[roleKey] || CATEGORY_BADGES.police_officer;
                  const officerIdStr = usr.officerId || usr.officer_id || usr.badgeNumber || 'POL-WB-XXXX';

                  return (
                    <tr key={usr.id} className="hover:bg-blue-50/30 transition">
                      {/* Officer Name */}
                      <td className="py-3 px-4">
                        <div 
                          className="flex items-center gap-2.5 cursor-pointer group"
                          onClick={() => setProfileViewTarget(usr)}
                        >
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0B2D4D] to-[#164A73] text-white flex items-center justify-center text-sm font-bold shadow-2xs border border-slate-200 shrink-0 overflow-hidden">
                            {usr.avatar && (usr.avatar.startsWith('data:image') || usr.avatar.startsWith('http') || usr.avatar.startsWith('blob:')) ? (
                              <img src={usr.avatar} alt={usr.name} className="w-full h-full object-cover" />
                            ) : (
                              <span>{usr.avatar || catInfo.icon}</span>
                            )}
                          </div>
                          <div className="min-w-0 max-w-[140px] xl:max-w-[190px]">
                            <div className="font-extrabold text-slate-900 group-hover:text-[#0052cc] transition truncate" title={usr.name}>
                              {usr.name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Officer ID */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-800 text-xs whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {officerIdStr}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-extrabold border ${catInfo.color}`}>
                          <span>{catInfo.icon}</span>
                          <span>{catInfo.label}</span>
                        </span>
                      </td>

                      {/* Rank / Designation */}
                      <td className="py-3 px-3 font-bold text-slate-900 text-xs whitespace-nowrap">
                        {usr.rank || usr.badge || 'Constable'}
                      </td>

                      {/* Police Station / Unit */}
                      <td className="py-3 px-3 text-xs text-slate-700 max-w-[150px] xl:max-w-[210px]">
                        <div className="font-semibold text-slate-900 truncate" title={usr.policeStation || usr.police_station || 'Siliguri Police Station'}>
                          {usr.policeStation || usr.police_station || 'Siliguri Police Station'}
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3 px-3 font-mono text-xs text-slate-700 max-w-[150px] xl:max-w-[210px]">
                        <div className="truncate" title={usr.email}>
                          {usr.email}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {usr.status === 'Active' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Disabled
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setProfileViewTarget(usr)}
                            title="View Officer Profile"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-[#0052cc] hover:bg-blue-50 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(usr)}
                            title="Edit Officer Info"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-[#0052cc] hover:bg-blue-50 transition cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setStatusConfirmTarget(usr)}
                            title={usr.status === 'Active' ? 'Disable Officer' : 'Enable Officer'}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                              usr.status === 'Active'
                                ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {usr.status === 'Active' ? (
                              <>
                                <Ban className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Disable</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Enable</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => setDeleteConfirmTarget(usr)}
                            title="Permanently Delete Officer"
                            className="p-1.5 rounded-lg text-red-600 hover:text-red-800 hover:bg-red-100 transition cursor-pointer border border-transparent hover:border-red-200"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 2. MOBILE CARD VIEW (Visible on mobile screens < md breakpoint) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredUsers.length === 0 ? (
            <div className="py-8 px-4 text-center text-slate-400 space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="font-bold text-slate-800 text-sm">No officers added yet.</div>
            </div>
          ) : (
            filteredUsers.map((usr) => {
              const roleKey = (usr.role || 'police_officer').toLowerCase();
              const catInfo = CATEGORY_BADGES[roleKey] || CATEGORY_BADGES.police_officer;
              const officerIdStr = usr.officerId || usr.officer_id || usr.badgeNumber || 'POL-WB-XXXX';

              return (
                <div key={usr.id} className="p-3.5 space-y-2.5 bg-white hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0B2D4D] to-[#164A73] text-white flex items-center justify-center text-sm font-bold shadow-2xs border border-slate-200 shrink-0 overflow-hidden">
                        {usr.avatar && (usr.avatar.startsWith('data:image') || usr.avatar.startsWith('http') || usr.avatar.startsWith('blob:')) ? (
                          <img src={usr.avatar} alt={usr.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{usr.avatar || catInfo.icon}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-900 text-sm truncate">{usr.name}</div>
                        <div className="font-mono text-[11px] font-bold text-slate-500">{officerIdStr}</div>
                      </div>
                    </div>

                    {/* Status Pill */}
                    {usr.status === 'Active' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Disabled
                      </span>
                    )}
                  </div>

                  {/* Category & Rank Info */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${catInfo.color}`}>
                      <span>{catInfo.icon}</span>
                      <span>{catInfo.label}</span>
                    </span>
                    <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                      {usr.rank || usr.badge || 'Constable'}
                    </span>
                  </div>

                  {/* Station & Email */}
                  <div className="text-[11px] text-slate-600 space-y-0.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div className="truncate"><span className="font-bold text-slate-700">Station:</span> {usr.policeStation || usr.police_station || 'Siliguri Police Station'}</div>
                    <div className="font-mono truncate"><span className="font-bold text-slate-700">Email:</span> {usr.email}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setProfileViewTarget(usr)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center gap-1 text-[11px]"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                      <button
                        onClick={() => handleOpenEdit(usr)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center gap-1 text-[11px]"
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setStatusConfirmTarget(usr)}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 ${
                          usr.status === 'Active'
                            ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        {usr.status === 'Active' ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        {usr.status === 'Active' ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirmTarget(usr)}
                        className="p-1 rounded text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD OFFICER (WITH CATEGORY & DYNAMIC RANK HIERARCHY)            */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0B2D4D] to-slate-900 text-white flex items-center justify-between border-b-2 border-amber-400">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 text-amber-400 flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold">Add Authorized Officer</h2>
                  <p className="text-[11px] text-slate-300">
                    Select Category & Rank/Designation to enforce role hierarchy.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Banner */}
            {formError && (
              <div className="m-4 mb-0 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Mode Switcher Tabs */}
            <div className="bg-slate-100 p-2 border-b border-slate-200 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalTab('scan')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  modalTab === 'scan'
                    ? 'bg-white text-[#0052cc] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Scan className="w-4 h-4 text-[#0052cc]" />
                <span>📷 Upload ID Card (OCR Scan Assist)</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('manual')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  modalTab === 'manual'
                    ? 'bg-white text-[#0052cc] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-[#0052cc]" />
                <span>✍️ Direct Manual Entry</span>
              </button>
            </div>

            <form onSubmit={handleProceedToConfirmation} className="p-5 sm:p-6 space-y-5 max-h-[72vh] overflow-y-auto">

              {/* ---------------- 1. OCR UPLOAD & SCAN SECTION ---------------- */}
              {modalTab === 'scan' && (
                <div className="space-y-3 p-4 rounded-xl bg-blue-50/60 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-[#0B2D4D] flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-[#0052cc]" />
                      <span>Official Identity Card OCR Scanner</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold border border-blue-200">
                      Assistive Feature
                    </span>
                  </div>

                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-blue-300 hover:border-[#0052cc] rounded-xl p-4 text-center bg-white cursor-pointer transition group"
                  >
                    {/* File Upload Input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files && e.target.files[0];
                        if (file) handleOcrFile(file);
                      }}
                    />
                    
                    {idImagePreview ? (
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <img 
                          src={idImagePreview} 
                          alt="ID Preview" 
                          className="h-24 object-contain rounded-lg border border-slate-200 shadow-xs bg-slate-50"
                        />
                        <div className="text-left text-xs">
                          <div className="font-bold text-emerald-800 flex items-center gap-1">
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>ID Card Loaded & Scanned</span>
                          </div>
                          <p className="text-slate-500 text-[11px] mt-0.5">
                            Review detected text below. Admin MUST select Category & Rank to confirm enrollment.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-6 h-6 mx-auto text-[#0052cc] group-hover:scale-110 transition-transform" />
                        <div className="text-xs font-bold text-slate-800">
                          Click to upload official Police / Judicial ID Card
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Supports PNG, JPG, JPEG, WEBP.
                        </p>
                      </div>
                    )}
                  </div>

                  {ocrStatus === 'reading' && (
                    <div className="p-3 bg-white rounded-xl border border-blue-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-[#0B2D4D]">
                        <span className="flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0052cc]" />
                          <span>Scanning badge & detecting text...</span>
                        </span>
                        <span className="font-mono">{ocrProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-[#0052cc] h-2 transition-all duration-200 rounded-full"
                          style={{ width: `${ocrProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {ocrStatus === 'error' && ocrError && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2 text-xs text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{ocrError}</span>
                    </div>
                  )}

                  {ocrStatus === 'success' && (
                    <div className="p-3.5 bg-white rounded-xl border border-blue-200 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="text-xs font-extrabold text-[#0B2D4D] flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>Detected Information (OCR Assistance)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] font-bold text-slate-600 hover:text-[#0052cc] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 cursor-pointer"
                        >
                          Scan Again
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div><span className="font-bold text-slate-500">Officer Name:</span> <span className="font-semibold text-slate-900">{ocrDetectedInfo.name || 'Not detected'}</span></div>
                        <div><span className="font-bold text-slate-500">Officer ID:</span> <span className="font-semibold text-slate-900 font-mono">{ocrDetectedInfo.officerId || 'Not detected'}</span></div>
                        <div><span className="font-bold text-slate-500">Detected Rank:</span> <span className="font-semibold text-slate-900">{ocrDetectedInfo.rank || 'Not detected'}</span></div>
                        <div><span className="font-bold text-slate-500">Police Station:</span> <span className="font-semibold text-slate-900">{ocrDetectedInfo.policeStation || 'Not detected'}</span></div>
                      </div>
                    </div>
                  )}

                  <div className="pt-1.5 border-t border-blue-100 flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-[11px] font-bold text-slate-500">Sample Test Badges:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleUseSampleBadge('si_rahul')}
                        className="px-2 py-0.5 rounded bg-white hover:bg-blue-100 text-blue-900 text-[10px] font-bold border border-blue-300 cursor-pointer"
                      >
                        Sub-Inspector
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUseSampleBadge('legal_tanushree')}
                        className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-300 cursor-pointer"
                      >
                        Legal Officer (Tanushree)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUseSampleBadge('dgp_vikram')}
                        className="px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-900 text-[10px] font-bold border border-purple-300 cursor-pointer"
                      >
                        DGP
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------- 2. CATEGORY & DYNAMIC RANK SELECTION ---------------- */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#0052cc]" />
                  <span>Category & Rank Hierarchy Assignment</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  {/* Category Selection Dropdown (PROMPT REQUIREMENT: Admin selects Category first) */}
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-[#0052cc] uppercase tracking-wider text-[11px] mb-1">
                      Category *
                    </label>
                    <select
                      value={newUserData.role}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#0052cc] text-xs font-extrabold bg-white focus:ring-2 focus:ring-[#0052cc] text-slate-900"
                    >
                      <option value="police_officer">Officer (Constable, Head Constable, ASI, SI)</option>
                      <option value="senior_officer">Senior Officer (Inspector, ACP/DSP, SP/SSP, DIG, IG, ADGP, DGP)</option>
                      <option value="legal_officer">Legal Officer (Legal Officer, Public Prosecutor, Legal Advisor, Law Officer)</option>
                      <option value="administrator">Administrator (System Admin, Administrative Officer, Dept Admin, IT Manager)</option>
                    </select>
                  </div>

                  {/* Rank / Designation Dropdown (PROMPT REQUIREMENT: Options dynamically depend on Category) */}
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                      Rank / Designation *
                    </label>
                    <select
                      value={newUserData.rank}
                      onChange={(e) => setNewUserData({ ...newUserData, rank: e.target.value, badge: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-extrabold bg-white focus:ring-2 focus:ring-[#0052cc] text-slate-900"
                    >
                      {(CATEGORY_RANKS[newUserData.role] || []).map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Rank options are dynamically filtered based on selected Category.
                    </p>
                  </div>

                  {/* Officer Name */}
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                      Officer Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUserData.name}
                      onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                      placeholder="e.g. Inspector Vikram Sharma"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-[#0052cc]"
                    />
                  </div>

                  {/* Officer ID / Badge ID */}
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                      Officer ID / Badge ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUserData.officerId}
                      onChange={(e) => setNewUserData({ ...newUserData, officerId: e.target.value })}
                      placeholder="e.g. WB-POL-8842"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-[#0052cc]"
                    />
                  </div>

                  {/* Police Station */}
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                      Police Station / Unit
                    </label>
                    <select
                      value={newUserData.policeStation}
                      onChange={(e) => setNewUserData({ ...newUserData, policeStation: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:ring-2 focus:ring-[#0052cc]"
                    >
                      {POLICE_STATIONS.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                      {!POLICE_STATIONS.includes(newUserData.policeStation) && newUserData.policeStation && (
                        <option value={newUserData.policeStation}>{newUserData.policeStation}</option>
                      )}
                    </select>
                  </div>

                  {/* Official Email */}
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                      Official Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={newUserData.email}
                      onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                      placeholder="e.g. officer@police.gov.in"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-medium focus:ring-2 focus:ring-[#0052cc]"
                    />
                  </div>

                  {/* Phone */}
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={newUserData.phone}
                      onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                      placeholder="+91 98301 24567"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-medium focus:ring-2 focus:ring-[#0052cc]"
                    />
                  </div>

                  {/* Initial Password */}
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                      Initial Password *
                    </label>
                    <p className="text-[11px] text-slate-500 font-medium mb-1.5">
                      Create a secure password
                    </p>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={newUserData.password}
                        onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                        placeholder="e.g. Officer@123"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-medium pr-9 focus:ring-2 focus:ring-[#0052cc]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Password requirements live checklist */}
                    {(() => {
                      const pass = newUserData.password || '';
                      const reqs = [
                        { label: '8+ characters', met: pass.length >= 8 },
                        { label: 'Uppercase letter', met: /[A-Z]/.test(pass) },
                        { label: 'Lowercase letter', met: /[a-z]/.test(pass) },
                        { label: 'Number', met: /[0-9]/.test(pass) },
                        { label: 'Special character', met: /[^A-Za-z0-9]/.test(pass) }
                      ];

                      return (
                        <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                          <div className="font-bold text-slate-700 text-[11px]">Password requirements:</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] font-medium">
                            {reqs.map((r, idx) => (
                              <div key={idx} className={`flex items-center gap-1.5 ${r.met ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                                <span className={r.met ? 'text-emerald-600 font-bold' : 'text-slate-400'}>{r.met ? '✓' : '○'}</span>
                                <span>{r.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={resetFormAndOcr}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                >
                  Reset Form
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#0052cc] hover:bg-[#0043a8] text-white text-xs font-bold shadow-md transition cursor-pointer active:scale-95 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-amber-300" />
                    <span>Confirm Officer Details</span>
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIRMATION SUMMARY DIALOG BEFORE ENROLLMENT                    */}
      {/* ========================================================================= */}
      {isConfirmAddModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsConfirmAddModalOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-[#0B2D4D] text-white flex items-center justify-between border-b-2 border-amber-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold">Confirm Officer Enrollment</h3>
              </div>
              <button 
                onClick={() => setIsConfirmAddModalOpen(false)}
                className="text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-left">
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-slate-800 space-y-2">
                <div className="font-extrabold text-[#0B2D4D] text-sm flex items-center gap-1.5">
                  <span>Create this officer account?</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Please review the Category & Rank hierarchy details before committing this officer record.
                </p>

                <div className="pt-2 border-t border-blue-200 space-y-1 font-mono text-[11px]">
                  <div><span className="font-bold text-slate-500">Name:</span> <span className="font-extrabold text-slate-900">{newUserData.name}</span></div>
                  <div><span className="font-bold text-slate-500">Officer ID:</span> <span className="font-extrabold text-slate-900">{newUserData.officerId}</span></div>
                  <div><span className="font-bold text-slate-500">Category:</span> <span className="font-extrabold text-[#0052cc]">{CATEGORY_BADGES[newUserData.role]?.label || newUserData.role}</span></div>
                  <div><span className="font-bold text-slate-500">Rank / Designation:</span> <span className="font-extrabold text-slate-900">{newUserData.rank}</span></div>
                  <div><span className="font-bold text-slate-500">Police Station:</span> <span className="font-semibold text-slate-800">{newUserData.policeStation}</span></div>
                  <div><span className="font-bold text-slate-500">Email:</span> <span className="font-semibold text-slate-800">{newUserData.email}</span></div>
                  <div><span className="font-bold text-slate-500">Initial Status:</span> <span className="font-extrabold text-emerald-700">Active</span></div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsConfirmAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFinalCreateOfficer}
                  className="px-5 py-2 rounded-xl bg-[#0052cc] hover:bg-[#0043a8] text-white text-xs font-bold shadow-md transition cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-amber-300" />
                  <span>Create Officer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ENABLE / DISABLE ACCOUNT CONFIRMATION DIALOG                     */}
      {/* ========================================================================= */}
      {statusConfirmTarget && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setStatusConfirmTarget(null)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`p-4 text-white flex items-center justify-between border-b-2 ${
              statusConfirmTarget.status === 'Active' ? 'bg-red-950 border-red-500' : 'bg-emerald-950 border-emerald-500'
            }`}>
              <div className="flex items-center gap-2">
                {statusConfirmTarget.status === 'Active' ? (
                  <Ban className="w-5 h-5 text-red-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                )}
                <h3 className="text-sm font-bold">
                  {statusConfirmTarget.status === 'Active' ? 'Disable Officer Account' : 'Enable Officer Account'}
                </h3>
              </div>
              <button 
                onClick={() => setStatusConfirmTarget(null)}
                className="text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-left">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 space-y-2">
                <div className="font-bold text-slate-900 text-sm">
                  {statusConfirmTarget.status === 'Active'
                    ? `Are you sure you want to disable account for ${statusConfirmTarget.name} (${statusConfirmTarget.officerId || statusConfirmTarget.officer_id})?`
                    : `Are you sure you want to activate account for ${statusConfirmTarget.name} (${statusConfirmTarget.officerId || statusConfirmTarget.officer_id})?`}
                </div>
                <p className="text-slate-600 text-[11px]">
                  {statusConfirmTarget.status === 'Active'
                    ? 'Disabled officers will be immediately prevented from logging into CASEVAULT.'
                    : 'Activating this account will allow the officer to resume logging in.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setStatusConfirmTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmToggleStatus}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-md transition cursor-pointer active:scale-95 ${
                    statusConfirmTarget.status === 'Active'
                      ? 'bg-red-700 hover:bg-red-800'
                      : 'bg-emerald-700 hover:bg-emerald-800'
                  }`}
                >
                  {statusConfirmTarget.status === 'Active' ? 'Disable Account' : 'Enable Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: VIEW OFFICER PROFILE MODAL                                       */}
      {/* ========================================================================= */}
      {profileViewTarget && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setProfileViewTarget(null)}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-[#0B2D4D] text-white flex items-center justify-between border-b-2 border-amber-400">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 text-2xl flex items-center justify-center">
                  {profileViewTarget.avatar && (profileViewTarget.avatar.startsWith('data:image') || profileViewTarget.avatar.startsWith('http')) ? (
                    <img src={profileViewTarget.avatar} alt="Profile" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <span>{profileViewTarget.avatar || '👮'}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-base font-extrabold">{profileViewTarget.name}</h3>
                  <div className="text-xs font-mono text-amber-300">{profileViewTarget.officerId || profileViewTarget.officer_id || 'POL-WB-XXXX'}</div>
                </div>
              </div>
              <button 
                onClick={() => setProfileViewTarget(null)}
                className="text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Officer Name</div>
                  <div className="font-extrabold text-slate-900 text-sm mt-0.5">{profileViewTarget.name}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Officer / Badge ID</div>
                  <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">{profileViewTarget.officerId || profileViewTarget.officer_id}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Category</div>
                  <div className="font-extrabold text-[#0052cc] mt-0.5">
                    {CATEGORY_BADGES[profileViewTarget.role]?.label || profileViewTarget.roleLabel || profileViewTarget.role}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Rank / Designation</div>
                  <div className="font-extrabold text-slate-900 mt-0.5">{profileViewTarget.rank || profileViewTarget.badge}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Police Station / Unit</div>
                  <div className="font-bold text-slate-800 mt-0.5">{profileViewTarget.policeStation || profileViewTarget.police_station}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Official Email</div>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">{profileViewTarget.email}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Account Status</div>
                  <div className="mt-1">
                    {profileViewTarget.status === 'Active' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Active
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                        Disabled
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Created Date</div>
                  <div className="font-mono text-slate-700 mt-0.5">{profileViewTarget.createdDate || 'Official Registration'}</div>
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setProfileViewTarget(null)}
                  className="px-4 py-2 rounded-xl bg-[#0B2D4D] text-white text-xs font-bold hover:bg-slate-900 transition cursor-pointer"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: EDIT OFFICER MODAL                                               */}
      {/* ========================================================================= */}
      {editTarget && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setEditTarget(null)}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-[#0B2D4D] text-white flex items-center justify-between border-b-2 border-amber-400">
              <div className="flex items-center gap-2.5">
                <Edit className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold">Edit Officer Information</h3>
              </div>
              <button 
                onClick={() => setEditTarget(null)}
                className="text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                    Officer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold focus:ring-2 focus:ring-[#0052cc]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                    Officer ID / Badge ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.officerId}
                    onChange={(e) => setEditFormData({ ...editFormData, officerId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-[#0052cc]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                    Category *
                  </label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => handleEditCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#0052cc]"
                  >
                    <option value="police_officer">Officer</option>
                    <option value="senior_officer">Senior Officer</option>
                    <option value="legal_officer">Legal Officer</option>
                    <option value="administrator">Administrator</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                    Rank / Designation *
                  </label>
                  <select
                    value={editFormData.rank}
                    onChange={(e) => setEditFormData({ ...editFormData, rank: e.target.value, badge: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#0052cc]"
                  >
                    {(CATEGORY_RANKS[editFormData.role] || []).map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                    Police Station / Unit
                  </label>
                  <select
                    value={editFormData.policeStation}
                    onChange={(e) => setEditFormData({ ...editFormData, policeStation: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium bg-white focus:ring-2 focus:ring-[#0052cc]"
                  >
                    {POLICE_STATIONS.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                    Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-medium focus:ring-2 focus:ring-[#0052cc]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0052cc] hover:bg-[#0043a8] text-white text-xs font-bold shadow-md transition cursor-pointer"
                >
                  Save Officer Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: DELETE OFFICER CONFIRMATION MODAL                                */}
      {/* ========================================================================= */}
      {deleteConfirmTarget && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setDeleteConfirmTarget(null)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-red-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-gradient-to-r from-red-700 to-red-900 text-white flex items-center justify-between border-b-2 border-red-500">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center font-bold">
                  <Trash2 className="w-5 h-5 text-red-200" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Delete Officer Account</h2>
                  <p className="text-[11px] text-red-100">Permanent Removal Action</p>
                </div>
              </div>
              <button 
                onClick={() => setDeleteConfirmTarget(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-900 font-semibold leading-relaxed">
                    Are you sure you want to permanently delete <strong className="font-extrabold text-red-950">{deleteConfirmTarget.name}</strong>?
                  </p>
                </div>

                <div className="bg-white p-3 rounded-lg border border-red-200 space-y-1 text-xs text-slate-700">
                  <div><strong className="text-slate-900">Officer ID:</strong> <span className="font-mono text-slate-800">{deleteConfirmTarget.officerId || deleteConfirmTarget.officer_id || deleteConfirmTarget.id}</span></div>
                  <div><strong className="text-slate-900">Rank / Role:</strong> {deleteConfirmTarget.rank || deleteConfirmTarget.badge || deleteConfirmTarget.roleLabel}</div>
                  <div><strong className="text-slate-900">Station:</strong> {deleteConfirmTarget.policeStation || deleteConfirmTarget.police_station}</div>
                  <div><strong className="text-slate-900">Email:</strong> <span className="font-mono text-slate-800">{deleteConfirmTarget.email}</span></div>
                </div>

                <p className="text-[11px] text-red-700 font-medium italic">
                  ⚠️ <strong>Warning:</strong> This officer will be completely removed from everywhere in CASEVAULT. The officer will no longer be able to log in or access any documents. This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTarget(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteUser}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Officer Permanently</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
