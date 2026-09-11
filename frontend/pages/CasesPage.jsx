import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  FolderPlus, 
  Eye, 
  Calendar, 
  Shield, 
  FileText, 
  Plus, 
  X,
  CheckCircle2,
  ChevronRight,
  SlidersHorizontal,
  FolderOpen,
  Building2,
  UserCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CaseStatusBadge } from '../components/common/StatusBadge';
import { POLICE_STATIONS } from '../../database/seeds/mockData';

export const CasesPage = () => {
  const { cases, navigate, openNewCaseModal } = useApp();

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stationFilter, setStationFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  // Filtered cases
  const filteredCases = cases.filter(c => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      c.id.toLowerCase().includes(term) ||
      (c.firNumber && c.firNumber.toLowerCase().includes(term)) ||
      (c.title && c.title.toLowerCase().includes(term)) ||
      (c.caseType && c.caseType.toLowerCase().includes(term)) ||
      (c.complainant && c.complainant.toLowerCase().includes(term)) ||
      (c.complainantName && c.complainantName.toLowerCase().includes(term)) ||
      (c.accused && c.accused.toLowerCase().includes(term)) ||
      (c.suspectName && c.suspectName.toLowerCase().includes(term)) ||
      (c.investigatingOfficer && c.investigatingOfficer.toLowerCase().includes(term));

    const matchesStatus = statusFilter === 'All' 
      || c.status.toLowerCase() === statusFilter.toLowerCase()
      || (statusFilter.toLowerCase() === 'investigation' && (c.status.toLowerCase() === 'active' || c.status.toLowerCase() === 'investigation'))
      || (statusFilter.toLowerCase() === 'active' && (c.status.toLowerCase() === 'active' || c.status.toLowerCase() === 'investigation'));
    const matchesStation = stationFilter === 'All' || c.policeStation === stationFilter;
    const matchesType = typeFilter === 'All' || (c.caseType && c.caseType.toLowerCase() === typeFilter.toLowerCase());
    const matchesPriority = priorityFilter === 'All' || (c.priority && c.priority.toLowerCase() === priorityFilter.toLowerCase());

    return matchesSearch && matchesStatus && matchesStation && matchesType && matchesPriority;
  });

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 sm:gap-3">
            <span>📁 Case Dossiers & FIRs</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-900 border border-blue-200">
              {filteredCases.length} Records
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Search, manage, and inspect tamper-evident digital investigation dossiers
          </p>
        </div>

        <button
          onClick={openNewCaseModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs sm:text-sm shadow-md transition cursor-pointer shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
          <span>+ Register FIR / New Case</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 sm:space-y-4">
        {/* Search input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 Search Case ID, FIR, Complainant, Accused, Crime Type, Officer..."
            className="w-full pl-11 pr-10 py-3 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-900 bg-slate-50/50"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns (Responsive Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Case Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="All">All Statuses</option>
              <option value="Investigation">Investigation / Active</option>
              <option value="Under Review">Under Review</option>
              <option value="Chargesheet Filed">Chargesheet Filed</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Priority
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="All">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Police Station
            </label>
            <select
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="All">All Police Stations</option>
              {POLICE_STATIONS.map(ps => (
                <option key={ps} value={ps}>{ps}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Crime Classification
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="All">All Crime Types</option>
              <option value="Missing Person">Missing Person</option>
              <option value="Cybercrime">Cybercrime</option>
              <option value="Property Theft">Property Theft</option>
              <option value="Financial Fraud">Financial Fraud</option>
              <option value="Assault">Assault</option>
              <option value="Narcotics">Narcotics</option>
              <option value="Court Filing">Court Filing</option>
              <option value="Charge Sheet">Charge Sheet</option>
              <option value="Theft">Theft</option>
              <option value="Robbery">Robbery</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('All');
                setStationFilter('All');
                setTypeFilter('All');
                setPriorityFilter('All');
              }}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>Reset Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cases View: Responsive Card View on Mobile, Full Table on Desktop */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredCases.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800">No matching cases found</h3>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or resetting filters.</p>
          </div>
        ) : (
          <>
            {/* --- 1. MOBILE RESPONSIVE CASE CARDS (< 768px) --- */}
            <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
              {filteredCases.map((c) => (
                <div 
                  key={c.id} 
                  onClick={() => navigate('case-detail', { caseId: c.id })}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-blue-50/40 transition cursor-pointer space-y-2.5 active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-extrabold text-blue-950 text-base">{c.id}</div>
                      <div className="text-xs text-slate-500 font-mono">{c.firNumber}</div>
                    </div>
                    <CaseStatusBadge status={c.status} />
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-800">{c.caseType}</div>
                    <div className="text-xs text-slate-600 font-medium line-clamp-1">{c.title}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 pt-2 border-t border-slate-200/60">
                    <div className="flex items-center gap-1 truncate">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{c.policeStation}</span>
                    </div>
                    <div className="text-right font-semibold text-slate-700">
                      📄 {c.documentsCount || (c.id === 'CASE-1024' ? 12 : c.id === 'CASE-1023' ? 18 : c.id === 'CASE-1022' ? 9 : 21)} Documents
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{c.dateOpened}</span>
                    </div>
                    <div className="text-right text-[11px] text-slate-500 truncate">
                      I.O.: {c.investigatingOfficer}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('case-detail', { caseId: c.id });
                    }}
                    className="w-full py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Case Dossier</span>
                  </button>
                </div>
              ))}
            </div>

            {/* --- 2. DESKTOP TABLE VIEW (>= 768px) --- */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-bold">
                    <th className="py-4 px-6">Case ID</th>
                    <th className="py-4 px-6">Case Title & Type</th>
                    <th className="py-4 px-6">Police Station</th>
                    <th className="py-4 px-6">Investigating Officer</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-center">Docs</th>
                    <th className="py-4 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium">
                  {filteredCases.map((c) => (
                    <tr 
                      key={c.id} 
                      className="hover:bg-blue-50/50 transition cursor-pointer"
                      onClick={() => navigate('case-detail', { caseId: c.id })}
                    >
                      <td className="py-4 px-6">
                        <div className="font-extrabold text-blue-900 text-base">{c.id}</div>
                        <div className="text-xs text-slate-500 font-mono">{c.firNumber}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900">{c.title}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="font-semibold text-blue-800">{c.caseType}</span>
                          <span>•</span>
                          <span>Opened: {c.dateOpened}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-700 text-xs font-semibold">
                        {c.policeStation}
                      </td>
                      <td className="py-4 px-6 text-slate-700">
                        <div className="font-semibold text-xs">{c.investigatingOfficer}</div>
                        <div className="text-[11px] text-slate-400">{c.assistingOfficer}</div>
                      </td>
                      <td className="py-4 px-6">
                        <CaseStatusBadge status={c.status} />
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {c.documentsCount || (c.id === 'CASE-1024' ? 12 : c.id === 'CASE-1023' ? 18 : c.id === 'CASE-1022' ? 9 : 21)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('case-detail', { caseId: c.id });
                          }}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
