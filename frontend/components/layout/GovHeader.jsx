import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu,
  Bell,
  ChevronDown, 
  LogOut, 
  RefreshCw, 
  Lock, 
  User, 
  Building2,
  Check,
  X,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronRight,
  Settings
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IndiaEmblem } from '../common/IndiaEmblem';
import { GlobalSearchBar } from '../common/GlobalSearchBar';

export const GovHeader = () => {
  const { 
    currentUser, 
    logout, 
    resetDemoData, 
    navigate,
    toggleMobileMenu,
    isNotificationsOpen,
    toggleNotifications,
    closeNotifications,
    notifications,
    markAllNotificationsRead
  } = useApp();

  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close profile dropdown & notifications when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowRoleDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        closeNotifications();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowRoleDropdown(false);
        closeNotifications();
      }
    };

    if (showRoleDropdown || isNotificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showRoleDropdown, isNotificationsOpen, closeNotifications]);

  return (
    <header className="w-full bg-[#071c3d] text-white border-b border-slate-700/60 shadow-md select-none sticky top-0 z-40">
      {/* Tri-color Top Strip */}
      <div className="h-1 w-full flex">
        <div className="w-1/3 bg-[#FF9933]"></div>
        <div className="w-1/3 bg-[#FFFFFF]"></div>
        <div className="w-1/3 bg-[#138808]"></div>
      </div>

      {/* Main Government Banner */}
      <div className="w-full px-3 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Left: Mobile Hamburger & National Identity */}
        <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
          
          {/* Mobile Hamburger Button (Visible on screens < 1024px) */}
          <button
            onClick={toggleMobileMenu}
            className="lg:hidden p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-amber-400 hover:text-white transition cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
            aria-label="Open Navigation Drawer"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo & Portal Identity */}
          <div 
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group min-w-0" 
            onClick={() => navigate('dashboard')}
            title="Return to Dashboard"
          >
            {/* Official Indian Emblem (Metallic Gold & Warm Orange) */}
            <IndiaEmblem className="w-7 h-9 sm:w-8 sm:h-10 shrink-0" />

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 leading-none mb-0.5">
                <span className="text-[9px] sm:text-[10px] tracking-wider uppercase font-extrabold text-amber-400 truncate">
                  GOVERNMENT OF INDIA
                </span>
                <span className="text-[9px] sm:text-[10px] hidden xs:inline">🇮🇳</span>
                <span className="text-slate-400 text-[10px] hidden md:inline">•</span>
                <span className="text-[10px] tracking-wider uppercase text-slate-300 font-medium hidden md:inline">
                  MINISTRY OF HOME AFFAIRS
                </span>
              </div>

              <div className="flex items-baseline gap-1.5 sm:gap-2">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight leading-tight flex items-baseline">
                  <span className="text-white">CASE</span>
                  <span className="text-[#f59e0b]">VAULT</span>
                </h1>
                <span className="text-xs text-slate-300 font-normal hidden lg:inline">
                  — Digital Case Document Management System (NCRB)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Global Search Bar (Desktop / Tablet >= 768px) */}
        <div className="hidden md:flex flex-1 max-w-sm lg:max-w-md mx-2">
          <GlobalSearchBar 
            placeholder="🔍 Search case, FIR no., document, officer..." 
            className="w-full text-slate-900"
          />
        </div>

        {/* Right: Notifications, Officer Profile, & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          
          {/* Notifications Bell Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={toggleNotifications}
              className="relative p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-200 hover:text-white transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Notifications & Alerts"
            >
              <Bell className="w-4 h-4 text-amber-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 sm:static px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Popover Panel (Responsive: dropdown on desktop, sheet/modal on mobile) */}
            {isNotificationsOpen && (
              <>
                {/* Backdrop for mobile */}
                <div 
                  className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                  onClick={closeNotifications}
                />

                <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-84 md:w-96 rounded-2xl bg-[#071c3d] border border-slate-700/80 shadow-2xl z-50 p-3 animate-in fade-in zoom-in-95 duration-100 max-h-[80vh] flex flex-col">
                  {/* Notifications Header */}
                  <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Alerts & Notifications ({notifications.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllNotificationsRead}
                          className="text-[10px] text-amber-400 hover:underline font-bold cursor-pointer"
                        >
                          Mark read
                        </button>
                      )}
                      <button
                        onClick={closeNotifications}
                        className="w-5 h-5 rounded-md bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Notifications List */}
                  <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (n.caseId) navigate('case-detail', { caseId: n.caseId });
                          closeNotifications();
                        }}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-start gap-2.5 ${
                          n.read 
                            ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/80' 
                            : 'bg-blue-950/80 border-blue-800/80 text-white hover:bg-blue-900/90 shadow-xs'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {n.type === 'warning' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                          ) : n.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Info className="w-4 h-4 text-blue-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-white text-xs truncate">{n.title}</span>
                            <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{n.message}</p>
                          {n.caseId && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400 font-semibold">
                              <span>Open {n.caseId}</span>
                              <ChevronRight className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Officer Profile & Switcher Button */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 text-white text-xs transition cursor-pointer shadow-xs group"
              title="Officer Profile & Settings"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-900/90 border border-amber-400/40 flex items-center justify-center text-sm sm:text-base shrink-0 shadow-inner overflow-hidden">
                {currentUser?.avatar && (currentUser.avatar.startsWith('data:image') || currentUser.avatar.startsWith('http') || currentUser.avatar.startsWith('blob:')) ? (
                  <img src={currentUser.avatar} alt="Officer" className="w-full h-full object-cover" />
                ) : (
                  <span>{currentUser?.avatar || '👮'}</span>
                )}
              </div>
              <div className="text-left hidden md:block min-w-0">
                <div className="font-bold text-white text-xs leading-tight truncate max-w-[130px]">
                  {currentUser?.name}
                </div>
                <div className="text-[10px] text-amber-400 font-semibold leading-tight truncate">
                  {currentUser?.roleLabel}
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 ml-0.5 transition-transform duration-200 ${showRoleDropdown ? 'rotate-180 text-white' : ''}`} />
            </button>

            {/* Polished Dropdown Menu */}
            {showRoleDropdown && (
              <>
                {/* Invisible backdrop to dismiss immediately on click */}
                <div 
                  className="fixed inset-0 z-40 bg-black/40 lg:bg-transparent" 
                  onClick={() => setShowRoleDropdown(false)} 
                />

                <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-72 rounded-2xl bg-[#071c3d] border border-slate-700/80 shadow-2xl z-50 p-2.5 animate-in fade-in zoom-in-95 duration-100">
                  {/* Active Officer Summary */}
                  <div className="p-2.5 mb-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs relative">
                    <button
                      onClick={() => setShowRoleDropdown(false)}
                      className="absolute top-2 right-2 w-5 h-5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition"
                      title="Close"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Logged-In Officer
                    </div>
                    <div className="font-extrabold text-white text-sm mt-0.5 pr-6 truncate">
                      {currentUser?.name}
                    </div>
                    <div className="text-[11px] text-amber-400 font-semibold">
                      {currentUser?.badge || currentUser?.roleLabel}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{currentUser?.policeStation}</span>
                    </div>

                    <button
                      onClick={() => {
                        navigate('profile');
                        setShowRoleDropdown(false);
                      }}
                      className="w-full mt-2.5 py-1.5 px-3 rounded-lg bg-blue-600/40 hover:bg-blue-600/70 border border-blue-500/60 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                    >
                      <User className="w-3.5 h-3.5 text-amber-400" />
                      <span>View & Edit My Profile</span>
                    </button>
                  </div>

                  <div className="pt-2 mt-1 border-t border-slate-800 flex items-center justify-between gap-1.5">
                    <button
                      onClick={() => { navigate('settings'); setShowRoleDropdown(false); }}
                      className="flex-1 text-left px-2 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">Settings</span>
                    </button>
                    <button
                      onClick={() => {
                        resetDemoData();
                        setShowRoleDropdown(false);
                      }}
                      className="px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 flex items-center gap-1 transition cursor-pointer"
                      title="Reset Demo Data"
                    >
                      <RefreshCw className="w-3 h-3 shrink-0" />
                      <span>Reset</span>
                    </button>
                    <button
                      onClick={() => {
                        logout();
                        setShowRoleDropdown(false);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs text-red-300 hover:bg-red-950/40 flex items-center gap-1 font-bold transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Polished Logout Button (Desktop only) */}
          <button
            onClick={logout}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-200 hover:text-white text-xs font-bold transition shadow-xs cursor-pointer group"
            title="Log out of current session"
          >
            <LogOut className="w-3.5 h-3.5 text-red-300 group-hover:translate-x-0.5 transition-transform" />
            <span>Logout</span>
          </button>
        </div>

      </div>
    </header>
  );
};
