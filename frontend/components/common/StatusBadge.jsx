import React from 'react';

export const CaseStatusBadge = ({ status }) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          🟢 Active
        </span>
      );
    case 'investigation':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          🟡 Investigation
        </span>
      );
    case 'under review':
    case 'review':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          🔵 Under Review
        </span>
      );
    case 'closed':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-slate-600"></span>
          ⚫ Closed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-300">
          {status || 'Unknown'}
        </span>
      );
  }
};

export const ClassificationBadge = ({ classification }) => {
  switch (classification?.toLowerCase()) {
    case 'highly confidential':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300">
          🔒 Highly Confidential
        </span>
      );
    case 'confidential':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
          🛡️ Confidential
        </span>
      );
    case 'internal':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          📄 Internal Use
        </span>
      );
  }
};

export const IntegrityBadge = ({ isVerified, isTampered }) => {
  if (isTampered || isVerified === false) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-400 animate-pulse shadow-xs">
        <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
        🔴 Check Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
      🟢 Integrity Verified
    </span>
  );
};
