import React, { useState } from 'react'
import {
  X, LayoutGrid, Upload, Download, Check, Sparkles, AlertCircle, Loader2, ArrowRight
} from 'lucide-react'

export function CollageModal({ isOpen, onClose, queueItems = [], onApplyCollage }) {
  if (!isOpen) return null

  const [layout, setLayout] = useState('2_vert') // '2_vert' | '2_horiz' | '4_grid' | '6_grid'
  const [selectedImages, setSelectedImages] = useState(
    queueItems.slice(0, 4).map((item) => item.previewUrl)
  )
  const [spacing, setSpacing] = useState(20) // px padding between images
  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [generating, setGenerating] = useState(false)

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const urls = files.map((f) => URL.createObjectURL(f))
    setSelectedImages((prev) => [...prev, ...urls].slice(0, 6))
  }

  const removeImage = (idx) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleGenerate = async () => {
    if (selectedImages.length === 0) {
      alert('Please add at least 1 or 2 images to create a collage.')
      return
    }

    setGenerating(true)

    try {
      // Standard A4 at 300 DPI: 2480 x 3508
      const canvas = document.createElement('canvas')
      canvas.width = 2480
      canvas.height = 3508
      const ctx = canvas.getContext('2d')

      // Fill background
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Load all images as HTMLImageElements
      const loadedImgs = await Promise.all(
        selectedImages.map((src) => {
          return new Promise((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => resolve(img)
            img.onerror = reject
            img.src = src
          })
        })
      )

      const pad = spacing * 4 // scale for 300 DPI
      const margin = 100 // page margins

      if (layout === '2_vert') {
        // Two pages stacked vertically (Top & Bottom)
        const cellW = canvas.width - margin * 2
        const cellH = (canvas.height - margin * 2 - pad) / 2

        loadedImgs.slice(0, 2).forEach((img, idx) => {
          const y = margin + idx * (cellH + pad)
          drawImageContained(ctx, img, margin, y, cellW, cellH)
        })
      } else if (layout === '2_horiz') {
        // Two pages side by side
        const cellW = (canvas.width - margin * 2 - pad) / 2
        const cellH = canvas.height - margin * 2

        loadedImgs.slice(0, 2).forEach((img, idx) => {
          const x = margin + idx * (cellW + pad)
          drawImageContained(ctx, img, x, margin, cellW, cellH)
        })
      } else if (layout === '4_grid') {
        // 2 x 2 grid
        const cellW = (canvas.width - margin * 2 - pad) / 2
        const cellH = (canvas.height - margin * 2 - pad) / 2

        loadedImgs.slice(0, 4).forEach((img, idx) => {
          const col = idx % 2
          const row = Math.floor(idx / 2)
          const x = margin + col * (cellW + pad)
          const y = margin + row * (cellH + pad)
          drawImageContained(ctx, img, x, y, cellW, cellH)
        })
      } else if (layout === '6_grid') {
        // 2 cols x 3 rows grid
        const cellW = (canvas.width - margin * 2 - pad) / 2
        const cellH = (canvas.height - margin * 2 - pad * 2) / 3

        loadedImgs.slice(0, 6).forEach((img, idx) => {
          const col = idx % 2
          const row = Math.floor(idx / 2)
          const x = margin + col * (cellW + pad)
          const y = margin + row * (cellH + pad)
          drawImageContained(ctx, img, x, y, cellW, cellH)
        })
      }

      const collageDataUrl = canvas.toDataURL('image/jpeg', 0.95)

      if (onApplyCollage) {
        onApplyCollage(collageDataUrl)
      } else {
        const a = document.createElement('a')
        a.href = collageDataUrl
        a.download = `KamalScan_Collage_${Date.now()}.jpg`
        a.click()
      }

      onClose()
    } catch (err) {
      console.error(err)
      alert('Error creating collage: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  // Draw image contained with aspect ratio preservation and subtle border
  function drawImageContained(ctx, img, boxX, boxY, boxW, boxH) {
    const imgAspect = img.width / img.height
    const boxAspect = boxW / boxH
    let drawW, drawH

    if (imgAspect > boxAspect) {
      drawW = boxW
      drawH = boxW / imgAspect
    } else {
      drawH = boxH
      drawW = boxH * imgAspect
    }

    const drawX = boxX + (boxW - drawW) / 2
    const drawY = boxY + (boxH - drawH) / 2

    // Shadow / border
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 4
    ctx.strokeRect(drawX, drawY, drawW, drawH)

    ctx.drawImage(img, drawX, drawY, drawW, drawH)
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-scale-up max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-linear-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-xs">
              <LayoutGrid size={22} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Multi-Page Collage Studio</h3>
              <p className="text-xs text-purple-100">
                Combine 2, 4, or 6 slides &amp; photos onto 1 printable A4 sheet
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/20 hover:bg-red-500 hover:text-white transition-colors"
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Layout Selector */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
              Select Collage Grid Layout:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: '2_vert', label: '2-in-1 Stack', sub: 'Top & Bottom' },
                { id: '2_horiz', label: '2-in-1 Side', sub: 'Side by Side' },
                { id: '4_grid', label: '4-in-1 Grid', sub: '2 × 2 Quadrants' },
                { id: '6_grid', label: '6-in-1 Handout', sub: '2 × 3 Lecture Notes' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setLayout(item.id)}
                  className={`p-3 rounded-2xl border-2 text-left transition-all ${
                    layout === item.id
                      ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/30 ring-2 ring-purple-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{item.label}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Images Strip */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Pages / Images for Collage ({selectedImages.length} selected):
              </label>
              <label className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-semibold cursor-pointer">
                + Add Images
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto p-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 min-h-24">
              {selectedImages.length === 0 ? (
                <p className="text-xs text-slate-400 mx-auto py-4">
                  No images added yet. Click "+ Add Images" or upload pages to the scanner queue.
                </p>
              ) : (
                selectedImages.map((src, idx) => (
                  <div key={idx} className="relative shrink-0 w-20 aspect-[3/4] bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 shadow-xs group">
                    <img src={src} alt="thumbnail" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white opacity-80 hover:opacity-100 shadow-xs"
                      title="Remove"
                    >
                      <X size={10} />
                    </button>
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                      #{idx + 1}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Padding / Background settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Spacing Between Pages: {spacing}px
              </label>
              <input
                type="range"
                min="0"
                max="50"
                value={spacing}
                onChange={(e) => setSpacing(parseInt(e.target.value, 10))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Sheet Background:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300"
                />
                <span className="text-xs text-slate-500 font-mono">{backgroundColor}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleGenerate}
            disabled={generating || selectedImages.length === 0}
            className="px-6 py-2.5 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-98 disabled:opacity-40"
          >
            {generating ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Generating Collage...
              </>
            ) : (
              <>
                <LayoutGrid size={15} /> Create &amp; Add to Queue
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
