import React, { useState } from 'react'
import {
  X, FileDown, Share2, Archive, Check, Sparkles, Layers,
  ShieldCheck, Sliders, Hash, Settings2, FileText, CheckCircle2,
  ChevronRight, HardDrive, Smartphone, Send
} from 'lucide-react'
import { triggerHaptic } from '../utils/haptics'

export function ExportModal({
  isOpen,
  onClose,
  queue = [],
  pdfFilename,
  setPdfFilename,
  pdfPageSize,
  setPdfPageSize,
  addPageNumbers,
  setAddPageNumbers,
  onExportPdf,
  onSharePdf,
  onExportZip,
  isExporting = false,
  exportProgress = null,
  pdfPageSizes = {},
  formatBytes = (b) => `${b} B`
}) {
  const [qualityPreset, setQualityPreset] = useState('balanced') // lossless, balanced, compact
  const [includeSearchableText, setIncludeSearchableText] = useState(true)

  if (!isOpen) return null

  const pageCount = queue.length
  const totalOriginalSize = queue.reduce((acc, p) => acc + (p.originalSize || 0), 0)

  const handleShare = () => {
    triggerHaptic('medium')
    onSharePdf({ qualityPreset, includeSearchableText })
  }

  const handleSave = () => {
    triggerHaptic('success')
    onExportPdf({ qualityPreset, includeSearchableText })
  }

  const handleZip = () => {
    triggerHaptic('light')
    onExportZip({ qualityPreset })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200/60 dark:border-sky-800">
              <FileDown size={19} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Export Document
              </h3>
              <p className="text-[11px] text-slate-400">
                {pageCount} page{pageCount !== 1 ? 's' : ''} ready · Total ~{formatBytes(totalOriginalSize)}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic('light')
              onClose()
            }}
            disabled={isExporting}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* File Name Field */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              Document Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={pdfFilename}
                onChange={(e) => setPdfFilename(e.target.value)}
                placeholder="Document-Name"
                className="w-full text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white dark:focus:bg-slate-900 transition-all pr-12"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                .pdf
              </span>
            </div>
          </div>

          {/* Quality Presets (3 Segmented Cards) */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
              Optimization Quality
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection')
                  setQualityPreset('balanced')
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  qualityPreset === 'balanced'
                    ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/50 ring-1 ring-sky-500 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                    Recommended
                  </span>
                  {qualityPreset === 'balanced' && <Check size={13} className="text-sky-600" />}
                </div>
                <div className="font-bold text-xs text-slate-800 dark:text-slate-100">Standard HD</div>
                <p className="text-[10px] text-slate-400 mt-0.5">Balanced &amp; clean</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection')
                  setQualityPreset('compact')
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  qualityPreset === 'compact'
                    ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/50 ring-1 ring-sky-500 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    WhatsApp
                  </span>
                  {qualityPreset === 'compact' && <Check size={13} className="text-sky-600" />}
                </div>
                <div className="font-bold text-xs text-slate-800 dark:text-slate-100">Compact Size</div>
                <p className="text-[10px] text-slate-400 mt-0.5">Small &amp; fast</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection')
                  setQualityPreset('lossless')
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  qualityPreset === 'lossless'
                    ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/50 ring-1 ring-sky-500 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Print Ready
                  </span>
                  {qualityPreset === 'lossless' && <Check size={13} className="text-sky-600" />}
                </div>
                <div className="font-bold text-xs text-slate-800 dark:text-slate-100">Maximum</div>
                <p className="text-[10px] text-slate-400 mt-0.5">Original pixels</p>
              </button>
            </div>
          </div>

          {/* Page Layout & Numbering */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Page Size
              </label>
              <select
                value={pdfPageSize}
                onChange={(e) => {
                  triggerHaptic('selection')
                  setPdfPageSize(e.target.value)
                }}
                className="w-full text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
              >
                {Object.entries(pdfPageSizes).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Page Numbers
              </label>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection')
                  setAddPageNumbers(!addPageNumbers)
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  addPageNumbers
                    ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Hash size={13} /> Bottom Center
                </span>
                <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] ${
                  addPageNumbers ? 'bg-sky-600 text-white' : 'border border-slate-300 dark:border-slate-600'
                }`}>
                  {addPageNumbers && <Check size={11} strokeWidth={3} />}
                </span>
              </button>
            </div>
          </div>

          {/* Searchable PDF (PDF/A Text Layer) Toggle */}
          <div
            onClick={() => {
              triggerHaptic('selection')
              setIncludeSearchableText(!includeSearchableText)
            }}
            className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 cursor-pointer hover:border-sky-300 transition-all select-none"
          >
            <div className={`mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center text-white shrink-0 transition-colors ${
              includeSearchableText ? 'bg-sky-600' : 'border border-slate-300 dark:border-slate-600'
            }`}>
              {includeSearchableText && <Check size={13} strokeWidth={3} />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Searchable PDF (PDF/A Text Layer)
                </span>
                <span className="text-[9px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-1.5 py-0.2 rounded-md">
                  Selectable
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Embeds invisible OCR text so Google Drive, Adobe Reader, and search engines can highlight and copy text.
              </p>
            </div>
          </div>

          {/* Export Progress Bar (if in progress) */}
          {exportProgress && (
            <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800">
              <div className="flex items-center justify-between text-xs font-semibold text-sky-900 dark:text-sky-200 mb-1.5">
                <span>Exporting page {exportProgress.current} of {exportProgress.total}...</span>
                <span>{Math.round((exportProgress.current / exportProgress.total) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-sky-200 dark:bg-sky-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-600 to-indigo-600 transition-all duration-200"
                  style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-2.5">
          <div className="grid grid-cols-2 gap-3">
            {/* Share to WhatsApp / Apps */}
            <button
              type="button"
              onClick={handleShare}
              disabled={isExporting}
              className="py-3 px-4 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <Share2 size={16} className="text-emerald-500" />
              <span>Share to Apps</span>
            </button>

            {/* Save PDF */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isExporting}
              className="py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <FileDown size={16} />
              <span>{isExporting ? 'Exporting...' : 'Save PDF'}</span>
            </button>
          </div>

          {/* Quick ZIP fallback */}
          <button
            type="button"
            onClick={handleZip}
            disabled={isExporting}
            className="w-full py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Archive size={13} />
            <span>Or download separate images as ZIP archive</span>
          </button>
        </div>
      </div>
    </div>
  )
}
