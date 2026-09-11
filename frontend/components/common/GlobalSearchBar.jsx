import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  FolderLock, 
  FileText, 
  User, 
  Clock, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Building2, 
  CornerDownLeft, 
  AlertCircle,
  FileBadge,
  Trash2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const GlobalSearchBar = ({ placeholder = "Search case, FIR no., document, officer...", className = "", autoFocusOnMount = false }) => {
  const { 
    cases, 
    documents, 
    navigate, 
    searchQuery, 
    setSearchQuery 
  } = useApp();

  const [query, setQuery] = useState(searchQuery || '');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem('casevault_recent_searches');
      return saved ? JSON.parse(saved) : ['CASE-1024', 'FIR-2026-1024', 'Evidence Photograph', 'Missing Person'];
    } catch {
      return ['CASE-1024', 'FIR-2026-1024', 'Evidence Photograph', 'Missing Person'];
    }
  });

  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Sync recent searches to LocalStorage
  const saveRecentSearch = (term) => {
    if (!term || !term.trim()) return;
    const trimmed = term.trim();
    const updated = [trimmed, ...recentSearches.filter(s => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6);
    setRecentSearches(updated);
    try {
      localStorage.setItem('casevault_recent_searches', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearRecentSearches = (e) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem('casevault_recent_searches');
    } catch (e) {
      console.error(e);
    }
  };

  // Global Ctrl + K / Cmd + K listener
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (inputRef.current) {
          inputRef.current.focus();
          setIsOpen(true);
        }
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen]);

  // Click outside listener to close suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Normalize query for forgiving search (CASE 1024 -> case-1024, FIR 1024 -> fir-2026-1024)
  const cleanQ = query.trim().toLowerCase();
  const normalizedQ = cleanQ.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // Calculate categorized suggestions
  let caseMatches = [];
  let docMatches = [];
  let officerMatches = [];

  if (cleanQ.length > 0) {
    // 1. Cases Matching
    caseMatches = cases.filter(c => {
      const idMatch = c.id.toLowerCase().includes(cleanQ) || c.id.toLowerCase().replace('-', ' ').includes(cleanQ) || c.id.toLowerCase().includes(normalizedQ);
      const firMatch = c.firNumber && (c.firNumber.toLowerCase().includes(cleanQ) || c.firNumber.toLowerCase().replace(/[-/]/g, ' ').includes(cleanQ));
      const titleMatch = c.title.toLowerCase().includes(cleanQ);
      const typeMatch = c.caseType.toLowerCase().includes(cleanQ);
      const summaryMatch = c.summary && c.summary.toLowerCase().includes(cleanQ);
      const officerMatch = c.investigatingOfficer.toLowerCase().includes(cleanQ);
      return idMatch || firMatch || titleMatch || typeMatch || summaryMatch || officerMatch;
    }).slice(0, 3);

    // 2. Documents Matching
    docMatches = documents.filter(d => {
      const nameMatch = d.name.toLowerCase().includes(cleanQ) || d.name.toLowerCase().replace(/[_.-]/g, ' ').includes(cleanQ);
      const typeMatch = d.docType.toLowerCase().includes(cleanQ);
      const caseMatch = d.caseId.toLowerCase().includes(cleanQ);
      const uploaderMatch = d.uploadedBy.toLowerCase().includes(cleanQ);
      return nameMatch || typeMatch || caseMatch || uploaderMatch;
    }).slice(0, 3);

    // 3. Officers Matching
    const allOfficers = ['Inspector Sharma', 'SI Rahul Das', 'SI Megha Sen', 'Adv. Ananya Roy', 'Rajesh Verma, IPS'];
    officerMatches = allOfficers.filter(o => o.toLowerCase().includes(cleanQ)).slice(0, 2);
  }

  // Flatten suggestions for keyboard navigation
  const allSuggestions = [
    ...caseMatches.map(c => ({ type: 'case', item: c })),
    ...docMatches.map(d => ({ type: 'doc', item: d })),
    ...officerMatches.map(o => ({ type: 'officer', item: o }))
  ];

  // Handle keyboard arrow navigation
  const handleKeyDown = (e) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < allSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : allSuggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < allSuggestions.length) {
        handleSelectSuggestion(allSuggestions[selectedIndex]);
      } else {
        handleTriggerFullSearch(query);
      }
    }
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion) => {
    setIsOpen(false);
    if (suggestion.type === 'case') {
      saveRecentSearch(suggestion.item.id);
      navigate('case-detail', { caseId: suggestion.item.id });
    } else if (suggestion.type === 'doc') {
      saveRecentSearch(suggestion.item.name);
      navigate('doc-viewer', { docId: suggestion.item.id });
    } else if (suggestion.type === 'officer') {
      saveRecentSearch(suggestion.item);
      setSearchQuery(suggestion.item);
      navigate('search');
    }
  };

  // Trigger full search page
  const handleTriggerFullSearch = (term) => {
    if (!term || !term.trim()) return;
    saveRecentSearch(term);
    setSearchQuery(term);
    setIsOpen(false);
    navigate('search');
  };

  const quickFilterPills = [
    { label: 'My Active Cases', query: 'Active' },
    { label: 'FIR Documents', query: 'FIR' },
    { label: 'Pending Review', query: 'Under Review' },
    { label: 'Temporary Cases', query: 'TEMP-CASE' }
  ];

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      
      {/* Search Input Container */}
      <div className="relative flex items-center w-full">
        <div className="absolute left-3.5 sm:left-4 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-blue-900" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 sm:pl-12 pr-20 sm:pr-24 py-3 sm:py-3.5 rounded-2xl border border-slate-300 bg-white text-slate-900 text-xs sm:text-sm font-medium shadow-xs focus:ring-2 focus:ring-blue-900 focus:border-blue-900 transition placeholder:text-slate-400"
        />

        {/* Right side controls: Clear (X) + Keyboard Shortcut Pill */}
        <div className="absolute right-3 flex items-center gap-1.5">
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setIsOpen(true);
                inputRef.current?.focus();
              }}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="hidden sm:flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-400 font-semibold select-none">
            <span>Ctrl</span>
            <span>+</span>
            <span>K</span>
          </div>
        </div>
      </div>

      {/* ================= AUTO-SUGGESTIONS & RECENT SEARCHES OVERLAY ================= */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* --- A. WHEN USER IS TYPING (Requirement 2 & 3: Top 5-8 Categorized Suggestions) --- */}
          {cleanQ.length > 0 ? (
            <div className="p-2 sm:p-3 max-h-[75vh] overflow-y-auto space-y-3">
              
              {allSuggestions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                  <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
                  <div className="font-bold text-slate-800">No immediate suggestions for "{query}"</div>
                  <p className="text-[11px] text-slate-400">Press Enter to run full multi-field archive search.</p>
                  <button
                    onClick={() => handleTriggerFullSearch(query)}
                    className="mt-2 px-4 py-2 rounded-xl bg-blue-900 text-white font-bold text-xs cursor-pointer hover:bg-blue-950"
                  >
                    Search Full Case Database →
                  </button>
                </div>
              ) : (
                <>
                  {/* Cases Section */}
                  {caseMatches.length > 0 && (
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 py-1 flex items-center gap-1.5">
                        <FolderLock className="w-3.5 h-3.5 text-blue-900" />
                        <span>Cases ({caseMatches.length})</span>
                      </div>
                      <div className="space-y-1">
                        {caseMatches.map((c, i) => {
                          const flatIdx = i;
                          const isSelected = selectedIndex === flatIdx;
                          return (
                            <button
                              key={c.id}
                              onClick={() => handleSelectSuggestion({ type: 'case', item: c })}
                              className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between gap-3 cursor-pointer ${
                                isSelected ? 'bg-blue-900 text-white shadow-xs' : 'hover:bg-slate-100 text-slate-900'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-base">📁</span>
                                <div className="min-w-0">
                                  <div className="text-xs sm:text-sm font-bold truncate">
                                    <span className="font-mono text-blue-900 font-extrabold mr-1.5 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                                      {c.id}
                                    </span>
                                    <span>{c.title}</span>
                                  </div>
                                  <div className={`text-[10px] truncate ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                                    {c.policeStation} • {c.caseType} • FIR: {c.firNumber || 'Pending'}
                                  </div>
                                </div>
                              </div>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {c.status}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Documents Section */}
                  {docMatches.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 py-1 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-900" />
                        <span>Documents ({docMatches.length})</span>
                      </div>
                      <div className="space-y-1">
                        {docMatches.map((d, i) => {
                          const flatIdx = caseMatches.length + i;
                          const isSelected = selectedIndex === flatIdx;
                          return (
                            <button
                              key={d.id}
                              onClick={() => handleSelectSuggestion({ type: 'doc', item: d })}
                              className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between gap-3 cursor-pointer ${
                                isSelected ? 'bg-blue-900 text-white shadow-xs' : 'hover:bg-slate-100 text-slate-900'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-base">📄</span>
                                <div className="min-w-0">
                                  <div className="text-xs sm:text-sm font-bold truncate">
                                    {d.name}
                                  </div>
                                  <div className={`text-[10px] truncate ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                                    {d.docType} • Case {d.caseId} • v{d.version}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                                🟢 Verified
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Officers Section */}
                  {officerMatches.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 py-1 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-900" />
                        <span>Officers ({officerMatches.length})</span>
                      </div>
                      <div className="space-y-1">
                        {officerMatches.map((o, i) => {
                          const flatIdx = caseMatches.length + docMatches.length + i;
                          const isSelected = selectedIndex === flatIdx;
                          return (
                            <button
                              key={o}
                              onClick={() => handleSelectSuggestion({ type: 'officer', item: o })}
                              className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between gap-3 cursor-pointer ${
                                isSelected ? 'bg-blue-900 text-white shadow-xs' : 'hover:bg-slate-100 text-slate-900'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="text-base">👮</span>
                                <div>
                                  <div className="text-xs sm:text-sm font-bold">{o}</div>
                                  <div className={`text-[10px] ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                                    Search all dossiers assigned to {o}
                                  </div>
                                </div>
                              </div>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Bottom Action: View All Results */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between px-2">
                <button
                  onClick={() => handleTriggerFullSearch(query)}
                  className="text-xs font-bold text-blue-900 hover:underline flex items-center gap-1.5 py-1"
                >
                  <span>View all results for "{query}" →</span>
                </button>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">Press Enter ↵</span>
              </div>
            </div>
          ) : (
            /* --- B. WHEN INPUT IS EMPTY / FOCUSED (Requirements 5 & 6) --- */
            <div className="p-4 space-y-4">
              
              {/* Quick 1-Click Filter Pills (Requirement 6) */}
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Quick Search Filters</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {quickFilterPills.map((pill) => (
                    <button
                      key={pill.label}
                      onClick={() => handleTriggerFullSearch(pill.query)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-900 text-slate-700 text-xs font-bold transition cursor-pointer active:scale-95 border border-slate-200"
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Searches (Requirement 5) */}
              {recentSearches.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Recent Searches</span>
                    </div>
                    <button
                      onClick={handleClearRecentSearches}
                      className="text-[10px] text-slate-400 hover:text-red-600 flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear Recent</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        onClick={() => handleTriggerFullSearch(term)}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 group-hover:text-blue-900">🔎</span>
                          <span className="font-semibold text-slate-800">{term}</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}

    </div>
  );
};
