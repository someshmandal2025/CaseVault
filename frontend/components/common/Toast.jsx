import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Toast = () => {
  const { toast } = useApp();

  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';
  const isWarning = toast.type === 'warning';

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className={`flex items-start gap-3 p-4 rounded-xl shadow-xl border ${
        isSuccess ? 'bg-emerald-900 text-white border-emerald-700' :
        isError ? 'bg-red-900 text-white border-red-700' :
        isWarning ? 'bg-amber-900 text-white border-amber-700' :
        'bg-slate-900 text-white border-slate-700'
      }`}>
        <div className="shrink-0 mt-0.5">
          {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {isError && <AlertCircle className="w-5 h-5 text-red-400" />}
          {isWarning && <AlertCircle className="w-5 h-5 text-amber-400" />}
          {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-blue-400" />}
        </div>
        <div className="flex-1 text-sm font-medium pr-2">
          {toast.message}
        </div>
      </div>
    </div>
  );
};
