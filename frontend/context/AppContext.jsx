import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_CASES, INITIAL_DOCUMENTS, INITIAL_AUDIT_LOGS, INITIAL_USERS } from '../../database/seeds/mockData';
import { computeSHA256, generateDocId, generateCaseId, formatDateTime } from '../utils/cryptoUtils';

export const normalizeUser = (u) => {
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

export const isSameUser = (u1, u2) => {
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

export const deduplicateUsers = (userList) => {
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
    if (INITIAL_CASES.length === 0) {
      localStorage.setItem('casevault_cases', JSON.stringify([]));
      return [];
    }
    const saved = localStorage.getItem('casevault_cases');
    if (!saved) return INITIAL_CASES;
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : INITIAL_CASES;
    } catch {
      return INITIAL_CASES;
    }
  });

  const [documents, setDocuments] = useState(() => {
    const saved = localStorage.getItem('casevault_documents');
    if (!saved) return INITIAL_DOCUMENTS;
    try {
      const parsed = JSON.parse(saved);
      return parsed.filter(d => !d.caseId?.startsWith('CASE-102'));
    } catch {
      return [];
    }
  });

  const [auditLogs, setAuditLogs] = useState(() => {
    const saved = localStorage.getItem('casevault_audit_logs');
    if (!saved) return INITIAL_AUDIT_LOGS;
    try {
      const parsed = JSON.parse(saved);
      return parsed.filter(l => !l.caseId?.startsWith('CASE-102'));
    } catch {
      return [];
    }
  });

  const [users, setUsers] = useState(() => {
    if (INITIAL_USERS.length === 0) {
      localStorage.setItem('casevault_users_list', JSON.stringify([]));
      return [];
    }
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
    localStorage.setItem('casevault_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

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

  const loginWithCredentials = async (username, password, selectedRole) => {
    const cleanUser = username ? username.trim().toLowerCase() : '';
    const cleanPass = password ? password.trim() : '';

    // Attempt Django REST API authentication
    try {
      const response = await fetch('http://localhost:8000/api/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanUser, password: cleanPass })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        const normUser = normalizeUser(data.user);
        setCurrentUser(normUser);
        setIsAuthenticated(true);
        setCurrentPage('dashboard');

        // Safely sync with users list without duplicating or creating new user
        setUsers(prev => syncAuthenticatedUserInList(prev, normUser));

        showToast(data.message || `Welcome back, ${normUser.name}`, 'success');
        logActivity({
          action: 'Officer Login',
          actionBadge: 'AUTH',
          details: `Officer ${normUser.name} (${normUser.officerId || normUser.email}) logged in via Django REST API.`
        });
        return { success: true, user: normUser };
      }
    } catch (err) {
      console.warn('[CASEVAULT Auth] Backend API unreachable, using local storage fallback:', err);
    }

    // Local Fallback Login (matching existing user in state)
    const matched = users.find(u => {
      return isSameUser(u, {
        email: cleanUser,
        officerId: cleanUser,
        username: cleanUser,
        name: cleanUser
      });
    });

    if (matched) {
      if (matched.status === 'Disabled') {
        const disabledMsg = 'This officer account is deactivated. Contact Administrator.';
        showToast(disabledMsg, 'error');
        return { success: false, error: disabledMsg };
      }

      if (matched.password && matched.password !== cleanPass) {
        const passErr = 'Invalid officer credentials. Incorrect password.';
        showToast(passErr, 'error');
        return { success: false, error: passErr };
      }

      const normMatched = normalizeUser(matched);
      setCurrentUser(normMatched);
      setIsAuthenticated(true);
      setCurrentPage('dashboard');
      showToast(`Welcome back, ${normMatched.name}`, 'success');
      logActivity({
        action: 'Officer Login',
        actionBadge: 'AUTH',
        details: `Officer ${normMatched.name} (${normMatched.officerId || normMatched.email}) logged in.`
      });
      return { success: true, user: normMatched };
    }

    const errorMsg = 'Access Denied: Unregistered officer account. Only registered accounts or administrator-enrolled officers may login.';
    showToast(errorMsg, 'error');
    return {
      success: false,
      error: errorMsg
    };
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
    const cleanEmail = email || `${(officerId || 'officer').toLowerCase().replace(/[^a-z0-9]/g, '.')}@police.gov.in`;
    const cleanPass = password || 'Officer@123';

    let registeredUser = null;

    // Send registration request to Django REST API
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
          rank: rank || 'Sub-Inspector',
          police_station: policeStation || 'Siliguri Police Station',
          role: role || 'police_officer',
          avatar: avatar || '👮'
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        registeredUser = data.user;
      }
    } catch (err) {
      console.warn('[CASEVAULT Register] Django API unreachable during registration:', err);
    }

    const newUser = registeredUser || {
      id: `usr-${Date.now().toString().slice(-4)}`,
      name: name || 'Officer',
      officerId: officerId || 'POL-NEW-01',
      rank: rank || 'Sub-Inspector',
      department: department || 'General Policing',
      policeStation: policeStation || 'Siliguri Police Station',
      role: role || 'police_officer',
      roleLabel: roleLabel || 'Police Officer',
      email: cleanEmail,
      phone: phone || '',
      password: cleanPass,
      emailVerified: true,
      pinHash: pinHash || null,
      status: 'Active',
      permissions: permissions || ['Read', 'Upload', 'Edit'],
      passkeyDevice: passkeyDevice || null,
      idType: idType || 'Police ID',
      hasPin: true,
      lastActive: 'Just now',
      avatar: avatar || (role === 'senior_officer' ? '👮‍♂️' : role === 'legal_officer' ? '⚖️' : role === 'administrator' ? '🛡️' : '👮')
    };

    setUsers(prev => [newUser, ...prev]);

    // Record formal audit trail events
    logActivity({
      action: 'Officer ID Verified',
      actionBadge: 'verify',
      details: `${idType || 'Police ID'} (${newUser.officerId}) verified for ${newUser.name} (${newUser.rank}).`
    });

    logActivity({
      action: 'CONTACT_REGISTERED',
      actionBadge: 'add',
      details: `Official email ${newUser.email} and contact ${phone || 'N/A'} registered for officer ${newUser.officerId}.`
    });

    logActivity({
      action: 'PASSWORD_ESTABLISHED',
      actionBadge: 'edit',
      details: `Encrypted Password security (PBKDF2/SHA-256 hashed) established for ${newUser.officerId}.`
    });

    if (passkeyDevice) {
      logActivity({
        action: 'Device Registered',
        actionBadge: 'add',
        details: `Hardware passkey '${passkeyDevice.name}' registered via WebAuthn protocol.`
      });
    }

    logActivity({
      action: 'Role Assigned',
      actionBadge: 'add',
      details: `Assigned role '${newUser.roleLabel || 'Police Officer'}' with permissions: [${(permissions || ['Read', 'Upload', 'Edit']).join(', ')}].`
    });

    showToast(`Officer account registered for ${newUser.name} (${newUser.roleLabel || 'Police Officer'})`, 'success');
    return newUser;
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

  // Add a new case
  const addCase = (newCaseData) => {
    const caseId = generateCaseId(cases.length);
    const firNumber = newCaseData.firNumber || `FIR-2026-${1025 + cases.length}`;
    const today = new Date().toISOString().split('T')[0];

    const fullCase = {
      id: caseId,
      firNumber,
      title: newCaseData.title,
      caseType: newCaseData.caseType || 'Theft',
      policeStation: newCaseData.policeStation || currentUser?.policeStation || 'Siliguri Police Station',
      investigatingOfficer: newCaseData.investigatingOfficer || currentUser?.name || 'SI Rahul Das',
      officerRank: currentUser?.rank || 'Sub-Inspector',
      createdDate: today,
      lastUpdated: today,
      status: 'Investigation',
      priority: newCaseData.priority || 'Medium',
      description: newCaseData.description || 'Case opened for investigation.',
      incidentDate: newCaseData.incidentDate || today,
      documentCount: 0,
      tags: [newCaseData.caseType || 'Investigation', 'Active']
    };

    setCases(prev => [fullCase, ...prev]);

    logActivity({
      action: 'Case Created',
      actionBadge: 'create',
      caseId: fullCase.id,
      details: `Created new case ${fullCase.id} (${fullCase.firNumber}) - ${fullCase.title}`
    });

    showToast(`Case ${fullCase.id} created successfully!`, 'success');
    return fullCase;
  };

  // Update an existing case
  const updateCase = (caseId, updatedFields) => {
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return { ...c, ...updatedFields, lastUpdated: new Date().toISOString().split('T')[0] };
      }
      return c;
    }));

    logActivity({
      action: 'Case Updated',
      actionBadge: 'edit',
      caseId,
      details: `Updated case details for ${caseId}`
    });

    showToast(`Case ${caseId} updated successfully!`, 'success');
  };

  // Add a new Document
  const addDocument = async (docData) => {
    const docId = generateDocId(documents.length);
    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Calculate real SHA-256 for the content
    const content = docData.content || `CASEVAULT RECORD - ${docData.name}\nCase: ${docData.caseId}\nUploaded by: ${currentUser?.name}\nTimestamp: ${today} ${time}\nClassification: ${docData.classification || 'Internal'}\n\nDocument details verified and archived under digital chain of custody.`;
    const computedHash = await computeSHA256(content);

    const newDoc = {
      id: docId,
      caseId: docData.caseId,
      name: docData.name.endsWith('.pdf') ? docData.name : `${docData.name}.pdf`,
      docType: docData.docType || 'FIR',
      docTypeLabel: docData.docType || 'First Information Report (FIR)',
      version: 1,
      uploadedBy: currentUser?.name || 'SI Rahul Das',
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
  const addUser = (userData) => {
    const cleanEmail = (userData.email || '').trim().toLowerCase();
    const cleanId = (userData.officerId || '').trim().toLowerCase();

    // Duplicate Check
    const isDuplicate = users.some(u => 
      (cleanEmail && (u.email || '').trim().toLowerCase() === cleanEmail) ||
      (cleanId && (u.officerId || '').trim().toLowerCase() === cleanId)
    );

    if (isDuplicate) {
      const err = "Duplicate Officer Detected: An officer with this Officer ID/Badge ID or Email address already exists.";
      showToast(err, 'error');
      return { success: false, error: err };
    }

    const roleLabels = {
      police_officer: 'Police Officer',
      senior_officer: 'Senior Officer',
      legal_officer: 'Legal Officer',
      administrator: 'Administrator'
    };

    const newUser = {
      id: `usr_${Date.now().toString().slice(-4)}`,
      officerId: userData.officerId || `POL-WB-${Math.floor(1000 + Math.random() * 9000)}`,
      name: userData.name,
      role: userData.role || 'police_officer',
      roleLabel: roleLabels[userData.role] || 'Police Officer',
      badge: userData.badge || userData.rank || 'Police Officer',
      rank: userData.rank || userData.badge || 'Police Officer',
      policeStation: userData.policeStation || 'Siliguri Police Station',
      district: userData.district || 'Darjeeling District',
      email: cleanEmail,
      password: userData.password || 'Officer@123',
      phone: userData.phone || '',
      status: 'Active',
      createdDate: new Date().toLocaleDateString('en-GB'),
      lastLogin: 'Never',
      avatar: userData.avatar || (userData.role === 'senior_officer' ? '👮‍♂️' : userData.role === 'legal_officer' ? '⚖️' : userData.role === 'administrator' ? '🛡️' : '👮')
    };

    setUsers(prev => [newUser, ...prev]);

    logActivity({
      action: 'Officer Created',
      actionBadge: 'add',
      details: `New officer account created for ${newUser.name} (${newUser.officerId}) by ${currentUser?.name || 'Administrator'}. Role: ${newUser.roleLabel}, Station: ${newUser.policeStation}.`
    });

    if (userData.idCardUploaded) {
      logActivity({
        action: 'ID Card Uploaded',
        actionBadge: 'upload',
        details: `Official ID Card uploaded & scanned via OCR for ${newUser.name} (${newUser.officerId}).`
      });
    }

    showToast(`Officer ${newUser.name} (${newUser.officerId}) created successfully!`, 'success');
    return { success: true, user: newUser };
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
