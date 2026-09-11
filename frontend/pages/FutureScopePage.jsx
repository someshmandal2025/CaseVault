import React from 'react';
import { 
  Sparkles, 
  Cpu, 
  Link2, 
  Fingerprint, 
  Cloud, 
  ShieldCheck, 
  Network, 
  ScanText, 
  FileSignature,
  ArrowUpRight
} from 'lucide-react';

export const FutureScopePage = () => {
  const roadmapItems = [
    {
      title: 'Permissioned Enterprise Blockchain (Hyperledger / Polygon)',
      badge: 'Ledger Architecture',
      icon: Link2,
      description: 'Upgrade the current local SHA-256 integrity layer to a state-wide consortium blockchain spanning Police, Judiciary (eCourts), and Forensic Science Laboratories (SFSL).',
      status: 'Architected',
      color: 'border-blue-300 bg-blue-50/50'
    },
    {
      title: 'AI Automated Document Classification & OCR',
      badge: 'Machine Learning',
      icon: ScanText,
      description: 'Automatic optical character recognition (OCR) for handwritten Bengali & Hindi FIRs with automated section extraction and tagging against the Bharatiya Nyaya Sanhita (BNS).',
      status: 'Pilot Stage',
      color: 'border-purple-300 bg-purple-50/50'
    },
    {
      title: 'Aadhaar eSign & CCTNS 2.0 Interoperability',
      badge: 'Digital Identity',
      icon: FileSignature,
      description: 'Statutory digital signatures for Investigating Officers via Aadhaar OTP eSign, seamless bi-directional integration with the Crime and Criminal Tracking Network & Systems (CCTNS).',
      status: 'Standard Ready',
      color: 'border-emerald-300 bg-emerald-50/50'
    },
    {
      title: 'ICJS (Inter-operable Criminal Justice System) Sync',
      badge: 'Judiciary Gateway',
      icon: Network,
      description: 'Direct tamper-proof transmission of charge sheets and evidence vouchers to Hon’ble High Courts and District Sessions Courts via national ICJS pipelines.',
      status: 'Roadmap',
      color: 'border-amber-300 bg-amber-50/50'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 p-6 sm:p-8 rounded-2xl text-white shadow-md border border-slate-800">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-amber-400 text-slate-950">
            TECHNICAL ROADMAP
          </span>
          <span className="text-xs text-slate-400">NCRB National Blueprint</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
          🔮 Future-Ready System Architecture
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1 leading-relaxed">
          CASEVAULT is built with clean modular abstractions, enabling seamless transition from prototype to enterprise state-wide deployment.
        </p>
      </div>

      {/* Roadmap Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {roadmapItems.map((item, idx) => {
          const Icon = item.icon;

          return (
            <div
              key={idx}
              className={`p-6 rounded-2xl border-2 shadow-xs transition hover:shadow-md ${item.color} flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white text-blue-900 border border-slate-200 flex items-center justify-center shadow-xs">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-900 text-white">
                    {item.status}
                  </span>
                </div>

                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                  {item.badge}
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1 mb-2">
                  {item.title}
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/80 flex items-center justify-between text-xs font-bold text-blue-900">
                <span>Phase {idx + 1} Enterprise Architecture</span>
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
