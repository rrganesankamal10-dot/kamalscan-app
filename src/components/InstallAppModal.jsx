import React from 'react'
import { Smartphone, Download, Globe, CheckCircle2, ShieldCheck, X, ExternalLink, Sparkles } from 'lucide-react'

export function InstallAppModal({ isOpen, onClose, onInstallPwa, canInstallPwa }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="relative px-6 py-5 bg-linear-to-r from-sky-600 to-indigo-600 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-xs">
              <Smartphone size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Install KamalScan (All-In-One)</h3>
              <p className="text-xs text-sky-100 mt-0.5">
                Scanner + PDF / PPT / Word Document Viewer
              </p>
            </div>
          </div>
        </div>

        {/* Body Options */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Choose how you'd like to use KamalScan on your device. Both provide 100% offline security with zero server uploads:
          </p>

          {/* Option 1: Native Android APK */}
          <div className="p-4 rounded-2xl border-2 border-sky-500/30 bg-sky-50/50 dark:bg-sky-950/20 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-600 text-white">
                  <Smartphone size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    Native Android App (APK)
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-sky-600 text-white">
                      Recommended
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    For full Android phone integration
                  </p>
                </div>
              </div>
            </div>

            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pl-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-sky-600 shrink-0" />
                <span>Pops up in <strong>"Open With"</strong> when tapping PDFs/PPTs in WhatsApp or Drive</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-sky-600 shrink-0" />
                <span>Works 100% offline anytime, anywhere</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-sky-600 shrink-0" />
                <span>Camera auto-edge detection & digital signatures</span>
              </li>
            </ul>

            <div className="pt-1 flex flex-col sm:flex-row gap-2">
              <a
                href="https://github.com/rrganesankamal10-dot/kamalscan-app/actions"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs bg-sky-600 hover:bg-sky-700 text-white transition-all shadow-md active:scale-98"
              >
                <Download size={15} /> Download Latest APK
                <ExternalLink size={12} className="opacity-70" />
              </a>
            </div>
          </div>

          {/* Option 2: Web App (PWA) */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-slate-700 text-white">
                <Globe size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Instant Web App (PWA)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  For Laptop, iPhone, iPad, or Android browser
                </p>
              </div>
            </div>

            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pl-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>Installs instantly without downloading files</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>Works on Mac, Windows, ChromeOS, and iOS</span>
              </li>
            </ul>

            <button
              onClick={onInstallPwa}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition-all active:scale-98"
            >
              <Sparkles size={14} className="text-amber-500" />
              {canInstallPwa ? 'Add to Home Screen / Desktop' : 'Install Instructions (Browser Menu)'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-100/70 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-600" />
            100% Client-Side Privacy Guaranteed
          </span>
          <button
            onClick={onClose}
            className="font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
