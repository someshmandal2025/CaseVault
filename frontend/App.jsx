import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { GovHeader } from './components/layout/GovHeader';
import { Navbar } from './components/layout/Navbar';
import { Toast } from './components/common/Toast';
import { NewCaseModal } from './components/common/NewCaseModal';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CasesPage } from './pages/CasesPage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { DocumentViewerPage } from './pages/DocumentViewerPage';
import { UploadDocumentPage } from './pages/UploadDocumentPage';
import { SearchPage } from './pages/SearchPage';
import { AuditTrailPage } from './pages/AuditTrailPage';
import { UsersPage } from './pages/UsersPage';
import { FutureScopePage } from './pages/FutureScopePage';
import { SettingsPage } from './pages/SettingsPage';

const MainLayout = () => {
  const { isAuthenticated, currentPage } = useApp();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'cases':
        return <CasesPage />;
      case 'case-detail':
        return <CaseDetailPage />;
      case 'documents':
        return <DocumentsPage />;
      case 'doc-viewer':
        return <DocumentViewerPage />;
      case 'upload':
        return <UploadDocumentPage />;
      case 'search':
        return <SearchPage />;
      case 'audit':
        return <AuditTrailPage />;
      case 'users':
        return <UsersPage />;
      case 'future-scope':
        return <FutureScopePage />;
      case 'profile':
        return <SettingsPage defaultTab="profile" />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 selection:bg-blue-900 selection:text-white">
      {/* Government Top Header */}
      <GovHeader />

      {/* Main Container: Sidebar + Page Content */}
      <div className="flex-1 flex flex-col lg:flex-row w-full px-4 sm:px-6 lg:px-8 py-6 gap-6 items-start">
        {/* Left Sidebar Navigation */}
        <Navbar />

        {/* Dynamic Page Content */}
        <main className="flex-1 min-w-0 w-full">
          {renderCurrentPage()}
        </main>
      </div>

      {/* Official Government Footer */}
      <footer className="bg-slate-900 text-slate-400 py-4 px-4 sm:px-6 lg:px-8 text-center text-xs border-t border-slate-800 mt-auto no-print">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-200">CASEVAULT Prototype</span>
            <span>•</span>
            <span>National Crime Records Bureau (NCRB) & Ministry of Home Affairs</span>
          </div>
          <div className="text-slate-500 font-mono text-[11px]">
            SHA-256 Digital Verification Node • WB State Police Net
          </div>
        </div>
      </footer>

      {/* Global New Case Registration Modal */}
      <NewCaseModal />

      {/* Global Toast Alerts */}
      <Toast />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
