import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_CASES, INITIAL_DOCUMENTS, INITIAL_AUDIT_LOGS, INITIAL_USERS } from '../../database/seeds/mockData';
import { computeSHA256, generateDocId, generateCaseId, formatDateTime } from '../utils/cryptoUtils';

const normalizeUser = (u) => {
  if (!u || typeof u !== 'object') return u;

  const officerId = (
    u.officerId ||
    u.officer_id ||
    u.badgeNumber ||
    u.badge_number ||
    u.badgeId ||
    u.badge ||
    ''
  ).toString().trim();

  const email = (u.email || '').toString().toLowerCase().trim();
  const policeStation = (u.policeStation || u.police_station || 'Siliguri Police Station').toString().trim();
  const roleLabel = u.roleLabel || u.role_label || (u.role ? u.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Police Officer');
  const rank = u.rank || u.badge || 'Police Officer';
  const name = u.name || u.full_name || 'Officer';

  return {
    ...u,
    id: u.id !== undefined && u.id !== null ? u.id : undefined,
    officerId: officerId || u.officerId || undefined,
    officer_id: officerId || u.officer_id || undefined,
    badgeNumber: officerId || u.badgeNumber || undefined,
    badge_number: officerId || u.badge_number || undefined,
    email,
    name,
    rank,
    policeStation,
    police_station: policeStation,
    roleLabel,
    role_label: roleLabel,
    status: u.status || 'Active'
  };
};

const isSameUser = (u1, u2) => {
  if (!u1 || !u2) return false;

  if (u1.id !== undefined && u1.id !== null && u2.id !== undefined && u2.id !== null) {
    if (String(u1.id).trim() === String(u2.id).trim()) {
      return true;
    }
  }

  const id1 = (u1.officerId || u1.officer_id || u1.badgeNumber || u1.badge_number || u1.badgeId || u1.badge || '').toString().trim().toLowerCase();
  const id2 = (u2.officerId || u2.officer_id || u2.badgeNumber || u2.badge_number || u2.badgeId || u2.badge || '').toString().trim().toLowerCase();
  if (id1 && id2 && id1 === id2) {
    return true;
  }

  const email1 = (u1.email || '').toString().trim().toLowerCase();
  const email2 = (u2.email || '').toString().trim().toLowerCase();
  if (email1 && email2 && email1 === email2) {
    return true;
  }

  return false;
};

const deduplicateUsers = (userList) => {
  if (!Array.isArray(userList)) return [];
  const result = [];

  userList.forEach(rawUser => {
    if (!rawUser) return;
    const norm = normalizeUser(rawUser);

    const existingIndex = result.findIndex(existing => isSameUser(existing, norm));
    if (existingIndex >= 0) {
      result[existingIndex] = normalizeUser({
        ...result[existingIndex],
        ...norm,
        password: norm.password || result[existingIndex].password,
        id: norm.id !== undefined ? norm.id : result[existingIndex].id
      });
    } else {
      result.push(norm);
    }
  });

  return result;
};

const syncAuthenticatedUserInList = (usersList, authenticatedUser) => {
  if (!authenticatedUser) return usersList;
  const normAuth = normalizeUser(authenticatedUser);
  const list = Array.isArray(usersList) ? usersList : [];

  const existingIndex = list.findIndex(u => isSameUser(u, normAuth));
  if (existingIndex >= 0) {
    const updated = [...list];
    updated[existingIndex] = normalizeUser({
      ...updated[existingIndex],
      ...normAuth,
      password: normAuth.password || updated[existingIndex].password
    });
    return deduplicateUsers(updated);
  } else {
    return deduplicateUsers([normAuth, ...list]);
  }
};

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // Authentication & Session
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('casevault_user');
    return saved ? normalizeUser(JSON.parse(saved)) : null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('casevault_user');
  });

  // Core Data Stores
  const [cases, setCases] = useState(() => {
    const saved = localStorage.getItem('casevault_cases');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });


  const [documents, setDocuments] = useState(() => {
    const saved = localStorage.getItem('casevault_documents');
    if (!saved) return INITIAL_DOCUMENTS;
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_DOCUMENTS;
    } catch {
      return INITIAL_DOCUMENTS;
    }
  });

  const [auditLogs, setAuditLogs] = useState([]);

  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('casevault_users_list');
    if (!saved) return deduplicateUsers(INITIAL_USERS);
    try {
      const parsed = JSON.parse(saved);
      return deduplicateUsers(parsed);
    } catch {
      return [];
    }
  });

  // Active Navigation & View
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeSettingsTab, setActiveSettingsTab] = useState('profile');
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);

  // Mobile Navigation Drawer & Notifications
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const openNewCaseModal = () => setIsNewCaseModalOpen(true);
  const closeNewCaseModal = () => setIsNewCaseModalOpen(false);

  const openMobileMenu = () => setIsMobileMenuOpen(true);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const toggleMobileMenu = () => setIsMobileMenuOpen(prev => !prev);

  const openNotifications = () => setIsNotificationsOpen(true);
  const closeNotifications = () => setIsNotificationsOpen(false);
  const toggleNotifications = () => setIsNotificationsOpen(prev => !prev);

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Tampered Documents tracking (for live demo integrity failure testing)
  const [tamperedDocs, setTamperedDocs] = useState({});

  // Toast notifications
  const [toast, setToast] = useState(null);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('casevault_cases', JSON.stringify(cases));
  }, [cases]);

  useEffect(() => {
    localStorage.setItem('casevault_documents', JSON.stringify(documents));
  }, [documents]);



  useEffect(() => {
    const cleanUsers = deduplicateUsers(users);
    localStorage.setItem('casevault_users_list', JSON.stringify(cleanUsers));
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('casevault_user', JSON.stringify(currentUser));
    }
  }, [currentUser]);

  // Show Toast notification
  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Log an activity into the Audit Trail
  const logActivity = ({ action, actionBadge = 'view', documentId = '', documentName = '', caseId = '', details = '' }) => {
    const newLog = {
      id: `LOG-${Date.now().toString().slice(-4)}`,
      timestamp: formatDateTime(new Date()),
      user: currentUser ? currentUser.name : 'Authorized Officer',
      role: currentUser ? currentUser.roleLabel : 'Police Officer',
      action,
      actionBadge,
      documentId,
      documentName,
      caseId,
      details,
      ip: currentUser?.policeStation ? `${currentUser.policeStation} (Secure Gateway)` : 'Siliguri PS Intranet'
    };

    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Login handler
  const loginAs = (roleKey) => {
    const user = (roleKey && typeof roleKey === 'object') ? roleKey : (INITIAL_USERS.find(u => u.role === roleKey) || INITIAL_USERS[0]);
    if (!user) return;
    const normUser = normalizeUser(user);
    setCurrentUser(normUser);
    setIsAuthenticated(true);
    setCurrentPage('dashboard');
    showToast(`Logged in successfully as ${normUser.name} (${normUser.roleLabel || normUser.role})`, 'success');
  };

  const fetchCasesFromBackend = async () => {
    try {
      const user = currentUser || (localStorage.getItem('casevault_user') ? JSON.parse(localStorage.getItem('casevault_user')) : null);
      const headers = { 'Content-Type': 'application/json' };
      if (user && (user.officer_id || user.officerId)) {
        headers['X-Officer-ID'] = user.officer_id || user.officerId;
      }
      if (user && user.email) {
        headers['X-User-Email'] = user.email;
      }

      const response = await fetch('http://localhost:8000/api/cases/', { headers });
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.cases)) {
          const mappedCases = data.cases.map(c => ({
            ...c,
            id: c.case_id || c.id,
            firNumber: c.fir_number || c.case_id,
            title: c.title || 'Untitled Case',
            caseType: c.case_type || 'Investigation',
            policeStation: c.police_station || 'Siliguri Police Station',
            investigatingOfficer: c.investigating_officer || c.investigating_officer_id || 'Officer',
            createdDate: c.created_at ? c.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            lastUpdated: c.updated_at ? c.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
            status: c.status || 'OPEN',
            priority: c.priority || 'MEDIUM',
            description: c.description || '',
            documentCount: c.document_count || 0,
            tags: [c.case_type || 'Investigation', c.status || 'OPEN']
          }));
          setCases(mappedCases);
          return mappedCases;
        }
      }
    } catch (err) {
      console.warn('[CASEVAULT Cases] Could not fetch cases from Django backend:', err);
    }
    return [];
  };

  const fetchOfficersFromBackend = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/officers/');
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.officers)) {
          const normalized = data.officers.map(u => normalizeUser(u));
          setUsers(deduplicateUsers(normalized));
          return normalized;
        }
      }
    } catch (err) {
      console.warn('[CASEVAULT Officers] Could not fetch officers from Django backend:', err);
    }
    return [];
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchOfficersFromBackend();
      fetchCasesFromBackend();
    }
  }, [isAuthenticated]);


  const loginWithCredentials = async (username, password, selectedRole) => {
    const cleanUser = username ? username.trim().toLowerCase() : '';
    const cleanPass = password ? password.trim() : '';

    if (!cleanUser || !cleanPass) {
      const err = 'Please enter both username/email and password.';
      showToast(err, 'error');
      return { success: false, error: err };
    }

    // Direct DRF REST API Authentication
    try {
      const response = await fetch('http://localhost:8000/api/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanUser, password: cleanPass })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        const normUser = normalizeUser(data.user);

        // Enforce account status check
        if (normUser.status === 'Disabled') {
          const disabledMsg = 'This officer account is deactivated. Contact Administrator.';
          showToast(disabledMsg, 'error');
          return { success: false, error: disabledMsg };
        }

        setCurrentUser(normUser);
        setIsAuthenticated(true);
        localStorage.setItem('casevault_user', JSON.stringify(normUser));
        if (data.token) {
          localStorage.setItem('casevault_auth_token', data.token);
        }
        setCurrentPage('dashboard');

        // Fetch authoritative officer list from backend
        fetchOfficersFromBackend();

        showToast(data.message || `Welcome back, ${normUser.name}`, 'success');
        logActivity({
          action: 'Officer Login',
          actionBadge: 'AUTH',
          details: `Officer ${normUser.name} (${normUser.officerId || normUser.email}) authenticated via Django REST Framework.`
        });
        return { success: true, user: normUser };
      } else {
        // Django API returned an explicit authentication rejection
        let errMsg = 'Access Denied: Invalid credentials.';
        if (data.message) {
          errMsg = data.message;
        } else if (data.errors) {
          if (typeof data.errors === 'string') {
            errMsg = data.errors;
          } else if (typeof data.errors === 'object') {
            const firstKey = Object.keys(data.errors)[0];
            const val = data.errors[firstKey];
            errMsg = Array.isArray(val) ? val[0] : String(val);
          }
        }
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }
    } catch (err) {
      console.error('[CASEVAULT Auth] Backend API connection error:', err);
      const connErr = 'Unable to connect to CASEVAULT Authentication Server (Django backend). Please check server status.';
      showToast(connErr, 'error');
      return { success: false, error: connErr };
    }
  };

  const requestForgotPassword = async (email) => {
    try {
      const response = await fetch('http://localhost:8000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: (email || '').trim().toLowerCase() })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        showToast(data.message || 'OTP sent successfully.', 'success');
        return { success: true, message: data.message };
      } else {
        const errMsg = data.message || data.errors?.email?.[0] || 'Unable to send OTP. Please try again later.';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }
    } catch (err) {
      console.error('[CASEVAULT Forgot Password] Backend API Error:', err);
      const errMsg = "Unable to send OTP. Please try again later.";
      showToast(errMsg, 'error');
      return { success: false, error: errMsg };
    }
  };

  const requestVerifyOTP = async (email, otp) => {
    try {
      const response = await fetch('http://localhost:8000/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: (email || '').trim().toLowerCase(),
          otp: (otp || '').trim()
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        showToast(data.message || 'OTP verified successfully.', 'success');
        return { success: true, message: data.message };
      } else {
        const errMsg = data.message || 'Invalid OTP verification attempt.';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }
    } catch (err) {
      console.error('[CASEVAULT Verify OTP] Backend API Error:', err);
      const errMsg = "Network error verifying OTP. Please check server.";
      showToast(errMsg, 'error');
      return { success: false, error: errMsg };
    }
  };

  const requestResetPassword = async ({ email, otp, token, password, confirm_password }) => {
    try {
      const response = await fetch('http://localhost:8000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: (email || '').trim().toLowerCase(),
          otp: (otp || '').trim(),
          token: token || '',
          password,
          confirm_password
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        showToast(data.message || 'Password reset successful.', 'success');
        return { success: true, message: data.message };
      } else {
        const errMsg = data.message || data.error || data.errors?.confirm_password?.[0] || 'Password reset failed.';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }
    } catch (err) {
      console.error('[CASEVAULT Reset Password] API Error:', err);
      const errMsg = "Network error while connecting to reset password server.";
      showToast(errMsg, 'error');
      return { success: false, error: errMsg };
    }
  };

  const logout = () => {
    localStorage.removeItem('casevault_user');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setCurrentPage('dashboard');
    showToast('Logged out securely.', 'info');
  };

  // Register New Officer Account (Connected to Django REST API & Local Audit Log)
  const registerOfficer = async ({
    officerId,
    name,
    rank,
    department,
    policeStation,
    email,
    phone,
    role,
    roleLabel,
    permissions,
    passkeyDevice,
    idType,
    pinHash,
    password,
    avatar
  }) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = password || 'Officer@123';

    try {
      const response = await fetch('http://localhost:8000/api/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'Officer',
          email: cleanEmail,
          password: cleanPass,
          confirm_password: cleanPass,
          officer_id: officerId,
          rank: rank || 'Constable',
          police_station: policeStation || 'Siliguri Police Station',
          role: role || 'police_officer',
          avatar: avatar || '👮'
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const newUser = normalizeUser(data.user);
        fetchOfficersFromBackend();

        logActivity({
          action: 'Officer ID Verified',
          actionBadge: 'verify',
          details: `${idType || 'Police ID'} (${newUser.officerId}) verified for ${newUser.name} (${newUser.rank}).`
        });

        logActivity({
          action: 'Role Assigned',
          actionBadge: 'add',
          details: `Assigned role '${newUser.roleLabel || 'Police Officer'}' with permissions.`
        });

        showToast(`Officer account registered for ${newUser.name} (${newUser.roleLabel || 'Police Officer'})`, 'success');
        return { success: true, user: newUser };
      } else {
        let errMessage = 'Officer registration rejected by backend server.';
        if (data.message) {
          errMessage = data.message;
        } else if (data.errors) {
          if (typeof data.errors === 'string') {
            errMessage = data.errors;
          } else if (typeof data.errors === 'object') {
            const firstKey = Object.keys(data.errors)[0];
            const val = data.errors[firstKey];
            errMessage = Array.isArray(val) ? val[0] : String(val);
          }
        }
        showToast(errMessage, 'error');
        return { success: false, error: errMessage };
      }
    } catch (err) {
      console.error('[CASEVAULT Register] Django API error:', err);
      const connErr = 'Unable to connect to CASEVAULT Registration Server (Django backend).';
      showToast(connErr, 'error');
      return { success: false, error: connErr };
    }
  };

  // Update Officer Profile
  const updateProfile = (updatedFields) => {
    setCurrentUser(prev => {
      const updated = { ...(prev || {}), ...updatedFields };
      localStorage.setItem('casevault_user', JSON.stringify(updated));
      return updated;
    });

    setUsers(prev => {
      const exists = prev.some(u => (currentUser?.id && u.id === currentUser.id) || (currentUser?.officerId && u.officerId === currentUser.officerId));
      if (exists) {
        return prev.map(u => ((currentUser?.id && u.id === currentUser.id) || (currentUser?.officerId && u.officerId === currentUser.officerId)) ? { ...u, ...updatedFields } : u);
      }
      return prev;
    });

    logActivity({
      action: 'Profile Updated',
      actionBadge: 'edit',
      details: `Officer profile details updated for ${updatedFields.name || currentUser?.name}.`
    });

    showToast('Profile contact information updated successfully.', 'success');
  };

  // Update Officer Password (used after verified password reset - NEVER creates a new user)
  const updateOfficerPassword = (email, newPassword) => {
    const cleanEmail = (email || '').toLowerCase().trim();
    setUsers(prev => {
      const updated = prev.map(u => {
        const uEmail = (u.email || '').toLowerCase().trim();
        const uOfficerId = (u.officerId || '').toLowerCase().trim();
        const uUsername = (u.username || '').toLowerCase().trim();
        if (uEmail === cleanEmail || uOfficerId === cleanEmail || uUsername === cleanEmail) {
          return { ...u, password: newPassword };
        }
        return u;
      });

      return deduplicateUsers(updated);
    });
  };

  // Navigation Helper
  const navigate = (page, params = {}) => {
    if (page === 'profile') {
      setActiveSettingsTab('profile');
      setCurrentPage('settings');
    } else {
      if (params.tab) setActiveSettingsTab(params.tab);
      setCurrentPage(page);
    }
    if (params.caseId) setSelectedCaseId(params.caseId);
    if (params.docId) setSelectedDocId(params.docId);
    if (params.query !== undefined) setSearchQuery(params.query);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Add a new case via Django REST API + MongoDB
  const addCase = async (newCaseData) => {
    try {
      const user = currentUser || (localStorage.getItem('casevault_user') ? JSON.parse(localStorage.getItem('casevault_user')) : null);
      const headers = { 'Content-Type': 'application/json' };
      if (user && (user.officer_id || user.officerId)) {
        headers['X-Officer-ID'] = user.officer_id || user.officerId;
      }
      if (user && user.email) {
        headers['X-User-Email'] = user.email;
      }

      const payload = {
        title: newCaseData.title || 'Untitled Case',
        case_type: newCaseData.caseType || newCaseData.case_type || 'Investigation',
        description: newCaseData.description || 'Case opened for investigation.',
        police_station: newCaseData.policeStation || newCaseData.police_station || user?.policeStation || 'Siliguri Police Station',
        priority: (newCaseData.priority || 'MEDIUM').toUpperCase(),
        status: newCaseData.status || 'OPEN'
      };

      const response = await fetch('http://localhost:8000/api/cases/', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok && data.success && data.case) {
        const c = data.case;
        const fullCase = {
          ...c,
          id: c.case_id || c.id,
          firNumber: c.fir_number || c.case_id,
          title: c.title,
          caseType: c.case_type || 'Investigation',
          policeStation: c.police_station || 'Siliguri Police Station',
          investigatingOfficer: c.investigating_officer || c.investigating_officer_id || user?.name || 'Officer',
          createdDate: c.created_at ? c.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
          lastUpdated: c.updated_at ? c.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
          status: c.status || 'OPEN',
          priority: c.priority || 'MEDIUM',
          description: c.description || '',
          documentCount: 0,
          tags: [c.case_type || 'Investigation', c.status || 'OPEN']
        };

        setCases(prev => [fullCase, ...prev]);

        logActivity({
          action: 'Case Created',
          actionBadge: 'create',
          caseId: fullCase.id,
          details: `Created case ${fullCase.id} - ${fullCase.title} in MongoDB via Django REST API.`
        });

        showToast(`Case ${fullCase.id} created successfully!`, 'success');
        return fullCase;
      } else {
        const errMsg = data.message || 'Failed to create case on backend server.';
        showToast(errMsg, 'error');
        return null;
      }
    } catch (err) {
      console.error('[CASEVAULT Add Case] API Error:', err);
      showToast('Network error creating case on backend.', 'error');
      return null;
    }
  };

  // Update an existing case via Django REST API
  const updateCase = async (caseId, updatedFields) => {
    try {
      const user = currentUser || (localStorage.getItem('casevault_user') ? JSON.parse(localStorage.getItem('casevault_user')) : null);
      const headers = { 'Content-Type': 'application/json' };
      if (user && (user.officer_id || user.officerId)) {
        headers['X-Officer-ID'] = user.officer_id || user.officerId;
      }
      if (user && user.email) {
        headers['X-User-Email'] = user.email;
      }

      const response = await fetch(`http://localhost:8000/api/cases/${caseId}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updatedFields)
      });

      const data = await response.json();
      if (response.ok && data.success) {
        fetchCasesFromBackend();
        logActivity({
          action: 'Case Updated',
          actionBadge: 'edit',
          caseId,
          details: `Updated case ${caseId} via Django API.`
        });
        showToast(`Case ${caseId} updated successfully!`, 'success');
        return data.case;
      } else {
        showToast(data.message || `Failed to update case ${caseId}.`, 'error');
      }
    } catch (err) {
      console.error('[CASEVAULT Update Case] API Error:', err);
      showToast('Error updating case on backend.', 'error');
    }
  };


  // Add a new Document via Django REST API
  const addDocument = async (docData) => {
    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const content = docData.content || `CASEVAULT RECORD - ${docData.name}\nCase: ${docData.caseId}\nUploaded by: ${currentUser?.name}\nTimestamp: ${today} ${time}\nClassification: ${docData.classification || 'Internal'}\n\nDocument details verified and archived under digital chain of custody.`;

    try {
      const user = currentUser || (localStorage.getItem('casevault_user') ? JSON.parse(localStorage.getItem('casevault_user')) : null);
      const headers = {};
      if (user && (user.officer_id || user.officerId)) {
        headers['X-Officer-ID'] = user.officer_id || user.officerId;
      }
      if (user && user.email) {
        headers['X-User-Email'] = user.email;
      }

      const formData = new FormData();
      const filename = docData.name.endsWith('.pdf') ? docData.name : `${docData.name}.pdf`;
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append('file', blob, filename);
      formData.append('document_type', docData.docType || 'FIR');
      formData.append('document_name', filename);
      formData.append('classification', docData.classification || 'Confidential');
      formData.append('description', docData.description || `Uploaded document for case ${docData.caseId}`);

      const response = await fetch(`http://localhost:8000/api/cases/${docData.caseId}/documents/`, {
        method: 'POST',
        headers,
        body: formData
      });

      const data = await response.json();
      if (response.ok && data.success && data.document) {
        const d = data.document;
        const newDoc = {
          id: d.document_id || d.id,
          caseId: d.case_id,
          name: d.file_name || d.document_name,
          docType: d.document_type,
          docTypeLabel: d.document_type,
          version: 1,
          uploadedBy: d.uploaded_by_name || currentUser?.name || 'Officer',
          uploadedByRole: currentUser?.roleLabel || 'Police Officer',
          uploadDate: d.uploaded_at ? d.uploaded_at.split('T')[0] : today,
          uploadTime: time,
          classification: d.classification || 'Confidential',
          status: d.status || 'Verified',
          sha256: d.sha256,
          lastVerified: `${today} ${time}`,
          fileSize: `${Math.round((d.file_size || 500) / 1024)} KB`,
          pageCount: docData.pageCount || 2,
          description: d.description || '',
          content: content,
          previousVersions: []
        };

        setDocuments(prev => [newDoc, ...prev]);

        // Update document count in case
        setCases(prev => prev.map(c => {
          if (c.id === docData.caseId) {
            return { ...c, documentCount: (c.documentCount || 0) + 1, lastUpdated: today };
          }
          return c;
        }));

        logActivity({
          action: 'Uploaded',
          actionBadge: 'upload',
          documentId: newDoc.id,
          documentName: newDoc.name,
          caseId: docData.caseId,
          details: `Uploaded ${newDoc.docType}. Generated SHA-256 Checksum: ${newDoc.sha256.substring(0, 12)}...`
        });

        showToast(`Document ${newDoc.id} uploaded & SHA-256 verified!`, 'success');
        return newDoc;
      } else {
        if (response.status === 409) {
          showToast(data.message || 'Duplicate file upload attempt with identical SHA-256 hash.', 'error');
        } else {
          showToast(data.message || 'Failed to upload document to backend server.', 'error');
        }
      }
    } catch (err) {
      console.warn('[CASEVAULT Upload] Backend API connection warning:', err);
    }

    // Local fallback if backend unavailable
    const docId = generateDocId(documents.length);
    const computedHash = await computeSHA256(content);
    const newDoc = {
      id: docId,
      caseId: docData.caseId,
      name: docData.name.endsWith('.pdf') ? docData.name : `${docData.name}.pdf`,
      docType: docData.docType || 'FIR',
      docTypeLabel: docData.docType || 'First Information Report (FIR)',
      version: 1,
      uploadedBy: currentUser?.name || 'SI Shivam Kumar Singh',
      uploadedByRole: currentUser?.roleLabel || 'Police Officer',
      uploadDate: today,
      uploadTime: time,
      classification: docData.classification || 'Internal',
      status: 'Verified',
      sha256: computedHash,
      lastVerified: `${today} ${time}`,
      fileSize: docData.fileSize || '380 KB',
      pageCount: docData.pageCount || 2,
      description: docData.description || `Uploaded document for case ${docData.caseId}.`,
      content: content,
      previousVersions: []
    };

    setDocuments(prev => [newDoc, ...prev]);

    setCases(prev => prev.map(c => {
      if (c.id === docData.caseId) {
        return { ...c, documentCount: (c.documentCount || 0) + 1, lastUpdated: today };
      }
      return c;
    }));

    logActivity({
      action: 'Uploaded',
      actionBadge: 'upload',
      documentId: docId,
      documentName: newDoc.name,
      caseId: docData.caseId,
      details: `Uploaded ${newDoc.docType} (Version 1). Generated SHA-256 Checksum: ${computedHash.substring(0, 12)}...`
    });

    showToast(`Document ${docId} uploaded & SHA-256 verified!`, 'success');
    return newDoc;
  };

  // Verify Document Integrity (Recalculates SHA-256 on active content vs registered hash)
  const verifyDocumentIntegrity = async (docId) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return { verified: false, error: 'Document not found' };

    // Check if tampered
    const isTampered = !!tamperedDocs[docId];
    const currentContent = isTampered ? tamperedDocs[docId].tamperedContent : doc.content;
    const computedHash = await computeSHA256(currentContent);

    const matches = (computedHash.toLowerCase() === doc.sha256.toLowerCase());

    const timestamp = formatDateTime(new Date());

    if (matches) {
      logActivity({
        action: 'Verified',
        actionBadge: 'verify',
        documentId: doc.id,
        documentName: doc.name,
        caseId: doc.caseId,
        details: `Integrity check PASSED. SHA-256 hash matched stored blockchain record.`
      });
      showToast(`✓ Document integrity verified. No alterations detected.`, 'success');
    } else {
      logActivity({
        action: 'Tamper Detected',
        actionBadge: 'tamper',
        documentId: doc.id,
        documentName: doc.name,
        caseId: doc.caseId,
        details: `⚠️ INTEGRITY MISMATCH DETECTED! Computed: ${computedHash.slice(0, 8)}... Expected: ${doc.sha256.slice(0, 8)}...`
      });
      showToast(`⚠️ Integrity check FAILED! Document content has been tampered with.`, 'error');
    }

    return {
      verified: matches,
      computedHash,
      storedHash: doc.sha256,
      timestamp
    };
  };

  // Simulate Tampering for Hackathon Demonstration
  const toggleTamperDocument = (docId) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    if (tamperedDocs[docId]) {
      // Revert to original
      const updated = { ...tamperedDocs };
      delete updated[docId];
      setTamperedDocs(updated);
      showToast('Document restored to original verified state.', 'info');
    } else {
      // Tamper content
      const tamperedContent = doc.content + '\n\n[TAMPERED INJECTION]: Altered by unauthorized third party modifying paragraph 3.';
      setTamperedDocs(prev => ({
        ...prev,
        [docId]: {
          tamperedContent,
          tamperedAt: new Date().toISOString()
        }
      }));
      showToast('Demonstration: Document content altered to simulate tampering.', 'warning');
    }
  };

  // Toggle user status (Admin action with audit log)
  const toggleUserStatus = (userId) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const nextStatus = u.status === 'Active' ? 'Disabled' : 'Active';
        showToast(`Officer ${u.name} account status updated to ${nextStatus}.`, 'info');
        
        logActivity({
          action: nextStatus === 'Disabled' ? 'Account Disabled' : 'Account Enabled',
          actionBadge: nextStatus === 'Disabled' ? 'tamper' : 'verify',
          details: `Officer account ${u.name} (${u.officerId || u.id}) ${nextStatus === 'Disabled' ? 'disabled' : 'enabled'} by ${currentUser?.name || 'Administrator'}.`
        });

        return { ...u, status: nextStatus };
      }
      return u;
    }));
  };

  // Add new user (Admin action with Duplicate Protection & Audit Trail)
  const addUser = async (userData) => {
    return await registerOfficer({
      officerId: userData.officerId,
      name: userData.name,
      rank: userData.rank || userData.badge,
      policeStation: userData.policeStation,
      email: userData.email,
      phone: userData.phone,
      role: userData.role,
      roleLabel: userData.roleLabel,
      password: userData.password,
      avatar: userData.avatar,
      idType: 'Official ID Card'
    });
  };

  // Update existing user (Admin Action)
  const updateUser = (userId, updatedFields) => {
    const cleanEmail = (updatedFields.email || '').trim().toLowerCase();
    const cleanId = (updatedFields.officerId || '').trim().toLowerCase();

    // Check duplicate against other users
    const isDuplicate = users.some(u => u.id !== userId && (
      (cleanEmail && (u.email || '').trim().toLowerCase() === cleanEmail) ||
      (cleanId && (u.officerId || '').trim().toLowerCase() === cleanId)
    ));

    if (isDuplicate) {
      const err = "Duplicate Conflict: Another officer already uses this Officer ID or Email address.";
      showToast(err, 'error');
      return { success: false, error: err };
    }

    const roleLabels = {
      police_officer: 'Police Officer',
      senior_officer: 'Senior Officer',
      legal_officer: 'Legal Officer',
      administrator: 'Administrator'
    };

    let updatedUserObj = null;

    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        updatedUserObj = {
          ...u,
          ...updatedFields,
          email: cleanEmail || u.email,
          roleLabel: updatedFields.role ? (roleLabels[updatedFields.role] || u.roleLabel) : u.roleLabel,
          badge: updatedFields.rank || updatedFields.badge || u.badge
        };
        return updatedUserObj;
      }
      return u;
    }));

    if (updatedUserObj) {
      logActivity({
        action: 'Officer Edited',
        actionBadge: 'edit',
        details: `Officer details updated for ${updatedUserObj.name} (${updatedUserObj.officerId}) by ${currentUser?.name || 'Administrator'}.`
      });
      showToast(`Officer details for ${updatedUserObj.name} updated successfully!`, 'success');
    }

    return { success: true };
  };

  // Delete officer / remove user from everywhere (Admin action)
  const deleteUser = (userId) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
      showToast('Officer not found in system.', 'error');
      return { success: false, error: 'Officer not found' };
    }

    const officerName = targetUser.name || 'Officer';
    const officerBadge = targetUser.officerId || targetUser.badgeId || targetUser.id;

    // 1. Remove from state array
    setUsers(prev => prev.filter(u => u.id !== userId));

    // 2. Explicitly update LocalStorage
    try {
      const savedUsers = JSON.parse(localStorage.getItem('casevault_users_list') || '[]');
      const updatedSavedUsers = savedUsers.filter(u => u.id !== userId && (u.email || '').toLowerCase() !== (targetUser.email || '').toLowerCase());
      localStorage.setItem('casevault_users_list', JSON.stringify(updatedSavedUsers));
    } catch (e) {
      console.warn('LocalStorage update notice during deleteUser:', e);
    }

    // 3. Audit Log
    logActivity({
      action: 'Officer Deleted',
      actionBadge: 'tamper',
      details: `Officer account for ${officerName} (${officerBadge}) permanently deleted from system by ${currentUser?.name || 'Administrator'}.`
    });

    // 4. If the deleted user is currently logged in, log them out completely
    if (currentUser && (currentUser.id === userId || (currentUser.email && currentUser.email.toLowerCase() === (targetUser.email || '').toLowerCase()))) {
      setCurrentUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('casevault_user');
      setCurrentPage('login');
      showToast('Your officer account was deleted by the administrator.', 'warning');
    } else {
      showToast(`Officer ${officerName} (${officerBadge}) permanently deleted from system.`, 'success');
    }

    return { success: true };
  };

  // Reset to original demo data
  const resetDemoData = () => {
    localStorage.removeItem('casevault_cases');
    localStorage.removeItem('casevault_documents');
    localStorage.removeItem('casevault_audit_logs');
    localStorage.removeItem('casevault_users_list');
    setCases(INITIAL_CASES);
    setDocuments(INITIAL_DOCUMENTS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setUsers(INITIAL_USERS);
    setTamperedDocs({});
    showToast('Demo data restored to initial factory state.', 'success');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        cases,
        documents,
        auditLogs,
        users,
        currentPage,
        selectedCaseId,
        selectedDocId,
        searchQuery,
        tamperedDocs,
        toast,
        loginAs,
        loginWithCredentials,
        requestForgotPassword,
        requestVerifyOTP,
        requestResetPassword,
        logout,
        navigate,
        addCase,
        updateCase,
        addDocument,
        verifyDocumentIntegrity,
        toggleTamperDocument,
        toggleUserStatus,
        addUser,
        updateUser,
        deleteUser,
        registerOfficer,
        resetDemoData,
        showToast,
        logActivity,
        updateProfile,
        updateOfficerPassword,
        activeSettingsTab,
        setActiveSettingsTab,
        setCurrentPage,
        setSelectedCaseId,
        setSelectedDocId,
        setSearchQuery,
        isNewCaseModalOpen,
        openNewCaseModal,
        closeNewCaseModal,
        isMobileMenuOpen,
        openMobileMenu,
        closeMobileMenu,
        toggleMobileMenu,
        isNotificationsOpen,
        openNotifications,
        closeNotifications,
        toggleNotifications,
        notifications,
        markAllNotificationsRead
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
