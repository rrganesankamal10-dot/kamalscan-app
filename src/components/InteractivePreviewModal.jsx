import { useState, useEffect } from 'react'
import {
  X, ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight, RotateCw, Crop,
  Stamp, PenTool, Download, ScanText, Copy, Trash2, Wand2, Check, Sparkles
} from 'lucide-react'
import { ENHANCE_MODES } from '../utils/imageFilters'

export function InteractivePreviewModal({
  item,
  allPages,
  onClose,
  onSelectPage,
  onRotate,
  onOpenCrop,
  onOpenWatermark,
  onOpenSignature,
  onRunOcr,
  onUpdateEnhanceMode,
  onDownload,
  onDelete,
}) {
  const [zoom, setZoom] = useState(1)
  const currentIndex = allPages.findIndex((p) => p.id === item.id)

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onSelectPage(allPages[currentIndex - 1])
        setZoom(1)
      }
      if (e.key === 'ArrowRight' && currentIndex < allPages.length - 1) {
        onSelectPage(allPages[currentIndex + 1])
        setZoom(1)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [currentIndex, allPages, onClose, onSelectPage])

  const handleZoomIn = () => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))
  const handleResetZoom = () => setZoom(1)

  const activeFilter = item.enhanceMode || 'none'

  return (
    <div
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[96vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Top Header ─────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-sky-600 to-cyan-500 text-white shadow-xs flex-shrink-0">
              Page {currentIndex + 1} / {allPages.length}
            </span>
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
              {item.name}
            </h3>
          </div>

          {/* Zoom controls & Close */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="p-1.5 hover:text-sky-600 dark:hover:text-sky-400 disabled:opacity-40 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={15} />
              </button>
              <button
                onClick={handleResetZoom}
                className="px-2 text-[11px] font-semibold hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                title="Reset Zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="p-1.5 hover:text-sky-600 dark:hover:text-sky-400 disabled:opacity-40 transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={15} />
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title="Close Preview (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ─── Filter Pills Bar ───────────────────────────────────────── */}
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/60 flex items-center gap-2 overflow-x-auto flex-shrink-0 text-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
            <Wand2 size={12} className="text-sky-500" /> Filters:
          </span>
          {Object.entries(ENHANCE_MODES).map(([key, mode]) => (
            <button
              key={key}
              onClick={() => onUpdateEnhanceMode(item.id, key)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeFilter === key
                  ? 'bg-sky-600 text-white shadow-xs font-semibold'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-300'
              }`}
            >
              {mode.label}
              {activeFilter === key && <Check size={11} />}
            </button>
          ))}
        </div>

        {/* ─── Main Image Viewer ───────────────────────────────────────── */}
        <div className="relative flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 select-none min-h-[300px]">
          {/* Left / Right Arrow Overlay */}
          {currentIndex > 0 && (
            <button
              onClick={() => {
                onSelectPage(allPages[currentIndex - 1])
                setZoom(1)
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-sky-600 hover:text-white shadow-lg flex items-center justify-center transition-all hover:scale-110"
              title="Previous Page (←)"
            >
              <ChevronLeft size={22} />
            </button>
          )}

          {currentIndex < allPages.length - 1 && (
            <button
              onClick={() => {
                onSelectPage(allPages[currentIndex + 1])
                setZoom(1)
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-sky-600 hover:text-white shadow-lg flex items-center justify-center transition-all hover:scale-110"
              title="Next Page (→)"
            >
              <ChevronRight size={22} />
            </button>
          )}

          <div
            className="transition-transform duration-150 ease-out flex items-center justify-center"
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              src={item.previewUrl}
              alt={item.name}
              className="max-h-[58vh] max-w-full object-contain rounded-xl shadow-2xl transition-all duration-200"
              style={{ filter: ENHANCE_MODES[activeFilter]?.filter || 'none' }}
              draggable={false}
            />
          </div>
        </div>

        {/* ─── Thumbnail Page Strip ────────────────────────────────────── */}
        {allPages.length > 1 && (
          <div className="flex gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 overflow-x-auto flex-shrink-0">
            {allPages.map((p, i) => (
              <button
                key={p.id}
                onClick={() => {
                  onSelectPage(p)
                  setZoom(1)
                }}
                className={`relative flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                  p.id === item.id
                    ? 'border-sky-500 scale-105 shadow-md'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={p.previewUrl}
                  alt={p.name}
                  className="w-14 h-14 object-cover"
                  style={{ filter: ENHANCE_MODES[p.enhanceMode || 'none']?.filter }}
                />
                <span className="absolute bottom-0 inset-x-0 bg-slate-900/70 text-white text-[9px] text-center font-bold">
                  {i + 1}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ─── Bottom Actions Toolbar ─────────────────────────────────── */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap flex-shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => onRotate(item.id)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <RotateCw size={13} /> Rotate 90°
            </button>
            <button
              onClick={() => onOpenCrop(item.id)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900 text-sky-600 dark:text-sky-400 flex items-center gap-1.5 transition-colors"
            >
              <Crop size={13} /> Auto-Crop
            </button>
            <button
              onClick={() => onOpenWatermark(item.id)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 transition-colors"
            >
              <Stamp size={13} /> Watermark
            </button>
            <button
              onClick={() => onOpenSignature(item.id)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-700 dark:text-amber-400 flex items-center gap-1.5 transition-colors"
            >
              <PenTool size={13} /> E-Sign
            </button>
            <button
              onClick={() => onRunOcr(item.id)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 transition-colors"
            >
              <ScanText size={13} /> Extract Text
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onDelete(item.id)}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
              title="Delete Page"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={() => onDownload(item)}
              className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white shadow-sm flex items-center gap-1.5 transition-all hover:scale-[1.02]"
            >
              <Download size={13} /> Download Page
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
