import React, { useState, useRef, useEffect } from 'react'
import {
  X, BookOpen, Scissors, Sparkles, Sliders, Check,
  RotateCw, ArrowLeftRight, Layers, SunMedium
} from 'lucide-react'
import { triggerHaptic } from '../utils/haptics'

export default function BookSplitterModal({
  isOpen,
  onClose,
  initialImageUrl = null,
  onAddSplitPages,
}) {
  const [sourceImage, setSourceImage] = useState(initialImageUrl)
  const [splitPercent, setSplitPercent] = useState(50) // 50% = center split
  const [flattenSpine, setFlattenSpine] = useState(true)
  const [enhanceContrast, setEnhanceContrast] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 })

  const canvasRef = useRef(null)
  const imageObjRef = useRef(null)

  useEffect(() => {
    if (initialImageUrl) {
      setSourceImage(initialImageUrl)
    }
  }, [initialImageUrl])

  useEffect(() => {
    if (!sourceImage) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageObjRef.current = img
      setImgDimensions({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.src = sourceImage
  }, [sourceImage])

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      setSourceImage(evt.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSplitAndAdd = async () => {
    if (!imageObjRef.current) return
    setIsProcessing(true)
    triggerHaptic('medium')

    try {
      const img = imageObjRef.current
      const W = img.naturalWidth
      const H = img.naturalHeight
      const splitX = Math.round((W * splitPercent) / 100)

      // 1. Process Left Page
      const leftCanvas = document.createElement('canvas')
      leftCanvas.width = splitX
      leftCanvas.height = H
      const leftCtx = leftCanvas.getContext('2d')
      leftCtx.drawImage(img, 0, 0, splitX, H, 0, 0, splitX, H)

      // Flatten spine shadow on right edge of left page
      if (flattenSpine) {
        applySpineLightening(leftCtx, splitX, H, 'right')
      }
      if (enhanceContrast) {
        applyContrastEnhancement(leftCtx, splitX, H)
      }
      const leftDataUrl = leftCanvas.toDataURL('image/jpeg', 0.92)

      // 2. Process Right Page
      const rightCanvas = document.createElement('canvas')
      const rightW = W - splitX
      rightCanvas.width = rightW
      rightCanvas.height = H
      const rightCtx = rightCanvas.getContext('2d')
      rightCtx.drawImage(img, splitX, 0, rightW, H, 0, 0, rightW, H)

      // Flatten spine shadow on left edge of right page
      if (flattenSpine) {
        applySpineLightening(rightCtx, rightW, H, 'left')
      }
      if (enhanceContrast) {
        applyContrastEnhancement(rightCtx, rightW, H)
      }
      const rightDataUrl = rightCanvas.toDataURL('image/jpeg', 0.92)

      triggerHaptic('success')
      onAddSplitPages([
        {
          dataUrl: leftDataUrl,
          name: `Book_Page_Left_${Date.now()}.jpg`,
        },
        {
          dataUrl: rightDataUrl,
          name: `Book_Page_Right_${Date.now()}.jpg`,
        },
      ])
      onClose()
    } catch (err) {
      alert('Error splitting book pages: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Lightens spine crease edge shadow
  const applySpineLightening = (ctx, w, h, edge) => {
    const spineBandWidth = Math.min(w * 0.15, 120)
    const grad = ctx.createLinearGradient(
      edge === 'right' ? w - spineBandWidth : 0,
      0,
      edge === 'right' ? w : spineBandWidth,
      0
    )
    if (edge === 'right') {
      grad.addColorStop(0, 'rgba(255, 255, 255, 0)')
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.35)')
    } else {
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.35)')
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    }
    ctx.fillStyle = grad
    ctx.fillRect(edge === 'right' ? w - spineBandWidth : 0, 0, spineBandWidth, h)
  }

  // Improves text crispness
  const applyContrastEnhancement = (ctx, w, h) => {
    const imgData = ctx.getImageData(0, 0, w, h)
    const d = imgData.data
    for (let i = 0; i < d.length; i += 4) {
      // Contrast stretch
      const r = d[i]
      const g = d[i + 1]
      const b = d[i + 2]
      const gray = 0.299 * r + 0.587 * g + 0.114 * b
      const factor = 1.15
      const adjusted = Math.min(255, Math.max(0, factor * (gray - 128) + 128))
      // Blend 30% toward higher contrast
      d[i] = r * 0.7 + adjusted * 0.3
      d[i + 1] = g * 0.7 + adjusted * 0.3
      d[i + 2] = b * 0.7 + adjusted * 0.3
    }
    ctx.putImageData(imgData, 0, 0)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <BookOpen size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Book Dual-Page Splitter
                </h3>
                <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                  Spine Flatten
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Split open textbook photos into two upright pages &amp; remove spine shadows
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {!sourceImage ? (
            <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <BookOpen size={36} className="mx-auto text-amber-500 mb-3" />
              <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-1">
                Select an Open Book Photo
              </h4>
              <p className="text-xs text-slate-400 mb-4 max-w-sm mx-auto">
                Upload or capture an open 2-page book, textbook, or notebook spread to automatically split it.
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all">
                <span>Upload Book Spread</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          ) : (
            <>
              {/* Interactive Split Viewfinder */}
              <div className="relative aspect-[16/10] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center select-none shadow-inner">
                <img
                  src={sourceImage}
                  alt="Book Spread"
                  className="w-full h-full object-contain"
                />

                {/* Left Page Tag */}
                <div
                  className="absolute top-3 bg-sky-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-md backdrop-blur-xs shadow-xs"
                  style={{ left: `${Math.max(4, splitPercent / 2 - 10)}%` }}
                >
                  Page 1 (Left)
                </div>

                {/* Right Page Tag */}
                <div
                  className="absolute top-3 bg-indigo-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-md backdrop-blur-xs shadow-xs"
                  style={{ left: `${Math.min(80, splitPercent + (100 - splitPercent) / 2 - 10)}%` }}
                >
                  Page 2 (Right)
                </div>

                {/* Vertical Spine Divider Line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)] cursor-ew-resize flex items-center justify-center"
                  style={{ left: `${splitPercent}%` }}
                >
                  <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-lg border border-white">
                    <ArrowLeftRight size={12} />
                  </div>
                </div>
              </div>

              {/* Slider for Adjusting Spine Line */}
              <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Center Spine Position</span>
                  <span className="text-amber-600 dark:text-amber-400">{splitPercent}% (Split Line)</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="80"
                  value={splitPercent}
                  onChange={(e) => {
                    setSplitPercent(Number(e.target.value))
                    triggerHaptic('selection')
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Left Wider (20%)</span>
                  <span>Center (50%)</span>
                  <span>Right Wider (80%)</span>
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={flattenSpine}
                    onChange={(e) => setFlattenSpine(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                      Flatten Spine Shadow
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Brightens central curvature shadow
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enhanceContrast}
                    onChange={(e) => setEnhanceContrast(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                      Enhance Text Sharpness
                    </span>
                    <span className="text-[10px] text-slate-400">
                      High-clarity print enhancement
                    </span>
                  </div>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          {sourceImage && (
            <label className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer underline">
              Change Image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSplitAndAdd}
              disabled={!sourceImage || isProcessing}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isProcessing ? 'Processing Split...' : 'Split & Add 2 Pages to Scanner'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
