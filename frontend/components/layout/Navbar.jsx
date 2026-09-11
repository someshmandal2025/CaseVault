import React, { useEffect } from 'react';
import { 
  Home, 
  FolderLock, 
  FileText, 
  Search, 
  ClipboardList, 
  Users, 
  Settings, 
  Sparkles,
  LogOut,
  X,
  Building2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IndiaEmblem } from '../common/IndiaEmblem';

export const Navbar = () => {
  const { 
    currentPage, 
    navigate, 
    currentUser, 
    logout,
    isMobileMenuOpen,
    closeMobileMenu
  } = useApp();

  // Role permissions for Users page: Admin or Senior Officer can see Users
  const canManageUsers = currentUser?.role === 'administrator' || currentUser?.role === 'senior_officer';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, badge: null },
    { id: 'cases', label: 'My Cases', icon: FolderLock, badge: '5' },
    { id: 'documents', label: 'Documents', icon: FileText, badge: '20+' },
    { id: 'search', label: 'Search', icon: Search, badge: null },
    { id: 'audit', label: 'Audit Trail', icon: ClipboardList, badge: 'Live' },
    ...(canManageUsers ? [{ id: 'users', label: 'Users', icon: Users, badge: 'Admin' }] : []),
    { id: 'future-scope', label: 'Future Scope', icon: Sparkles, badge: 'AI/Chain' },
    { id: 'settings', label: 'Settings', icon: Settings, badge: null },
  ];

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        closeMobileMenu();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen, closeMobileMenu]);

  // Handle navigation item click
  const handleNavClick = (pageId) => {
    navigate(pageId);
    closeMobileMenu();
  };

  const navList = (
    <nav className="space-y-1 sm:space-y-1.5 flex-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPage === item.id || 
          (item.id === 'cases' && currentPage === 'case-detail') ||
          (item.id === 'documents' && (currentPage === 'doc-viewer' || currentPage === 'upload'));

        return (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-bold transition-all group cursor-pointer active:scale-[0.98] ${
              isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-300 hover:bg-slate-800/90 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </div>
            {item.badge && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider shrink-0 ${
                isActive 
                  ? 'bg-white/20 text-white' 
                  : item.badge === 'Live'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* ================= 1. DESKTOP PERMANENT STICKY SIDEBAR (>= 1024px) ================= */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-slate-200 border-r border-slate-800 flex-col justify-between shrink-0 shadow-lg select-none rounded-2xl sticky top-[73px] h-[calc(100vh-95px)] overflow-hidden">
        {/* Navigation Section */}
        <div className="p-3.5 space-y-2 overflow-y-auto flex-1">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-3 py-1.5">
            Navigation Menu
          </div>
          {navList}
        </div>

        {/* Officer Profile & Logout Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/80 shrink-0">
          <button
            onClick={() => navigate('profile')}
            className="w-full flex items-center gap-2.5 mb-2.5 p-1.5 -m-1.5 rounded-xl hover:bg-slate-900/90 border border-transparent hover:border-slate-800 transition text-left cursor-pointer group"
            title="Click to view & edit My Profile"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-900 flex items-center justify-center text-lg shadow-inner border border-blue-400/40 shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
              {currentUser?.avatar && (currentUser.avatar.startsWith('data:image') || currentUser.avatar.startsWith('http') || currentUser.avatar.startsWith('blob:')) ? (
                <img src={currentUser.avatar} alt="Officer" className="w-full h-full object-cover" />
              ) : (
                <span>{currentUser?.avatar || '👮'}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-slate-400 font-semibold leading-tight group-hover:text-amber-400 transition-colors">Logged in officer • Profile</div>
              <div className="text-xs font-bold text-white truncate leading-tight mt-0.5">{currentUser?.name}</div>
              <div className="text-[10px] text-amber-400 font-semibold truncate leading-tight">{currentUser?.roleLabel}</div>
            </div>
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-red-200 bg-red-950/40 hover:bg-red-900/60 border border-red-900/60 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout Session</span>
          </button>
        </div>
      </aside>

      {/* ================= 2. MOBILE & TABLET SLIDE-IN DRAWER (< 1024px) ================= */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Dimmed backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={closeMobileMenu}
          />

          {/* Slide-in drawer */}
          <div className="relative w-72 sm:w-80 max-w-[85vw] bg-[#071c3d] text-slate-200 flex flex-col justify-between shadow-2xl border-r border-slate-700/80 z-50 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="p-4 bg-slate-900 border-b border-slate-700/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <IndiaEmblem className="w-6 h-8 shrink-0" />
                <div>
                  <div className="flex items-baseline">
                    <span className="text-base font-black text-white">CASE</span>
                    <span className="text-base font-black text-amber-400">VAULT</span>
                  </div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    NCRB Intranet Node
                  </div>
                </div>
              </div>

              <button
                onClick={closeMobileMenu}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                title="Close Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation List */}
            <div className="p-3 overflow-y-auto flex-1 space-y-3">
              {navList}
            </div>

            {/* Officer Profile & Logout Bottom */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/90 shrink-0">
              <button
                onClick={() => {
                  closeMobileMenu();
                  navigate('profile');
                }}
                className="w-full flex items-center gap-3 mb-3 p-1.5 -m-1.5 rounded-xl hover:bg-slate-900/90 border border-transparent hover:border-slate-800 transition text-left cursor-pointer group"
                title="Click to view & edit My Profile"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-900/90 border border-amber-400/40 flex items-center justify-center text-xl shrink-0 shadow-inner group-hover:scale-105 transition-transform overflow-hidden">
                  {currentUser?.avatar && (currentUser.avatar.startsWith('data:image') || currentUser.avatar.startsWith('http') || currentUser.avatar.startsWith('blob:')) ? (
                    <img src={currentUser.avatar} alt="Officer" className="w-full h-full object-cover" />
                  ) : (
                    <span>{currentUser?.avatar || '👮'}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate group-hover:text-amber-400 transition-colors">{currentUser?.name}</div>
                  <div className="text-[11px] text-amber-400 font-semibold truncate">{currentUser?.roleLabel}</div>
                  <div className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="truncate">{currentUser?.policeStation}</span>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  closeMobileMenu();
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold text-red-200 bg-red-950/50 hover:bg-red-900/60 border border-red-900/60 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout Session</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
