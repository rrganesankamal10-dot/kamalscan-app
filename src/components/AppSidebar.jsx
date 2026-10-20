import React from 'react'
import {
  FileText, UploadCloud, Camera, BookOpen, Scissors, CreditCard, LayoutGrid,
  PenTool, QrCode, Sparkles, Wand2, Stamp, RotateCw, Crop, ShieldCheck,
  Moon, Sun, Smartphone, Monitor, Download, ChevronLeft, ChevronRight, X,
  Layers, CheckCircle2, Info, Folder
} from 'lucide-react'

export function AppSidebar({
  isOpen,
  onToggle,
  onCloseMobile,
  viewMode,
  onToggleViewMode,
  darkMode,
  onToggleDarkMode,
  onOpenDocViewer,
  onOpenMergeSplit,
  onOpenIDCard,
  onOpenCollage,
  onOpenSignature,
  onOpenQRScanner,
  onOpenInstallModal,
  onOpenSectionScan,
  onOpenVault,
  onOpenBookSplitter,
  queueCount = 0,
}) {
  const navItems = [
    {
      id: 'scanner',
      label: 'Scanner & Studio',
      sub: 'Upload, Camera & Crop',
      icon: <UploadCloud size={18} className="text-sky-500" />,
      badge: queueCount > 0 ? `${queueCount} pages` : null,
      badgeColor: 'bg-sky-500 text-white',
      active: true,
      onClick: () => {
        if (window.innerWidth < 1024) onCloseMobile()
      },
    },
    {
      id: 'section_scan',
      label: 'Section & Auto-Crop',
      sub: 'AI Notes Edge Detector',
      icon: <Scissors size={18} className="text-emerald-500" />,
      badge: 'AI Model',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700',
      onClick: () => {
        if (onOpenSectionScan) onOpenSectionScan()
        if (window.innerWidth < 1024) onCloseMobile()
      },
    },
    {
      id: 'viewer',
      label: 'Study & Doc Viewer',
      sub: 'PDF, Word, PPTX, Notes',
      icon: <BookOpen size={18} className="text-amber-500" />,
      badge: 'TTS & Search',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700',
      onClick: () => {
        onOpenDocViewer()
        if (window.innerWidth < 1024) onCloseMobile()
      },
    },
    {
      id: 'vault',
      label: 'Offline Document Vault',
      sub: 'Organized Folders & Tags',
      icon: <Folder size={18} className="text-emerald-500" />,
      badge: '100% Offline',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700',
      onClick: () => {
        if (onOpenVault) onOpenVault()
        if (window.innerWidth < 1024) onCloseMobile()
      },
    },
    {
      id: 'book_split',
      label: 'Book Dual-Page Splitter',
      sub: 'Flatten Spine & Split 2-Page',
      icon: <BookOpen size={18} className="text-amber-500" />,
      badge: 'Spine Fix',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700',
      onClick: () => {
        if (onOpenBookSplitter) onOpenBookSplitter()
        if (window.innerWidth < 1024) onCloseMobile()
      },
    },
    {
      id: 'merge_split',
      label: 'PDF Merge & Split',
      sub: 'Lossless Vector Tools',
      icon: <Scissors size={18} className="text-indigo-500" />,
      badge: 'Lossless',
      badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700',
      onClick: () => {
        onOpenMergeSplit()
        if (window.innerWidth < 1024) onCloseMobile()
      },
    },
    {
      id: 'id_card',
      label: 'ID Card Dual-Side',
      sub: 'Front + Back on 1 Page',
      icon: <CreditCard size={18} className="text-purple-500" />,
      onClick: () => {
        onOpenIDCard()
        if (window.innerWidth < 1024) onCloseMobile()
      },
    },
    {
      id: 'collage',
      label: 'Document Collage',
      sub: '2-in-1 • 4-in-1 • 6-in-1',
      icon: <LayoutGrid size={18} className="text-cyan-500" />,
      onClick: () => {
        onOpenCollage()
        if (window.innerWidth < 1024) onCloseMobile()
      },
    },
    {
      id: 'signature',
      label: 'Digital E-Signature',
      sub: 'Draw, Type & Stamp',
      icon: <PenTool size={18} className="text-rose-500" />,
      onClick: () => {
        onOpenSignature()
        if (window.innerWidth < 1024) onCloseMobile()
      },
    },
    {
      id: 'qr',
      label: 'QR & Barcode',
      sub: 'Scan Directly to Notes',
      icon: <QrCode size={18} className="text-emerald-500" />,
      onClick: () => {
        onOpenQRScanner()
        if (window.innerWidth < 1024) onCloseMobile()
      },
    },
  ]

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-72 bg-white dark:bg-slate-900 border-r border-slate-200/90 dark:border-slate-800 flex flex-col justify-between transition-transform duration-300 ease-in-out shadow-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top: Logo & Close button */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 p-1.5 flex items-center justify-center shadow-lg shadow-sky-500/10 border border-slate-200/80 dark:border-slate-800 shrink-0">
              <img src="/favicon.svg" alt="KamalScan" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight">
                  KamalScan
                </h1>
                <span className="text-[10px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-1.5 py-0.2 rounded-md">
                  AI v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Document Studio &amp; Viewer</p>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Center: Tools Navigation */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-2">
            Workspace Tools
          </p>

          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`w-full p-2.5 rounded-2xl text-left transition-all flex items-center justify-between group cursor-pointer ${
                item.active
                  ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-900 dark:text-sky-200 border border-sky-200/70 dark:border-sky-800/80 shadow-xs'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs truncate">{item.label}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{item.sub}</p>
                </div>
              </div>

              {item.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Bottom: Settings, Install & Offline Badge */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5 flex-shrink-0 bg-slate-50/60 dark:bg-slate-900/60">
          {/* Install App button */}
          <button
            onClick={() => {
              onOpenInstallModal()
              if (window.innerWidth < 1024) onCloseMobile()
            }}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 cursor-pointer"
          >
            <Download size={14} /> Install App (APK &amp; PWA)
          </button>

                    {/* Quick Toggles: Layout & Theme */}
          <div className="flex items-center justify-between gap-2 pt-1">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700 flex-1">
              <button
                onClick={() => onToggleViewMode('mobile')}
                className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  viewMode === 'mobile'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Phone Layout"
              >
                <Smartphone size={12} /> Mobile
              </button>
              <button
                onClick={() => onToggleViewMode('desktop')}
                className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  viewMode === 'desktop'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Desktop Layout"
              >
                <Monitor size={12} /> Desktop
              </button>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={onToggleDarkMode}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors shrink-0"
              title={darkMode ? 'Switch to Light' : 'Switch to Dark'}
            >
              {darkMode ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-slate-600" />}
            </button>
          </div>

          {/* Offline Security badge */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 py-1.5 px-3 rounded-xl border border-emerald-200/70 dark:border-emerald-800/60">
            <ShieldCheck size={13} />
            <span>100% Client-Side Offline Vault</span>
          </div>
        </div>
      </aside>
    </>
  )
}
