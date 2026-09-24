import { useState, useRef, useEffect, useCallback } from 'react'
import jsPDF from 'jspdf'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import Tesseract from 'tesseract.js'
import { Document, Packer, Paragraph, ImageRun } from 'docx'
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import { zipSync, strToU8 } from 'fflate'
import {
  FileText, UploadCloud, Camera, X, ScanText, Copy, Loader2, RotateCw, ArrowUp, ArrowDown,
  Download, Crop, Eye, FileSearch, LayoutGrid, Check, Info, Lock, Zap, Cpu, Wand2, Stamp, Eraser,
  Target, Moon, Sun, Smartphone, Sparkles, Hash, ShieldCheck, Layers, Sliders, CheckCircle2,
  GripVertical, Pencil, Package, Languages, ChevronDown, BarChart3, Clock, FileDown, Archive,
  Image as ImageIcon, Maximize2, AlignCenter, AlertCircle
} from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// ─── Constants ───────────────────────────────────────────────────────────────
const TIER_CONFIG = {
  lossless: { label: 'Lossless / High Quality', quality: 0.95, scale: 1 },
  balanced: { label: 'Balanced / Recommended', quality: 0.75, scale: 0.85 },
  max: { label: 'Max Compression', quality: 0.5, scale: 0.6 },
  custom: { label: 'Custom (target size)', quality: null, scale: 1 },
}

const ENHANCE_MODES = {
  none: { label: 'Original', filter: 'none' },
  enhance: { label: 'Enhance', filter: 'contrast(1.2) brightness(1.06) saturate(1.1)' },
  super: { label: 'Super (HD-style)', filter: 'contrast(1.4) brightness(1.1) saturate(1.2)' },
  bw: { label: 'Black & White', filter: 'grayscale(1) contrast(1.35) brightness(1.05)' },
}

const PDF_PAGE_SIZES = {
  a4:     { label: 'A4 (210×297 mm)',   width: 210, height: 297 },
  letter: { label: 'Letter (216×279)', width: 215.9, height: 279.4 },
  a3:     { label: 'A3 (297×420 mm)',   width: 297, height: 420 },
  legal:  { label: 'Legal (216×356)',   width: 215.9, height: 355.6 },
  a5:     { label: 'A5 (148×210 mm)',   width: 148, height: 210 },
}

const OCR_LANGS = {
  eng: 'English',
  hin: 'Hindi',
  tam: 'Tamil',
  tel: 'Telugu',
  fra: 'French',
  deu: 'German',
}

const MAX_TOTAL_MB = 50
const FORMATS = ['pdf', 'jpeg', 'png', 'gif', 'docx']

// ─── Utilities ────────────────────────────────────────────────────────────────
const formatBytes = (bytes) => {
  if (!bytes) return '0 KB'
  const kb = bytes / 1024
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`
}

const estimateDataUrlSize = (dataUrl) => {
  const base64 = dataUrl.split(',')[1] || ''
  return Math.round(base64.length * 0.75)
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

const blobToDataUrl = (blob) =>
  new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })

const dataUrlToUint8Array = async (dataUrl) => {
  const res = await fetch(dataUrl)
  const buf = await res.arrayBuffer()
  return new Uint8Array(buf)
}

function playShutterSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.setValueAtTime(1200, ctx.currentTime)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
  } catch (err) {}
}

// ─── Image Processing ─────────────────────────────────────────────────────────
async function rotateDataUrl(dataUrl, degrees) {
  const img = await loadImage(dataUrl)
  const rad = (degrees * Math.PI) / 180
  const swap = degrees % 180 !== 0
  const canvas = document.createElement('canvas')
  canvas.width = swap ? img.height : img.width
  canvas.height = swap ? img.width : img.height
  const ctx = canvas.getContext('2d')
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(rad)
  ctx.drawImage(img, -img.width / 2, -img.height / 2)
  return canvas.toDataURL('image/png')
}

async function addPaddingToDataUrl(dataUrl, paddingPx) {
  if (!paddingPx || paddingPx <= 0) return dataUrl
  const img = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.width + paddingPx * 2
  canvas.height = img.height + paddingPx * 2
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, paddingPx, paddingPx, img.width, img.height)
  return canvas.toDataURL('image/png')
}

async function compressFromSrc(src, tier, customQuality, enhanceMode = 'none', paddingPx = 0) {
  const config = TIER_CONFIG[tier]
  const quality = tier === 'custom' ? customQuality : config.quality
  let imgSrc = src
  if (paddingPx > 0) imgSrc = await addPaddingToDataUrl(src, paddingPx)
  const img = await loadImage(imgSrc)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * config.scale))
  canvas.height = Math.max(1, Math.round(img.height * config.scale))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.filter = ENHANCE_MODES[enhanceMode]?.filter || 'none'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

async function findQualityForTargetSize(src, targetBytes, enhanceMode = 'none', paddingPx = 0) {
  let lo = 0.05, hi = 1, best = 0.5
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2
    const blob = await compressFromSrc(src, 'custom', mid, enhanceMode, paddingPx)
    if (blob.size > targetBytes) {
      hi = mid
    } else {
      best = mid
      lo = mid
    }
  }
  return best
}

async function convertToGifBlob(dataUrl, enhanceMode = 'none') {
  const img = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  ctx.filter = ENHANCE_MODES[enhanceMode]?.filter || 'none'
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const palette = quantize(imageData.data, 256)
  const index = applyPalette(imageData.data, palette)
  const gif = GIFEncoder()
  gif.writeFrame(index, canvas.width, canvas.height, { palette })
  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}

async function enhancedDataUrl(src, enhanceMode) {
  if (enhanceMode === 'none') return src
  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  ctx.filter = ENHANCE_MODES[enhanceMode]?.filter || 'none'
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/png')
}

async function convertToDocxBlob(dataUrl, enhanceMode = 'none') {
  const src = await enhancedDataUrl(dataUrl, enhanceMode)
  const res = await fetch(src)
  const arrayBuffer = await res.arrayBuffer()
  const img = await loadImage(src)
  const maxWidth = 500
  const scale = Math.min(1, maxWidth / img.width)
  const doc = new Document({
    sections: [{
      children: [new Paragraph({
        children: [new ImageRun({ data: arrayBuffer, transformation: { width: img.width * scale, height: img.height * scale } })],
      })],
    }],
  })
  return Packer.toBlob(doc)
}

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const renderPdfPagesToImages = async (file) => {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const images = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise
    images.push(canvas.toDataURL('image/png'))
  }
  return images
}

async function applyWatermarkToDataUrl(src, settings) {
  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  ctx.save()
  ctx.globalAlpha = settings.opacity
  ctx.fillStyle = settings.color
  ctx.font = `bold ${settings.fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (settings.style === 'diagonal') {
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((-30 * Math.PI) / 180)
    const stepX = settings.fontSize * (settings.text.length * 0.55 + 5)
    const stepY = settings.fontSize * 3.2
    const diag = Math.sqrt(canvas.width ** 2 + canvas.height ** 2)
    for (let y = -diag; y < diag; y += stepY) {
      for (let x = -diag; x < diag; x += stepX) {
        ctx.fillText(settings.text, x, y)
      }
    }
  } else {
    const positions = {
      center: [canvas.width / 2, canvas.height / 2],
      'top-left': [canvas.width * 0.18, canvas.height * 0.08],
      'top-right': [canvas.width * 0.82, canvas.height * 0.08],
      'bottom-left': [canvas.width * 0.18, canvas.height * 0.92],
      'bottom-right': [canvas.width * 0.82, canvas.height * 0.92],
    }
    const [x, y] = positions[settings.position] || positions.center
    ctx.translate(x, y)
    ctx.rotate(((settings.angle || 0) * Math.PI) / 180)
    ctx.fillText(settings.text, 0, 0)
  }
  ctx.restore()
  return canvas.toDataURL('image/png')
}

// ─── Perspective Crop Math ────────────────────────────────────────────────────
function solveLinearSystem(A, b) {
  const n = A.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row
    ;[M[col], M[pivot]] = [M[pivot], M[col]]
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col]
      for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k]
    }
  }
  const x = new Array(n).fill(0)
  for (let row = n - 1; row >= 0; row--) {
    let sum = M[row][n]
    for (let k = row + 1; k < n; k++) sum -= M[row][k] * x[k]
    x[row] = sum / M[row][row]
  }
  return x
}

