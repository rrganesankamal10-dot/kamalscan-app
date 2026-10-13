import { useState } from 'react'
import {
  Wand2, Stamp, Crop, RotateCw, Sparkles, Layers,
  Trash2, FileSearch, Loader2, CreditCard, QrCode
} from 'lucide-react'
import { ENHANCE_MODES } from '../utils/imageFilters'

export function BatchToolbar({
  pageCount,
  onApplyFilterToAll,
  onOpenWatermarkAll,
  onAutoCropAll,
  isAutoCroppingAll,
  onRotateAll,
  onRunBatchOcr,
  isBatchOcrRunning,
  onOpenIDCardMode,
  onOpenQRScanner,
  onClearAll,
}) {
  const [selectedFilter, setSelectedFilter] = useState('magic')

  const filterShortcuts = [
    { id: 'magic', label: 'Magic Color HD', color: 'from-sky-500 to-cyan-500' },
    { id: 'super', label: 'Super HD', color: 'from-blue-600 to-indigo-600' },
    { id: 'doc_bw', label: 'Clean B&W', color: 'from-slate-700 to-slate-900' },
    { id: 'grayscale', label: 'Grayscale', color: 'from-gray-500 to-slate-600' },
    { id: 'none', label: 'Original', color: 'from-slate-400 to-slate-500' },
  ]

  const handleApplyFilter = (modeId) => {
    setSelectedFilter(modeId)
    onApplyFilterToAll(modeId)
  }

  return (
    <div className="bg-gradient-to-r from-sky-500/10 via-cyan-500/10 to-indigo-500/10 dark:from-sky-950/40 dark:via-cyan-950/40 dark:to-indigo-950/40 border border-sky-200/80 dark:border-sky-800/80 rounded-2xl p-4 shadow-sm space-y-3.5 mb-6">
      {/* Top row: Label & quick actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-sky-600 text-white shadow-xs">
            <Layers size={16} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              Apply to All Pages
              <span className="text-[11px] font-semibold bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full">
                {pageCount} loaded
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              One-click batch enhancement, watermarking, and offline AI auto-crop
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onAutoCropAll}
            disabled={isAutoCroppingAll}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900 text-sky-700 dark:text-sky-300 font-semibold text-xs border border-sky-200 dark:border-sky-700 flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
            title="Automatically detect borders and crop every page"
          >
            {isAutoCroppingAll ? <Loader2 size={13} className="animate-spin" /> : <Crop size={13} />}
            {isAutoCroppingAll ? 'Cropping...' : 'AI Auto-Crop All'}
          </button>

          <button
            onClick={onOpenWatermarkAll}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200 dark:border-indigo-700 flex items-center gap-1.5 transition-all shadow-xs"
          >
            <Stamp size={13} /> Watermark All
          </button>

          <button
            onClick={onRotateAll}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-all shadow-xs"
          >
            <RotateCw size={13} /> Rotate All 90°
          </button>

          <button
            onClick={onOpenIDCardMode}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 font-semibold text-xs border border-purple-200 dark:border-purple-700 flex items-center gap-1.5 transition-all shadow-xs"
            title="Scan both sides of an ID card onto 1 page"
          >
            <CreditCard size={13} /> ID Card Mode
          </button>

          <button
            onClick={onOpenQRScanner}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-900 text-cyan-700 dark:text-cyan-300 font-semibold text-xs border border-cyan-200 dark:border-cyan-700 flex items-center gap-1.5 transition-all shadow-xs"
            title="Scan QR codes and barcodes"
          >
            <QrCode size={13} /> QR / Barcode
          </button>

          <button
            onClick={onRunBatchOcr}
            disabled={isBatchOcrRunning}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-semibold text-xs border border-emerald-200 dark:border-emerald-700 flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
          >
            {isBatchOcrRunning ? <Loader2 size={13} className="animate-spin" /> : <FileSearch size={13} />}
            {isBatchOcrRunning ? 'Scanning...' : 'Batch OCR'}
          </button>

          <button
            onClick={onClearAll}
            className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            title="Clear all pages"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Filter bar: Apply Color Filters To All */}
      <div className="pt-2 border-t border-sky-100 dark:border-sky-900/60 flex items-center gap-2 overflow-x-auto text-xs pb-1">
        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
          <Sparkles size={12} className="text-sky-500" /> Apply Filter to All:
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterShortcuts.map((f) => (
            <button
              key={f.id}
              onClick={() => handleApplyFilter(f.id)}
              className="px-3 py-1 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 shadow-xs flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
            >
              <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${f.color}`} />
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
