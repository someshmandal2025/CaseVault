import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  FileText, 
  FolderLock, 
  ExternalLink, 
  Calendar, 
  Building2, 
  Eye, 
  X, 
  Sparkles, 
  ShieldCheck, 
  Tag, 
  User, 
  AlertCircle, 
  Clock, 
  ChevronRight,
  ArrowRight,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GlobalSearchBar } from '../components/common/GlobalSearchBar';
import { CaseStatusBadge, ClassificationBadge, IntegrityBadge } from '../components/common/StatusBadge';
import { formatIndianDate } from '../utils/cryptoUtils';
import { POLICE_STATIONS, DOCUMENT_TYPES } from '../../database/seeds/mockData';

export const SearchPage = () => {
  const { 
    documents, 
    cases, 
    navigate, 
    tamperedDocs, 
    searchQuery, 
    setSearchQuery 
  } = useApp();

  const [activeTabFilter, setActiveTabFilter] = useState('all'); // all, cases, documents
  const [selectedType, setSelectedType] = useState('All');
  const [selectedStation, setSelectedStation] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  const query = searchQuery || '';
  const cleanQ = query.trim().toLowerCase();
  const normalizedQ = cleanQ.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // 1. Search Cases
  const matchedCases = cases.filter(c => {
    if (!cleanQ) return true;
    const idMatch = c.id.toLowerCase().includes(cleanQ) || c.id.toLowerCase().replace('-', ' ').includes(cleanQ) || c.id.toLowerCase().includes(normalizedQ);
    const firMatch = c.firNumber && (c.firNumber.toLowerCase().includes(cleanQ) || c.firNumber.toLowerCase().replace(/[-/]/g, ' ').includes(cleanQ));
    const titleMatch = c.title.toLowerCase().includes(cleanQ);
    const typeMatch = c.caseType.toLowerCase().includes(cleanQ);
    const summaryMatch = c.summary && c.summary.toLowerCase().includes(cleanQ);
    const officerMatch = c.investigatingOfficer.toLowerCase().includes(cleanQ);
    const stationMatch = c.policeStation.toLowerCase().includes(cleanQ);
    return idMatch || firMatch || titleMatch || typeMatch || summaryMatch || officerMatch || stationMatch;
  }).filter(c => {
    const matchesStation = selectedStation === 'All' || c.policeStation === selectedStation;
    const matchesStatus = selectedStatus === 'All' || c.status.toLowerCase() === selectedStatus.toLowerCase();
    return matchesStation && matchesStatus;
  });

  // 2. Search Documents
  const matchedDocuments = documents.map(doc => {
    const parentCase = cases.find(c => c.id === doc.caseId) || {};
    return {
      ...doc,
      caseTitle: parentCase.title || 'Unknown Case',
      policeStation: parentCase.policeStation || 'Siliguri Police Station',
      caseStatus: parentCase.status || 'Active',
      investigatingOfficer: parentCase.investigatingOfficer || doc.uploadedBy
    };
  }).filter(doc => {
    if (!cleanQ) return true;
    const nameMatch = doc.name.toLowerCase().includes(cleanQ) || doc.name.toLowerCase().replace(/[_.-]/g, ' ').includes(cleanQ);
    const typeMatch = doc.docType.toLowerCase().includes(cleanQ);
    const caseMatch = doc.caseId.toLowerCase().includes(cleanQ);
    const uploaderMatch = doc.uploadedBy.toLowerCase().includes(cleanQ);
    const contentMatch = doc.content && doc.content.toLowerCase().includes(cleanQ);
    const descMatch = doc.description && doc.description.toLowerCase().includes(cleanQ);
    return nameMatch || typeMatch || caseMatch || uploaderMatch || contentMatch || descMatch;
  }).filter(doc => {
    const matchesType = selectedType === 'All' || doc.docType === selectedType;
    const matchesStation = selectedStation === 'All' || doc.policeStation === selectedStation;
    const matchesStatus = selectedStatus === 'All' || doc.caseStatus.toLowerCase() === selectedStatus.toLowerCase();
    return matchesType && matchesStation && matchesStatus;
  });

  const totalResultsCount = (activeTabFilter === 'cases' ? matchedCases.length : activeTabFilter === 'documents' ? matchedDocuments.length : matchedCases.length + matchedDocuments.length);

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      
      {/* Header Search Banner */}
      <div className="bg-[#071c3d] p-5 sm:p-7 rounded-2xl text-white shadow-md border border-slate-700/80 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-900 text-amber-400 border border-blue-700">
              SMART POLICE SEARCH
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight">
            🔍 Case & Document Search
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
            Search across Case IDs, FIR references, digital evidence files, forensic reports, and officer dossiers.
          </p>
        </div>

        {/* Big Search Input with Auto-Suggestions */}
        <GlobalSearchBar 
          placeholder="🔍 Search case, FIR no., document, officer..." 
          className="shadow-xl"
        />
      </div>

      {/* Results Header Strip */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="text-base sm:text-lg font-black text-slate-900">
            Search Results
          </h2>
          {query && (
            <span className="text-xs text-slate-500 font-medium">
              for <strong className="text-blue-900 font-mono">"{query}"</strong>
            </span>
          )}
          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-900">
            {totalResultsCount} results found
          </span>
        </div>

        {/* Tab Filters (All / Cases / Documents) */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl self-start sm:self-auto text-xs font-bold">
          <button
            onClick={() => setActiveTabFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTabFilter === 'all' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({matchedCases.length + matchedDocuments.length})
          </button>
          <button
            onClick={() => setActiveTabFilter('cases')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTabFilter === 'cases' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cases ({matchedCases.length})
          </button>
          <button
            onClick={() => setActiveTabFilter('documents')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTabFilter === 'documents' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Documents ({matchedDocuments.length})
          </button>
        </div>
      </div>

      {/* Filter Dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-xs">
        <div>
          <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Police Station
          </label>
          <select
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold text-slate-800 bg-white"
          >
            <option value="All">All Police Stations</option>
            {POLICE_STATIONS.map(ps => (
              <option key={ps} value={ps}>{ps}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Document Type
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold text-slate-800 bg-white"
          >
            <option value="All">All Types</option>
            {DOCUMENT_TYPES.map(t => {
              const val = typeof t === 'object' ? t.value : t;
              const lbl = typeof t === 'object' ? t.label : t;
              return <option key={val} value={val}>{lbl}</option>;
            })}
          </select>
        </div>

        <div>
          <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Case Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold text-slate-800 bg-white"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Investigation">Investigation</option>
            <option value="Under Review">Under Review</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      {/* ================= RESULTS SECTION ================= */}
      {totalResultsCount === 0 ? (
        /* No Results State (Requirement 9) */
        <div className="bg-white p-8 sm:p-14 rounded-2xl border border-slate-200 shadow-xs text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Search className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              No results found
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
              We couldn't find anything matching <strong className="text-slate-800">"{query}"</strong>.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 max-w-md mx-auto text-left text-xs space-y-1.5">
            <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Try searching for:</div>
            <ul className="list-disc list-inside text-slate-600 space-y-0.5">
              <li><strong>Case ID</strong> (e.g. <code>CASE-1024</code> or <code>1024</code>)</li>
              <li><strong>FIR number</strong> (e.g. <code>FIR-2026-1024</code>)</li>
              <li><strong>Document name</strong> (e.g. <code>FIR_1024.pdf</code> or <code>seizure</code>)</li>
              <li><strong>Officer name</strong> (e.g. <code>Sharma</code> or <code>Rahul</code>)</li>
              <li><strong>Crime Category</strong> (e.g. <code>Theft</code>, <code>Cybercrime</code>, <code>Fraud</code>)</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* A. CASE RESULTS */}
          {(activeTabFilter === 'all' || activeTabFilter === 'cases') && matchedCases.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 px-1">
                <FolderLock className="w-4 h-4 text-blue-900" />
                <span>Matching Cases ({matchedCases.length})</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {matchedCases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => navigate('case-detail', { caseId: c.id })}
                    className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-3 group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-md bg-blue-900 text-white">
                          📁 {c.id}
                        </span>
                        <CaseStatusBadge status={c.status} />
                      </div>

                      <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-blue-900 transition leading-snug">
                        {c.title}
                      </h3>

                      <div className="text-xs text-slate-500 space-y-1 mt-2">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{c.policeStation}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>I.O.: {c.investigatingOfficer}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-400 font-semibold">
                        {c.documentCount || 4} Documents
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('case-detail', { caseId: c.id });
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                      >
                        <span>Open Case</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* B. DOCUMENT RESULTS */}
          {(activeTabFilter === 'all' || activeTabFilter === 'documents') && matchedDocuments.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 px-1">
                <FileText className="w-4 h-4 text-blue-900" />
                <span>Matching Documents ({matchedDocuments.length})</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {matchedDocuments.map((doc) => {
                  const isTampered = !!tamperedDocs[doc.id];
                  const isPhoto = doc.name.endsWith('.jpg') || doc.name.endsWith('.png') || doc.docType === 'Evidence Photograph';

                  return (
                    <div
                      key={doc.id}
                      onClick={() => navigate('doc-viewer', { docId: doc.id })}
                      className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-3 group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isPhoto ? <ImageIcon className="w-4 h-4 text-emerald-700" /> : <FileText className="w-4 h-4 text-blue-900" />}
                            <span className="text-[11px] font-bold uppercase text-slate-600 font-mono">
                              {doc.docType}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            v{doc.version}
                          </span>
                        </div>

                        <h3 className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-blue-900 transition leading-snug truncate">
                          {doc.name}
                        </h3>

                        <div className="text-xs text-slate-500 space-y-1">
                          <div>Case: <strong className="text-blue-900 font-mono">{doc.caseId}</strong></div>
                          <div>Uploaded: <span>{formatIndianDate(doc.uploadDate)}</span></div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <IntegrityBadge isVerified={doc.status === 'Verified'} isTampered={isTampered} />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('doc-viewer', { docId: doc.id });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