function computeHomography(from, to) {
  const A = []
  const b = []
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = from[i]
    const { x: dx, y: dy } = to[i]
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]); b.push(dx)
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]); b.push(dy)
  }
  const h = solveLinearSystem(A, b)
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]
}

function applyHomography(h, x, y) {
  const w = h[6] * x + h[7] * y + h[8]
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w }
}

function estimateOutputSize(corners) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  return {
    width: Math.round(Math.max(dist(corners[0], corners[1]), dist(corners[3], corners[2]))),
    height: Math.round(Math.max(dist(corners[0], corners[3]), dist(corners[1], corners[2]))),
  }
}

async function warpPerspective(imgSrc, corners, outWidth, outHeight) {
  const img = await loadImage(imgSrc)
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = img.width
  srcCanvas.height = img.height
  const srcCtx = srcCanvas.getContext('2d')
  srcCtx.drawImage(img, 0, 0)
  const srcData = srcCtx.getImageData(0, 0, img.width, img.height).data

  const outCanvas = document.createElement('canvas')
  outCanvas.width = outWidth
  outCanvas.height = outHeight
  const outCtx = outCanvas.getContext('2d')
  const outImageData = outCtx.createImageData(outWidth, outHeight)
  const dstRect = [{ x: 0, y: 0 }, { x: outWidth, y: 0 }, { x: outWidth, y: outHeight }, { x: 0, y: outHeight }]
  const h = computeHomography(dstRect, corners)

  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      const { x: sx, y: sy } = applyHomography(h, x, y)
      const ix = Math.round(sx), iy = Math.round(sy)
      const outIdx = (y * outWidth + x) * 4
      if (ix >= 0 && ix < img.width && iy >= 0 && iy < img.height) {
        const srcIdx = (iy * img.width + ix) * 4
        outImageData.data[outIdx] = srcData[srcIdx]
        outImageData.data[outIdx + 1] = srcData[srcIdx + 1]
        outImageData.data[outIdx + 2] = srcData[srcIdx + 2]
        outImageData.data[outIdx + 3] = 255
      }
    }
  }
  outCtx.putImageData(outImageData, 0, 0)
  return outCanvas.toDataURL('image/png')
}

// ─── Crop Modal ───────────────────────────────────────────────────────────────
function CropModal({ item, onCancel, onApply }) {
  const containerRef = useRef(null)
  const [natSize, setNatSize] = useState({ w: 0, h: 0 })
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 })
  const [corners, setCorners] = useState(null)
  const [dragIndex, setDragIndex] = useState(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      setNatSize({ w: img.width, h: img.height })
      const inset = 0.08
      setCorners([
        { x: img.width * inset, y: img.height * inset },
        { x: img.width * (1 - inset), y: img.height * inset },
        { x: img.width * (1 - inset), y: img.height * (1 - inset) },
        { x: img.width * inset, y: img.height * (1 - inset) },
      ])
    }
    img.src = item.previewUrl
  }, [item])

  const toDisplay = (pt) => ({ x: (pt.x / natSize.w) * displaySize.w, y: (pt.y / natSize.h) * displaySize.h })
  const toNatural = (dx, dy) => ({ x: (dx / displaySize.w) * natSize.w, y: (dy / displaySize.h) * natSize.h })

  const onPointerMove = (e) => {
    if (dragIndex === null || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const dx = Math.min(Math.max(e.clientX - rect.left, 0), displaySize.w)
    const dy = Math.min(Math.max(e.clientY - rect.top, 0), displaySize.h)
    const nat = toNatural(dx, dy)
    setCorners((prev) => prev.map((c, i) => (i === dragIndex ? nat : c)))
  }

  if (!corners) return null

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="p-5 pb-2 flex-shrink-0">
          <h3 className="font-semibold text-lg mb-1">Adjust Corners</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Drag each blue dot to match the document's edges, then apply.</p>
        </div>
        <div className="px-5 overflow-y-auto flex-1">
          <div
            ref={containerRef}
            className="relative select-none touch-none bg-slate-100 dark:bg-slate-950 rounded-lg p-1"
            onPointerMove={onPointerMove}
            onPointerUp={() => setDragIndex(null)}
            onPointerLeave={() => setDragIndex(null)}
          >
            <img
              src={item.previewUrl}
              onLoad={(e) => setDisplaySize({ w: e.target.clientWidth, h: e.target.clientHeight })}
              className="w-full rounded-lg block"
              draggable={false}
            />
            {displaySize.w > 0 && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <polygon points={corners.map((c) => { const d = toDisplay(c); return `${d.x},${d.y}` }).join(' ')} fill="rgba(14,165,233,0.2)" stroke="#0ea5e9" strokeWidth="2" />
              </svg>
            )}
            {displaySize.w > 0 && corners.map((c, i) => {
              const d = toDisplay(c)
              return (
                <div key={i} onPointerDown={(e) => { e.preventDefault(); setDragIndex(i) }}
                  className="absolute w-6 h-6 -ml-3 -mt-3 bg-sky-600 border-2 border-white rounded-full shadow-md cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                  style={{ left: d.x, top: d.y }} />
              )
            })}
          </div>
        </div>
        <div className="flex gap-2 p-5 pt-3 flex-shrink-0 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium">Cancel</button>
          <button onClick={() => onApply(corners)} className="flex-1 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium shadow-sm">Apply Crop</button>
        </div>
      </div>
    </div>
  )
}

