import React, { useState } from 'react'
import {
  UploadCloud, BookOpen, PenTool, Wrench, Smartphone,
  Scissors, CreditCard, LayoutGrid, QrCode, X, ChevronUp
} from 'lucide-react'
import { triggerHaptic } from '../utils/haptics'

export function MobileBottomNav({
  activeTab = 'scan',
  onOpenScan,
  onOpenDocViewer,
  onOpenSignature,
  onOpenMergeSplit,
  onOpenIDCard,
  onOpenCollage,
  onOpenQRScanner,
  onOpenInstallModal,
  queueCount = 0,
}) {
  const [toolsOpen, setToolsOpen] = useState(false)

  return (
    <>
      {/* Tools Quick Action Sheet for Mobile */}
      {toolsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center lg:hidden"
          onClick={() => {
            triggerHaptic('light')
            setToolsOpen(false)
          }}
        >
          <div
            className="w-full bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 p-5 pb-8 space-y-4 animate-slide-in shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto" />
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Document Tools &amp; Utilities
              </h3>
              <button
                onClick={() => {
                  triggerHaptic('light')
                  setToolsOpen(false)
                }}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  triggerHaptic('medium')
                  setToolsOpen(false)
                  onOpenMergeSplit()
                }}
                className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 text-left flex items-center gap-3 active:scale-98 transition-all"
              >
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white shrink-0">
                  <Scissors size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">Merge &amp; Split</h4>
                  <p className="text-[10px] text-slate-400">Combine or split PDFs</p>
                </div>
              </button>

              <button
                onClick={() => {
                  triggerHaptic('medium')
                  setToolsOpen(false)
                  onOpenIDCard()
                }}
                className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/80 text-left flex items-center gap-3 active:scale-98 transition-all"
              >
                <div className="p-2.5 rounded-xl bg-purple-600 text-white shrink-0">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">ID Card Scan</h4>
                  <p className="text-[10px] text-slate-400">Front + Back on 1 page</p>
                </div>
              </button>

              <button
                onClick={() => {
                  triggerHaptic('medium')
                  setToolsOpen(false)
                  onOpenCollage()
                }}
                className="p-3.5 rounded-2xl bg-cyan-50/60 dark:bg-cyan-950/40 border border-cyan-200/80 dark:border-cyan-800/80 text-left flex items-center gap-3 active:scale-98 transition-all"
              >
                <div className="p-2.5 rounded-xl bg-cyan-600 text-white shrink-0">
                  <LayoutGrid size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">Collage Grid</h4>
                  <p className="text-[10px] text-slate-400">2, 4, 6 handouts</p>
                </div>
              </button>

              <button
                onClick={() => {
                  triggerHaptic('medium')
                  setToolsOpen(false)
                  onOpenQRScanner()
                }}
                className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 text-left flex items-center gap-3 active:scale-98 transition-all"
              >
                <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0">
                  <QrCode size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">QR &amp; Barcode</h4>
                  <p className="text-[10px] text-slate-400">Direct notes extract</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-1.5 shadow-lg flex items-center justify-around">
        {/* 1. Scan / Home */}
        <button
          onClick={() => {
            triggerHaptic('light')
            onOpenScan?.()
          }}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'scan'
              ? 'text-sky-600 dark:text-sky-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <UploadCloud size={19} />
            {queueCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-sky-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {queueCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold">Scanner</span>
        </button>

        {/* 2. Study Reader */}
        <button
          onClick={() => {
            triggerHaptic('light')
            onOpenDocViewer()
          }}
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 cursor-pointer"
        >
          <BookOpen size={19} />
          <span className="text-[10px] font-bold">Study</span>
        </button>

        {/* 3. E-Sign Studio */}
        <button
          onClick={() => {
            triggerHaptic('light')
            onOpenSignature()
          }}
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 cursor-pointer"
        >
          <PenTool size={19} />
          <span className="text-[10px] font-bold">E-Sign</span>
        </button>

        {/* 4. Tools Menu */}
        <button
          onClick={() => {
            triggerHaptic('light')
            setToolsOpen(true)
          }}
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 cursor-pointer"
        >
          <Wrench size={19} />
          <span className="text-[10px] font-bold">Tools</span>
        </button>

        {/* 5. Install App */}
        <button
          onClick={() => {
            triggerHaptic('light')
            onOpenInstallModal()
          }}
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 cursor-pointer"
        >
          <Smartphone size={19} />
          <span className="text-[10px] font-bold">App</span>
        </button>
      </nav>
    </>
  )
}