// ─── Quick View Modal ─────────────────────────────────────────────────────────
function QuickViewModal({ item, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 flex items-center justify-between flex-shrink-0 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate pr-2">{item.name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 flex-shrink-0"><X size={22} /></button>
        </div>
        <div className="p-3 sm:p-6 overflow-auto flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <img
            src={item.previewUrl}
            alt={item.name}
            className="max-w-full max-h-[78vh] rounded-lg shadow-lg"
            style={{ filter: ENHANCE_MODES[item.enhanceMode || 'none'].filter }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Preview Modal ────────────────────────────────────────────────────────────
function PreviewModal({ pages, onClose }) {
  const [index, setIndex] = useState(0)
  const page = pages[Math.min(index, pages.length - 1)]

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="p-4 flex items-center justify-between flex-shrink-0 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Preview — Page {index + 1} of {pages.length}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500"><X size={20} /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <img key={page.id} src={page.previewUrl} alt={page.name} className="max-w-full max-h-[65vh] rounded-lg shadow" style={{ filter: ENHANCE_MODES[page.enhanceMode || 'none'].filter }} />
        </div>
        <div className="flex gap-2 px-4 overflow-x-auto flex-shrink-0 pb-2 pt-2">
          {pages.map((p, i) => (
            <button key={p.id} onClick={() => setIndex(i)} className="flex-shrink-0 rounded-md overflow-hidden border-2" style={{ borderColor: i === index ? '#0284c7' : 'transparent' }}>
              <img src={p.previewUrl} alt={p.name} className="w-14 h-14 object-cover" style={{ filter: ENHANCE_MODES[p.enhanceMode || 'none'].filter }} />
            </button>
          ))}
        </div>
        <div className="flex gap-2 p-4 pt-2 flex-shrink-0 border-t border-slate-100 dark:border-slate-800">
          <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 font-medium">Previous</button>
          <button onClick={() => setIndex((i) => Math.min(pages.length - 1, i + 1))} disabled={index === pages.length - 1} className="flex-1 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-medium">Next</button>
        </div>
      </div>
    </div>
  )
}

// ─── Batch OCR Modal ──────────────────────────────────────────────────────────
function BatchOcrModal({ text, onClose, onCopy }) {
  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="p-5 pb-2 flex-shrink-0 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Text from All Pages</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500"><X size={18} /></button>
        </div>
        <div className="px-5 overflow-y-auto flex-1">
          <textarea readOnly value={text} className="w-full h-64 text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 rounded-md p-3 font-mono" />
        </div>
        <div className="flex gap-2 p-5 pt-3 flex-shrink-0 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onCopy} className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium">Copy All</button>
          <button onClick={() => triggerDownload(new Blob([text], { type: 'text/plain' }), 'kamalscan-text.txt')} className="flex-1 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium">Download .txt</button>
        </div>
      </div>
    </div>
  )
}

// ─── Collage Modal ────────────────────────────────────────────────────────────
function CollageModal({ queue, onCancel, onGenerate }) {
  const [selectedIds, setSelectedIds] = useState([])
  const [layout, setLayout] = useState('2x2')
  const [generating, setGenerating] = useState(false)

  const toggle = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const layouts = ['1x2', '2x1', '2x2', '3x3']

  const handleGenerate = async () => {
    if (selectedIds.length === 0) return
    setGenerating(true)
    const [cols, rows] = layout.split('x').map(Number)
    const cellSize = 500
    const gutter = 8
    const canvas = document.createElement('canvas')
    canvas.width = cellSize * cols + gutter * (cols + 1)
    canvas.height = cellSize * rows + gutter * (rows + 1)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const items = queue.filter((q) => selectedIds.includes(q.id))
    for (let i = 0; i < Math.min(items.length, cols * rows); i++) {
      const img = await loadImage(items[i].previewUrl)
      const col = i % cols
      const row = Math.floor(i / cols)
      const cellX = gutter + col * (cellSize + gutter)
      const cellY = gutter + row * (cellSize + gutter)
      const scale = Math.max(cellSize / img.width, cellSize / img.height)
      const w = img.width * scale
      const h = img.height * scale
      const dx = cellX + (cellSize - w) / 2
      const dy = cellY + (cellSize - h) / 2
      ctx.save()
      ctx.beginPath()
      ctx.rect(cellX, cellY, cellSize, cellSize)
      ctx.clip()
      ctx.drawImage(img, dx, dy, w, h)
      ctx.restore()
    }
    setGenerating(false)
    onGenerate(canvas.toDataURL('image/png'))
  }

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="p-5 pb-2 flex-shrink-0">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Create Collage</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Pick images and a grid layout.</p>
        </div>
        <div className="px-5 flex-shrink-0">
          <div className="flex gap-2 mb-3">
            {layouts.map((l) => (
              <button key={l} onClick={() => setLayout(l)} className={`flex-1 text-xs py-2 rounded-md font-medium ${layout === l ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="px-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-3 gap-2">
            {queue.map((item) => (
              <button key={item.id} onClick={() => toggle(item.id)} className="relative rounded-lg overflow-hidden border-2" style={{ borderColor: selectedIds.includes(item.id) ? '#0284c7' : 'transparent' }}>
                <img src={item.previewUrl} alt={item.name} className="w-full h-20 object-cover" />
                {selectedIds.includes(item.id) && (
                  <div className="absolute inset-0 bg-sky-600/30 flex items-center justify-center">
                    <div className="bg-sky-600 text-white rounded-full p-1"><Check size={14} /></div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 p-5 pt-3 flex-shrink-0 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium">Cancel</button>
          <button onClick={handleGenerate} disabled={generating || selectedIds.length === 0} className="flex-1 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2">
            {generating && <Loader2 size={14} className="animate-spin" />}
            {generating ? 'Building...' : `Generate (${selectedIds.length} selected)`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Watermark Modal ──────────────────────────────────────────────────────────
function WatermarkModal({ scopeLabel, onCancel, onApply }) {
  const [text, setText] = useState('CONFIDENTIAL')
  const [style, setStyle] = useState('diagonal')
  const [position, setPosition] = useState('center')
  const [fontSize, setFontSize] = useState(36)
  const [color, setColor] = useState('#ff0000')
  const [opacity, setOpacity] = useState(0.3)
  const [angle, setAngle] = useState(0)

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="p-5 pb-2 flex-shrink-0">
          <h3 className="font-semibold text-lg mb-1 flex items-center gap-2"><Stamp size={18} className="text-sky-600" /> Add Watermark</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Applying to: <b>{scopeLabel}</b></p>
        </div>
        <div className="px-5 overflow-y-auto flex-1 space-y-3">
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Watermark text</label>
            <input type="text" value={text} onChange={(e) => setText(e.target.value)} className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {['CONFIDENTIAL', 'DRAFT', 'SAMPLE', 'APPROVED', 'COPY'].map((t) => (
                <button key={t} onClick={() => setText(t)} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-sky-100 dark:hover:bg-sky-900 font-medium transition-colors">{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Style</label>
            <div className="flex gap-2">
              <button onClick={() => setStyle('diagonal')} className={`flex-1 text-xs py-2 rounded-md font-medium ${style === 'diagonal' ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>Tiled Diagonal</button>
              <button onClick={() => setStyle('single')} className={`flex-1 text-xs py-2 rounded-md font-medium ${style === 'single' ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>Single Placement</button>
            </div>
          </div>
          {style === 'single' && (
            <>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Position</label>
                <select value={position} onChange={(e) => setPosition(e.target.value)} className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300">
                  <option value="center">Center</option>
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Rotation angle: {angle}°</label>
                <input type="range" min="-90" max="90" value={angle} onChange={(e) => setAngle(parseInt(e.target.value))} className="w-full" />
              </div>
            </>
          )}
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Font size: {fontSize}px</label>
            <input type="range" min="16" max="80" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-full" />
          </div>
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Color</label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Opacity: {Math.round(opacity * 100)}%</label>
              <input type="range" min="0.05" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className="w-full" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 p-5 pt-3 flex-shrink-0 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium">Cancel</button>
          <button onClick={() => onApply({ text: text || 'WATERMARK', style, position, fontSize, color, opacity, angle })} className="flex-1 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium">Apply</button>
        </div>
      </div>
    </div>
  )
}

// ─── Export Progress Modal ────────────────────────────────────────────────────
function ExportProgressModal({ progress, total, currentName }) {
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0
  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-sky-50 dark:bg-sky-950 flex items-center justify-center mx-auto mb-4 border border-sky-100 dark:border-sky-900">
          <FileDown size={28} className="text-sky-600 dark:text-sky-400" />
        </div>
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-1">Exporting PDF</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 truncate px-4">
          Processing: <span className="font-medium text-slate-700 dark:text-slate-300">{currentName}</span>
        </p>
        <div className="relative h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-sky-500 to-cyan-400 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Page {progress} of {total}</span>
          <span className="font-semibold text-sky-600 dark:text-sky-400">{pct}%</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function App() {
  const [queue, setQueue] = useState([])
  const [toasts, setToasts] = useState([])
  const [cameraActive, setCameraActive] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [pdfFilename, setPdfFilename] = useState('kamalscan-output')
  const [insertAt, setInsertAt] = useState('')
  const [cropItemId, setCropItemId] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showCollage, setShowCollage] = useState(false)
  const [batchOcrText, setBatchOcrText] = useState(null)
  const [batchOcrRunning, setBatchOcrRunning] = useState(false)
  const [ocrEverUsed, setOcrEverUsed] = useState(false)
  const [ocrLang, setOcrLang] = useState('eng')
  const [videoAspect, setVideoAspect] = useState(null)
  const [watermarkTarget, setWatermarkTarget] = useState(null)
  const [quickViewId, setQuickViewId] = useState(null)
  const [addPageNumbers, setAddPageNumbers] = useState(true)
  const [pdfPageSize, setPdfPageSize] = useState('a4')
  const [summary, setSummary] = useState(null)
  const [darkMode, setDarkMode] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [editingNameId, setEditingNameId] = useState(null)
  const [editingNameValue, setEditingNameValue] = useState('')
  const [zipBuilding, setZipBuilding] = useState(false)

  // Export progress state
  const [exportProgress, setExportProgress] = useState(null) // { current, total, name }

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const dragSrcId = useRef(null)
  const editInputRef = useRef(null)

  // ── Always default Light Mode ──────────────────────────────────────────────
  useEffect(() => {
    localStorage.removeItem('theme')
    document.documentElement.classList.remove('dark')
  }, [])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  // ── PWA Install ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handlePrompt = (e) => { e.preventDefault(); setInstallPrompt(e) }
    const handleAppInstalled = () => { setInstallPrompt(null); addToast('KamalScan app installed successfully!') }
    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const installApp = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstallPrompt(null)
  }

  // ── Camera keyboard shortcut ───────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === 'Space' && cameraActive && editingNameId === null) {
        e.preventDefault()
        captureFrame()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [cameraActive, editingNameId])

  // ── Cleanup camera stream ──────────────────────────────────────────────────
  useEffect(() => {
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop()) }
  }, [])

  // ── Toast system ───────────────────────────────────────────────────────────
  const addToast = (message, type = 'success') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  // ── Queue helpers ──────────────────────────────────────────────────────────
  const updateItem = (id, patch) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const makeItem = (previewUrl, name, kind, originalSize) => ({
    id: crypto.randomUUID(), name, kind, previewUrl, originalSize,
    tier: 'balanced', customQuality: 0.8, downloadFormat: 'pdf', enhanceMode: 'none',
    watermarkBackup: null,
    targetSize: 200, targetUnit: 'KB', fittingSize: false,
    status: 'ready', savedPercent: null, ocrText: '', ocrLoading: false,
    paddingPx: 0,
  })

  // ── File ingestion ─────────────────────────────────────────────────────────
  const addFilesToQueue = async (fileList) => {
    const files = Array.from(fileList)
    let runningTotal = queue.reduce((sum, f) => sum + f.originalSize, 0)
    const newItems = []
    for (const file of files) {
      const isImage = file.type.startsWith('image/')
      const isPdf = file.type === 'application/pdf'
      if (!isImage && !isPdf) { addToast(`Unsupported file type: ${file.name}`, 'error'); continue }
      if (runningTotal + file.size > MAX_TOTAL_MB * 1024 * 1024) {
        addToast(`Batch limit of ${MAX_TOTAL_MB}MB exceeded — "${file.name}" skipped`, 'error'); continue
      }
      runningTotal += file.size
      if (isImage) {
        newItems.push(makeItem(URL.createObjectURL(file), file.name, 'image', file.size))
      } else {
        try {
          const pages = await renderPdfPagesToImages(file)
          pages.forEach((dataUrl, idx) => {
            newItems.push(makeItem(dataUrl, `${file.name} (page ${idx + 1})`, 'pdf-page', estimateDataUrlSize(dataUrl)))
          })
        } catch (err) {
          addToast(`Could not read "${file.name}"`, 'error')
        }
      }
    }
    setQueue((prev) => {
      const pos = parseInt(insertAt, 10)
      if (!isNaN(pos) && pos >= 1 && pos <= prev.length + 1) {
        const copy = [...prev]
        copy.splice(pos - 1, 0, ...newItems)
        return copy
      }
      return [...prev, ...newItems]
    })
    if (newItems.length) {
      addToast(insertAt ? `${newItems.length} page(s) inserted at position ${insertAt}` : `${newItems.length} file(s) added to the end`)
    }
    setInsertAt('')
  }

  const removeFile = (id) => {
    setQueue((prev) => {
      const item = prev.find((f) => f.id === id)
      if (item && item.kind === 'image') URL.revokeObjectURL(item.previewUrl)
      return prev.filter((f) => f.id !== id)
    })
  }

  const rotateItem = async (id) => {
    const item = queue.find((f) => f.id === id)
    if (!item) return
    const rotated = await rotateDataUrl(item.previewUrl, 90)
    if (item.kind === 'image') URL.revokeObjectURL(item.previewUrl)
    updateItem(id, { previewUrl: rotated, kind: 'pdf-page' })
  }

  const applyCrop = async (corners) => {
    const item = queue.find((f) => f.id === cropItemId)
    if (!item) return
    const { width, height } = estimateOutputSize(corners)
    const cropped = await warpPerspective(item.previewUrl, corners, Math.max(width, 50), Math.max(height, 50))
    if (item.kind === 'image') URL.revokeObjectURL(item.previewUrl)
    updateItem(item.id, { previewUrl: cropped, kind: 'pdf-page' })
    setCropItemId(null)
    addToast('Crop applied — document straightened')
  }

  const applyWatermark = async (settings) => {
    const targets = watermarkTarget.mode === 'all' ? queue.map((q) => q.id) : [watermarkTarget.itemId]
    for (const id of targets) {
      const item = queue.find((f) => f.id === id)
      if (!item) continue
      const backup = item.watermarkBackup || item.previewUrl
      const watermarked = await applyWatermarkToDataUrl(backup, settings)
      if (item.kind === 'image' && !item.watermarkBackup) URL.revokeObjectURL(item.previewUrl)
      updateItem(id, { previewUrl: watermarked, kind: 'pdf-page', watermarkBackup: backup })
    }
    setWatermarkTarget(null)
    addToast(targets.length > 1 ? `Watermark applied to ${targets.length} pages` : 'Watermark applied')
  }

  const removeWatermark = (id) => {
    const item = queue.find((f) => f.id === id)
    if (!item || !item.watermarkBackup) return
    updateItem(id, { previewUrl: item.watermarkBackup, watermarkBackup: null })
    addToast('Watermark removed')
  }

  // ── Move item up / down ────────────────────────────────────────────────────
  const moveItem = (id, direction) => {
    setQueue((prev) => {
      const index = prev.findIndex((f) => f.id === id)
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= prev.length) return prev
      const copy = [...prev]
      ;[copy[index], copy[targetIndex]] = [copy[targetIndex], copy[index]]
      return copy
    })
  }

  // ── Drag-to-reorder (fixed: only trigger from grip handle) ─────────────────
  const handleDragStart = (e, id) => {
    // Only allow drag when initiated from the grip handle
    if (!dragSrcId.current) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
  const handleGripMouseDown = (id) => {
    // Mark which card is being dragged before the dragstart fires
    dragSrcId.current = id
  }
  const handleDragEnterCard = (e, id) => {
    e.preventDefault()
    if (dragSrcId.current && dragSrcId.current !== id) setDragOverId(id)
  }
  const handleDragOverCard = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  const handleDropCard = (e, targetId) => {
    e.preventDefault()
    e.stopPropagation()
    const srcId = dragSrcId.current
    setDragOverId(null)
    dragSrcId.current = null
    if (!srcId || srcId === targetId) return
    setQueue((prev) => {
      const copy = [...prev]
      const srcIdx = copy.findIndex((f) => f.id === srcId)
      const tgtIdx = copy.findIndex((f) => f.id === targetId)
      if (srcIdx < 0 || tgtIdx < 0) return prev
      const [item] = copy.splice(srcIdx, 1)
      copy.splice(tgtIdx, 0, item)
      return copy
    })
  }
  const handleDragEnd = () => { setDragOverId(null); dragSrcId.current = null }

  // ── Inline rename ──────────────────────────────────────────────────────────
  const startRename = (item) => {
    setEditingNameId(item.id)
    setEditingNameValue(item.name)
    setTimeout(() => editInputRef.current?.select(), 50)
  }
  const commitRename = () => {
    if (editingNameId) {
      const trimmed = editingNameValue.trim()
      if (trimmed) updateItem(editingNameId, { name: trimmed })
    }
    setEditingNameId(null)
    setEditingNameValue('')
  }

  // ── Camera ─────────────────────────────────────────────────────────────────
  const handleFileDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    // Only process if it's real files (not a card drag)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files)
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      setCameraActive(true)
    } catch (err) { addToast('Camera access denied: ' + err.message, 'error') }
  }

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    setCameraActive(false)
  }

  const captureFrame = () => {
    playShutterSound()
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/png')
    setQueue((prev) => [...prev, makeItem(dataUrl, `scan-${Date.now()}.png`, 'pdf-page', estimateDataUrlSize(dataUrl))])
    addToast('Frame captured and added to queue')
  }

  // ── OCR ────────────────────────────────────────────────────────────────────
  const runOcr = async (id) => {
    const item = queue.find((f) => f.id === id)
    if (!item) return
    if (!ocrEverUsed) {
      addToast('First run downloads the OCR engine (~2MB) — just once per session')
      setOcrEverUsed(true)
    }
    updateItem(id, { ocrLoading: true, ocrText: '' })
    try {
      const result = await Tesseract.recognize(item.previewUrl, ocrLang)
      updateItem(id, { ocrText: result.data.text.trim() || '(No readable text found)', ocrLoading: false })
    } catch (err) {
      updateItem(id, { ocrText: 'OCR error: ' + err.message, ocrLoading: false })
    }
  }

  const runBatchOcr = async () => {
    if (queue.length === 0) return
    if (!ocrEverUsed) {
      addToast('First run downloads the OCR engine (~2MB) — just once per session')
      setOcrEverUsed(true)
    }
    setBatchOcrRunning(true)
    let combined = ''
    for (let i = 0; i < queue.length; i++) {
      const result = await Tesseract.recognize(queue[i].previewUrl, ocrLang)
      combined += `--- Page ${i + 1} (${queue[i].name}) ---\n${result.data.text.trim() || '(no text found)'}\n\n`
    }
    setBatchOcrRunning(false)
    setBatchOcrText(combined)
  }

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); addToast('Text copied to clipboard') }

  // ── Custom size fit ────────────────────────────────────────────────────────
  const fitToTargetSize = async (item) => {
    updateItem(item.id, { fittingSize: true })
    const targetBytes = item.targetUnit === 'MB' ? item.targetSize * 1024 * 1024 : item.targetSize * 1024
    const quality = await findQualityForTargetSize(item.previewUrl, targetBytes, item.enhanceMode, item.paddingPx)
    updateItem(item.id, { tier: 'custom', customQuality: quality, fittingSize: false })
    addToast(`Fit to ~${item.targetSize}${item.targetUnit} — quality set to ${Math.round(quality * 100)}%`)
  }

  // ── Single download ────────────────────────────────────────────────────────
  const downloadSingle = async (item) => {
    const base = item.name.replace(/\.[^/.]+$/, '') || 'kamalscan-file'
    const pageSize = PDF_PAGE_SIZES[pdfPageSize]
    if (item.downloadFormat === 'pdf') {
      const compressedBlob = await compressFromSrc(item.previewUrl, item.tier, item.customQuality, item.enhanceMode, item.paddingPx)
      const dataUrl = await blobToDataUrl(compressedBlob)
      const pdf = new jsPDF({ unit: 'mm', format: [pageSize.width, pageSize.height] })
      const imgProps = pdf.getImageProperties(dataUrl)
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = (imgProps.height * pdfW) / imgProps.width
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfW, Math.min(pdfH, pdf.internal.pageSize.getHeight()))
      if (addPageNumbers) {
        pdf.setFontSize(9)
        pdf.setTextColor(120)
        pdf.text('Page 1 of 1', pdfW / 2, pdf.internal.pageSize.getHeight() - 6, { align: 'center' })
      }
      pdf.save(`${base}.pdf`)
    } else if (item.downloadFormat === 'png') {
      const src = item.paddingPx > 0 ? await addPaddingToDataUrl(item.previewUrl, item.paddingPx) : item.previewUrl
      const enhanced = await enhancedDataUrl(src, item.enhanceMode)
      triggerDownload(await (await fetch(enhanced)).blob(), `${base}.png`)
    } else if (item.downloadFormat === 'jpeg') {
      triggerDownload(await compressFromSrc(item.previewUrl, item.tier, item.customQuality, item.enhanceMode, item.paddingPx), `${base}.jpeg`)
    } else if (item.downloadFormat === 'gif') {
      triggerDownload(await convertToGifBlob(item.previewUrl, item.enhanceMode), `${base}.gif`)
    } else if (item.downloadFormat === 'docx') {
      triggerDownload(await convertToDocxBlob(item.previewUrl, item.enhanceMode), `${base}.docx`)
    }
    addToast(`Downloaded: ${base}.${item.downloadFormat}`)
  }

  // ── Combine all → PDF with real progress ──────────────────────────────────
  const processAll = async () => {
    if (queue.length === 0) return
    const pageSize = PDF_PAGE_SIZES[pdfPageSize]
    const pdf = new jsPDF({ unit: 'mm', format: [pageSize.width, pageSize.height] })
    let totalOriginal = 0
    let totalCompressed = 0
    const totalPages = queue.length

    for (let i = 0; i < totalPages; i++) {
      const item = queue[i]
      setExportProgress({ current: i + 1, total: totalPages, name: item.name })

      const blob = await compressFromSrc(item.previewUrl, item.tier, item.customQuality, item.enhanceMode, item.paddingPx)
      totalOriginal += item.originalSize
      totalCompressed += blob.size
      const savedPercent = Math.max(0, Math.round((1 - blob.size / item.originalSize) * 100))
      updateItem(item.id, { savedPercent })

      const dataUrl = await blobToDataUrl(blob)
      const imgProps = pdf.getImageProperties(dataUrl)
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = (imgProps.height * pdfW) / imgProps.width
      if (i > 0) pdf.addPage()
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfW, Math.min(pdfH, pdf.internal.pageSize.getHeight()))
      if (addPageNumbers) {
        pdf.setFontSize(9)
        pdf.setTextColor(120)
        pdf.text(`Page ${i + 1} of ${totalPages}`, pdfW / 2, pdf.internal.pageSize.getHeight() - 6, { align: 'center' })
      }
    }

    pdf.save(`${pdfFilename || 'kamalscan-output'}.pdf`)
    setExportProgress(null)
    setSummary({ totalOriginal, totalCompressed, savedPercent: Math.round((1 - totalCompressed / totalOriginal) * 100) })
    addToast('All pages combined and exported as PDF!')
  }

  // ── Download All as ZIP ────────────────────────────────────────────────────
  const downloadAllAsZip = async () => {
    if (queue.length === 0) return
    setZipBuilding(true)
    addToast(`Building ZIP with ${queue.length} files...`)
    try {
      const files = {}
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i]
        const fmt = item.downloadFormat || 'jpeg'
        let blob
        if (fmt === 'png') {
          const src = item.paddingPx > 0 ? await addPaddingToDataUrl(item.previewUrl, item.paddingPx) : item.previewUrl
          const enhanced = await enhancedDataUrl(src, item.enhanceMode)
          blob = await (await fetch(enhanced)).blob()
        } else if (fmt === 'gif') {
          blob = await convertToGifBlob(item.previewUrl, item.enhanceMode)
        } else if (fmt === 'docx') {
          blob = await convertToDocxBlob(item.previewUrl, item.enhanceMode)
        } else {
          blob = await compressFromSrc(item.previewUrl, item.tier, item.customQuality, item.enhanceMode, item.paddingPx)
          // default to jpeg for zip
        }
        const uint8 = new Uint8Array(await blob.arrayBuffer())
        const safeName = item.name.replace(/[^a-z0-9_\-. ]/gi, '_')
        const ext = fmt === 'pdf' ? 'jpeg' : fmt // zip doesn't bundle PDF generation
        files[`${String(i + 1).padStart(2, '0')}_${safeName}.${ext}`] = uint8
      }
      const zipped = zipSync(files, { level: 0 })
      const zipBlob = new Blob([zipped], { type: 'application/zip' })
      triggerDownload(zipBlob, `${pdfFilename || 'kamalscan'}-files.zip`)
      addToast(`ZIP downloaded with ${queue.length} files!`)
    } catch (err) {
      addToast('ZIP build failed: ' + err.message, 'error')
    }
    setZipBuilding(false)
  }

  // ── Estimated output size ──────────────────────────────────────────────────
  const estimatedOutputBytes = queue.reduce((sum, item) => {
    const q = item.tier === 'custom' ? item.customQuality : (TIER_CONFIG[item.tier]?.quality || 0.75)
    const s = TIER_CONFIG[item.tier]?.scale || 1
    return sum + item.originalSize * q * s * 0.65
  }, 0)

  const totalSize = queue.reduce((sum, f) => sum + f.originalSize, 0)
  const cropItem = queue.find((f) => f.id === cropItemId)
  const quickViewItem = queue.find((f) => f.id === quickViewId)

  return (
    <div className={`relative min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-gradient-to-br from-sky-50 via-white to-cyan-50 text-slate-800'} pb-32`}>
      {/* Ambient blobs */}
      <div className={`absolute -top-20 -left-20 w-96 h-96 ${darkMode ? 'bg-sky-900/20' : 'bg-sky-200/60'} rounded-full blur-3xl opacity-40 pointer-events-none`} />
      <div className={`absolute top-10 right-0 w-96 h-96 ${darkMode ? 'bg-cyan-900/20' : 'bg-cyan-200/60'} rounded-full blur-3xl opacity-40 pointer-events-none`} />

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="relative max-w-5xl mx-auto px-6 pt-8 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-sky-600 to-cyan-500 text-white p-3 rounded-2xl shadow-lg flex items-center justify-center">
              <FileText size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black bg-gradient-to-r from-sky-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent tracking-tight">KamalScan</h1>
                <span className="text-[10px] font-extrabold uppercase tracking-widest bg-sky-600 text-white px-2 py-0.5 rounded-md shadow">PRO</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Professional Browser-Based Document Scanner &amp; PDF Workbench</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {installPrompt && (
              <button
                onClick={installApp}
                className="text-xs font-semibold bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all hover:scale-105"
              >
                <Smartphone size={14} /> Install App
              </button>
            )}
            <span className="text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" /> 100% On-Device Privacy
            </span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-600" />}
            </button>
          </div>
        </div>

        {/* Feature pills */}
        <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center gap-2 overflow-x-auto pb-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
          {[
            { icon: <Sparkles size={12} className="text-sky-500" />, label: '4-Corner Straightener' },
            { icon: <Target size={12} className="text-cyan-500" />, label: 'Exact Target Size Fit' },
            { icon: <Stamp size={12} className="text-indigo-500" />, label: 'Watermark Stamp' },
            { icon: <ScanText size={12} className="text-emerald-500" />, label: 'Tesseract OCR' },
            { icon: <Archive size={12} className="text-rose-500" />, label: 'ZIP Export' },
            { icon: <GripVertical size={12} className="text-amber-500" />, label: 'Drag to Reorder' },
            { icon: <BarChart3 size={12} className="text-violet-500" />, label: 'Live Progress' },
          ].map((pill) => (
            <span key={pill.label} className="flex-shrink-0 flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-xs">
              {pill.icon} {pill.label}
            </span>
          ))}
        </div>
      </header>

      <main className="relative max-w-5xl mx-auto px-6 space-y-6">

        {/* ─── Upload Zone ─────────────────────────────────────────────── */}
        <section
          onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          className={`rounded-2xl border-2 border-dashed p-10 text-center transition-all shadow-sm ${
            dragOver
              ? 'border-sky-500 bg-sky-50/80 dark:bg-sky-950/40 scale-[1.01]'
              : 'border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900'
          }`}
        >
          <div className="flex justify-center mb-3">
            <div className={`p-4 rounded-2xl border transition-all ${dragOver ? 'bg-sky-100 border-sky-300 dark:bg-sky-900 dark:border-sky-700' : 'bg-sky-50 dark:bg-sky-950 border-sky-100 dark:border-sky-900'}`}>
              <UploadCloud size={36} className="text-sky-600 dark:text-sky-400" />
            </div>
          </div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">Select or Drop Document Files</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Upload high-res images (JPEG, PNG, WEBP) or multi-page PDFs. Processing is 100% local.</p>
          <label className="inline-flex items-center gap-2 cursor-pointer bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-all hover:scale-[1.02] shadow-sm">
            <UploadCloud size={16} /> Browse Files
            <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => addFilesToQueue(e.target.files)} />
          </label>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
            <span>Max batch: <b>{MAX_TOTAL_MB}MB</b></span>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <span>Insert at position:</span>
              <input
                type="number" min="1" value={insertAt}
                onChange={(e) => setInsertAt(e.target.value)}
                placeholder="end"
                className="w-16 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>
          </div>
        </section>

        {/* ─── Live Camera Scanner ──────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Camera size={18} className="text-sky-600 dark:text-sky-400" /> Live Document Scanner
            </h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">HD Frame Capture</span>
          </div>
          <div className="relative w-full max-w-2xl mx-auto rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner" style={{ aspectRatio: videoAspect || '3 / 4' }}>
            {!cameraActive && (
              <div className="text-center text-slate-400 px-6 py-12">
                <Camera size={48} className="mx-auto mb-2 opacity-50 text-slate-300" />
                <p className="text-xs font-medium text-slate-300">Camera preview inactive.</p>
                <p className="text-[11px] text-slate-400 mt-1">Click "Initialize Scanner" below to start live stream.</p>
              </div>
            )}
            <video ref={videoRef} autoPlay playsInline onLoadedMetadata={(e) => setVideoAspect(`${e.target.videoWidth} / ${e.target.videoHeight}`)} className={`absolute inset-0 w-full h-full object-contain ${cameraActive ? 'block' : 'hidden'}`} />
            {cameraActive && (
              <>
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 text-white text-[11px] px-2.5 py-1 rounded-full backdrop-blur-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />Live Viewport
                </div>
                <div className="absolute inset-8 border-2 border-dashed border-white/60 rounded-lg pointer-events-none" />
                <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] px-2.5 py-1 rounded-full backdrop-blur-xs">Press Space to capture</div>
              </>
            )}
          </div>
          <div className="flex justify-center gap-3 mt-4">
            <button onClick={cameraActive ? stopCamera : startCamera} className="px-4 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors">
              {cameraActive ? 'Stop Camera' : 'Initialize Scanner'}
            </button>
            <button onClick={captureFrame} disabled={!cameraActive} className="px-5 py-2 text-xs rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-all hover:scale-[1.02] flex items-center gap-2 shadow-xs">
              <Camera size={14} /> Capture Frame
            </button>
          </div>
        </section>

        {/* ─── Page Queue ───────────────────────────────────────────────── */}
        {queue.length > 0 && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-6">
            {/* Section header */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="font-semibold text-base text-slate-800 dark:text-slate-100">
                  PDF Pages <span className="text-sky-600 dark:text-sky-400 text-xs font-normal">({queue.length} pages loaded)</span>
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">Drag cards to reorder · Click name to rename · Click thumbnail for full view</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* OCR language */}
                <div className="flex items-center gap-1.5">
                  <Languages size={13} className="text-slate-500 dark:text-slate-400" />
                  <select
                    value={ocrLang}
                    onChange={(e) => setOcrLang(e.target.value)}
                    className="text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                  >
                    {Object.entries(OCR_LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <button onClick={() => setWatermarkTarget({ mode: 'all' })} className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium"><Stamp size={13} /> Watermark All</button>
                <button onClick={() => setShowCollage(true)} className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium"><LayoutGrid size={13} /> Collage</button>
                <button onClick={() => setShowPreview(true)} className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium"><Eye size={13} /> Preview</button>
                <button onClick={runBatchOcr} disabled={batchOcrRunning} className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium disabled:opacity-50">
                  {batchOcrRunning ? <Loader2 size={13} className="animate-spin" /> : <FileSearch size={13} />}
                  {batchOcrRunning ? 'Reading all...' : 'Batch OCR'}
                </button>
              </div>
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {queue.map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onDragEnter={(e) => handleDragEnterCard(e, item.id)}
                  onDragOver={handleDragOverCard}
                  onDrop={(e) => handleDropCard(e, item.id)}
                  onDragEnd={handleDragEnd}
                  className={`relative rounded-2xl transition-all duration-200 bg-white dark:bg-slate-800/60 overflow-hidden ${
                    dragOverId === item.id
                      ? 'ring-2 ring-sky-400 shadow-xl shadow-sky-100/60 dark:shadow-sky-900/30 scale-[1.02]'
                      : 'border border-slate-200 dark:border-slate-700/80 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {/* ── Card Top Bar ────────────────────────────────────── */}
                  <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 border-b border-slate-100 dark:border-slate-700/60">
                    {/* Left: grip + badge */}
                    <div className="flex items-center gap-2">
                      {/* Grip handle — ONLY this triggers drag */}
                      <span
                        onMouseDown={() => handleGripMouseDown(item.id)}
                        onMouseUp={() => { if (!dragOverId) dragSrcId.current = null }}
                        className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-sky-500 dark:hover:text-sky-400 transition-colors select-none"
                        title="Drag to reorder"
                        draggable={false}
                      >
                        <GripVertical size={16} />
                      </span>
                      {/* Page badge */}
                      <span className="text-[10px] font-bold text-white bg-gradient-to-r from-sky-600 to-cyan-500 px-2 py-0.5 rounded-full shadow-sm">
                        PAGE {index + 1}
                      </span>
                      {item.watermarkBackup && (
                        <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                          WATERMARKED
                        </span>
                      )}
                    </div>
                    {/* Right: up/down/remove controls */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveItem(item.id, -1)}
                        disabled={index === 0}
                        draggable={false}
                        className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-sky-100 dark:hover:bg-sky-900 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                        title="Move up"
                      >
                        <ArrowUp size={11} />
                      </button>
                      <button
                        onClick={() => moveItem(item.id, 1)}
                        disabled={index === queue.length - 1}
                        draggable={false}
                        className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-sky-100 dark:hover:bg-sky-900 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                        title="Move down"
                      >
                        <ArrowDown size={11} />
                      </button>
                      <button
                        onClick={() => removeFile(item.id)}
                        draggable={false}
                        className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-500 transition-colors"
                        title="Remove page"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>

                  {/* ── Thumbnail ────────────────────────────────────────── */}
                  <div className="relative group cursor-zoom-in" onClick={() => setQuickViewId(item.id)}>
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      draggable={false}
                      className="w-full h-40 object-cover bg-slate-50 dark:bg-slate-900 transition-opacity group-hover:opacity-90"
                      style={{ filter: ENHANCE_MODES[item.enhanceMode].filter }}
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-all flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 text-[10px] font-semibold px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1">
                        <Eye size={11} /> Quick View
                      </span>
                    </div>
                    {/* Saved badge overlay */}
                    {item.savedPercent !== null && (
                      <span className="absolute bottom-2 left-2 text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow">
                        −{item.savedPercent}%
                      </span>
                    )}
                  </div>

                  {/* ── Card Body ────────────────────────────────────────── */}
                  <div className="p-3 space-y-2.5">

                    {/* Inline name edit */}
                    <div className="flex items-center gap-1">
                      {editingNameId === item.id ? (
                        <input
                          ref={editInputRef}
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingNameId(null) }}
                          className="flex-1 text-xs font-semibold text-slate-800 dark:text-slate-100 border border-sky-400 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white dark:bg-slate-900"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => startRename(item)}
                          draggable={false}
                          title="Click to rename"
                          className="flex-1 text-left text-xs font-semibold truncate text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 group flex items-center gap-1 transition-colors"
                        >
                          <span className="truncate">{item.name}</span>
                          <Pencil size={10} className="flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
                        </button>
                      )}
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">{formatBytes(item.originalSize)}</span>
                    </div>

                    {/* ── Action buttons row 1: Rotate · Straighten · Watermark ── */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => rotateItem(item.id)}
                        draggable={false}
                        className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-[10px] font-medium border border-slate-100 dark:border-slate-600/50"
                      >
                        <RotateCw size={13} />
                        Rotate
                      </button>
                      <button
                        onClick={() => setCropItemId(item.id)}
                        draggable={false}
                        className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900 text-sky-600 dark:text-sky-400 transition-colors text-[10px] font-medium border border-sky-100 dark:border-sky-900/60"
                      >
                        <Crop size={13} />
                        Straighten
                      </button>
                      <button
                        onClick={() => setWatermarkTarget({ mode: 'single', itemId: item.id })}
                        draggable={false}
                        className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 transition-colors text-[10px] font-medium border border-indigo-100 dark:border-indigo-900/60"
                      >
                        <Stamp size={13} />
                        Watermark
                      </button>
                    </div>

                    {/* Remove watermark */}
                    {item.watermarkBackup && (
                      <button
                        onClick={() => removeWatermark(item.id)}
                        draggable={false}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-xs font-medium border border-red-100 dark:border-red-900/50 transition-colors"
                      >
                        <Eraser size={12} /> Remove Watermark
                      </button>
                    )}

                    {/* ── Enhancement filter ─────────────────────────────── */}
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 flex items-center gap-1 mb-1">
                        <Wand2 size={10} /> Enhancement
                      </label>
                      <select
                        value={item.enhanceMode}
                        onChange={(e) => updateItem(item.id, { enhanceMode: e.target.value })}
                        className="w-full text-xs border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                      >
                        {Object.entries(ENHANCE_MODES).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                      </select>
                    </div>

                    {/* ── White padding ──────────────────────────────────── */}
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1"><Maximize2 size={10} /> White Padding</span>
                        <span className="font-bold text-slate-600 dark:text-slate-300">{item.paddingPx}px</span>
                      </label>
                      <input
                        type="range" min="0" max="80" step="4" value={item.paddingPx}
                        onChange={(e) => updateItem(item.id, { paddingPx: parseInt(e.target.value) })}
                        className="w-full accent-sky-600"
                      />
                    </div>

                    {/* ── Compression tier ───────────────────────────────── */}
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 flex items-center gap-1 mb-1">
                        <Sliders size={10} /> Compression
                      </label>
                      <select
                        value={item.tier}
                        onChange={(e) => updateItem(item.id, { tier: e.target.value })}
                        className="w-full text-xs border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                      >
                        {Object.entries(TIER_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                      </select>
                    </div>

                    {/* Custom target size */}
                    {item.tier === 'custom' && (
                      <div className="bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-950/50 dark:to-cyan-950/50 rounded-xl p-3 border border-sky-100 dark:border-sky-900/60 space-y-1.5">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400 flex items-center gap-1">
                          <Target size={10} /> Target File Size
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="number" min="10" value={item.targetSize}
                            onChange={(e) => updateItem(item.id, { targetSize: parseFloat(e.target.value) || 0 })}
                            className="flex-1 min-w-0 text-xs border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                          />
                          <select
                            value={item.targetUnit}
                            onChange={(e) => updateItem(item.id, { targetUnit: e.target.value })}
                            className="text-xs border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-1.5 py-1.5 focus:outline-none"
                          >
                            <option value="KB">KB</option>
                            <option value="MB">MB</option>
                          </select>
                          <button
                            onClick={() => fitToTargetSize(item)}
                            disabled={item.fittingSize}
                            draggable={false}
                            className="text-xs bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-3 rounded-lg flex items-center justify-center font-semibold transition-colors"
                          >
                            {item.fittingSize ? <Loader2 size={12} className="animate-spin" /> : 'Fit'}
                          </button>
                        </div>
                        <p className="text-[10px] text-sky-600/70 dark:text-sky-400/70">
                          Quality: ~{Math.round(item.customQuality * 100)}%
                        </p>
                      </div>
                    )}

                    {/* ── Download row ───────────────────────────────────── */}
                    <div className="flex gap-1.5 pt-0.5">
                      <select
                        value={item.downloadFormat}
                        onChange={(e) => updateItem(item.id, { downloadFormat: e.target.value })}
                        className="flex-1 text-xs border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                      >
                        {FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                      </select>
                      <button
                        onClick={() => downloadSingle(item)}
                        draggable={false}
                        className="bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white text-xs px-4 rounded-lg flex items-center gap-1.5 font-semibold shadow-sm transition-all hover:scale-[1.02]"
                      >
                        <Download size={13} /> Save
                      </button>
                    </div>

                    {/* ── OCR ───────────────────────────────────────────── */}
                    <button
                      onClick={() => runOcr(item.id)}
                      disabled={item.ocrLoading}
                      draggable={false}
                      className="w-full text-xs bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 disabled:opacity-50 rounded-xl py-2 font-semibold flex items-center justify-center gap-1.5 border border-emerald-100 dark:border-emerald-900/50 transition-colors"
                    >
                      {item.ocrLoading ? <Loader2 size={13} className="animate-spin" /> : <ScanText size={13} />}
                      {item.ocrLoading ? 'Reading text...' : `Extract Text (${OCR_LANGS[ocrLang]})`}
                    </button>

                    {item.ocrText && (
                      <div className="space-y-1">
                        <textarea
                          readOnly
                          value={item.ocrText}
                          className="w-full text-xs border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 rounded-lg p-2 h-20 font-mono resize-none focus:outline-none"
                        />
                        <button
                          onClick={() => copyToClipboard(item.ocrText)}
                          draggable={false}
                          className="w-full text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg py-1.5 flex items-center justify-center gap-1.5 transition-colors font-medium"
                        >
                          <Copy size={12} /> Copy Extracted Text
                        </button>
                      </div>
                    )}
                  </div>{/* end card body */}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Export Summary ───────────────────────────────────────────── */}
        {summary && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
              Combined {queue.length} page(s): {formatBytes(summary.totalOriginal)} → {formatBytes(summary.totalCompressed)}
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">({summary.savedPercent}% smaller)</span>
            </p>
          </section>
        )}

        {/* ─── Technical Architecture ───────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-6">
          <h2 className="font-semibold text-base mb-4 text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Info size={18} className="text-sky-600 dark:text-sky-400" /> Technical Architecture
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex gap-3 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <Lock size={18} className="text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
              <p><b className="text-slate-800 dark:text-slate-100 block mb-0.5">100% Client-Side Privacy</b>Every file stays strictly in your browser — zero uploads to external servers. Works completely offline.</p>
            </div>
            <div className="flex gap-3 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <Cpu size={18} className="text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
              <p><b className="text-slate-800 dark:text-slate-100 block mb-0.5">8-Param Homography Matrix</b>The document crop tool computes linear systems in JavaScript to straighten perspective distortion in photos.</p>
            </div>
            <div className="flex gap-3 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <Zap size={18} className="text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
              <p><b className="text-slate-800 dark:text-slate-100 block mb-0.5">Wasm OCR &amp; Binary Search</b>High-speed client compression algorithm and Tesseract WebAssembly engine running on local hardware.</p>
            </div>
          </div>
        </section>
      </main>




      {/* ─── Floating Footer Toolbar ──────────────────────────────────────── */}
      {queue.length > 0 && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-2xl z-40">
          <div className="max-w-5xl mx-auto px-4 py-3">
            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mb-2.5">
              <span className="flex items-center gap-1"><Layers size={12} /> <b className="text-slate-800 dark:text-slate-100">{queue.length}</b> pages</span>
              <span className="flex items-center gap-1"><BarChart3 size={12} /> Input: <b className="text-slate-800 dark:text-slate-100">{formatBytes(totalSize)}</b></span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Zap size={12} /> Est. output: <b>{formatBytes(estimatedOutputBytes)}</b></span>
              <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400"><AlignCenter size={12} /> Page size: <b>{PDF_PAGE_SIZES[pdfPageSize].label}</b></span>
            </div>

            {/* Controls row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Page numbers toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={addPageNumbers} onChange={(e) => setAddPageNumbers(e.target.checked)} className="rounded text-sky-600 focus:ring-sky-400" />
                  <Hash size={12} /> Page Nos.
                </label>
                {/* Filename */}
                <input
                  type="text" value={pdfFilename} onChange={(e) => setPdfFilename(e.target.value)}
                  placeholder="filename"
                  className="text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg px-2.5 py-1.5 w-28 focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
                {/* Page size */}
                <select
                  value={pdfPageSize}
                  onChange={(e) => setPdfPageSize(e.target.value)}
                  className="text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                >
                  {Object.entries(PDF_PAGE_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2">
                {/* ZIP download */}
                <button
                  onClick={downloadAllAsZip}
                  disabled={zipBuilding}
                  className="px-4 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 transition-all hover:scale-[1.02] shadow-sm"
                >
                  {zipBuilding ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                  {zipBuilding ? 'Building ZIP...' : 'Download ZIP'}
                </button>
                {/* Combine → PDF */}
                <button
                  onClick={processAll}
                  disabled={!!exportProgress}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 transition-all hover:scale-[1.02] shadow-sm"
                >
                  {exportProgress ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                  {exportProgress ? `Processing ${exportProgress.current}/${exportProgress.total}...` : 'Combine All → Export PDF'}
                </button>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* ─── Modals ───────────────────────────────────────────────────────── */}
      {cropItem && <CropModal item={cropItem} onCancel={() => setCropItemId(null)} onApply={applyCrop} />}
      {quickViewItem && <QuickViewModal item={quickViewItem} onClose={() => setQuickViewId(null)} />}
      {showPreview && queue.length > 0 && <PreviewModal pages={queue} onClose={() => setShowPreview(false)} />}
      {showCollage && (
        <CollageModal
          queue={queue}
          onCancel={() => setShowCollage(false)}
          onGenerate={(dataUrl) => {
            setQueue((prev) => [...prev, makeItem(dataUrl, `collage-${Date.now()}.png`, 'pdf-page', estimateDataUrlSize(dataUrl))])
            setShowCollage(false)
            addToast('Collage added to queue')
          }}
        />
      )}
      {batchOcrText !== null && (
        <BatchOcrModal text={batchOcrText} onClose={() => setBatchOcrText(null)} onCopy={() => copyToClipboard(batchOcrText)} />
      )}
      {watermarkTarget && (
        <WatermarkModal
          scopeLabel={watermarkTarget.mode === 'all' ? `all ${queue.length} pages` : 'this page only'}
          onCancel={() => setWatermarkTarget(null)}
          onApply={applyWatermark}
        />
      )}
      {exportProgress && (
        <ExportProgressModal
          progress={exportProgress.current}
          total={exportProgress.total}
          currentName={exportProgress.name}
        />
      )}

      {/* ─── Toast Notifications ──────────────────────────────────────────── */}
      <div className="fixed top-4 right-4 space-y-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-xl shadow-lg text-xs font-semibold text-white max-w-xs flex items-center gap-2 animate-slide-in ${
              t.type === 'error' ? 'bg-red-500' : 'bg-slate-900 dark:bg-slate-800'
            }`}
          >
            {t.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} className="text-emerald-400" />}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App