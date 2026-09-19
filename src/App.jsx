import { useState, useRef, useEffect } from 'react'
import jsPDF from 'jspdf'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import Tesseract from 'tesseract.js'
import { Document, Packer, Paragraph, ImageRun } from 'docx'
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import { FileText, UploadCloud, Camera, X, ScanText, Copy, Loader2, RotateCw, ArrowUp, ArrowDown, Download, Crop, Eye, FileSearch, LayoutGrid, Check } from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const TIER_CONFIG = {
  lossless: { label: 'Lossless / High Quality', quality: 0.95, scale: 1 },
  balanced: { label: 'Balanced / Recommended', quality: 0.75, scale: 0.85 },
  max: { label: 'Max Compression', quality: 0.5, scale: 0.6 },
  custom: { label: 'Custom (manual)', quality: null, scale: 1 },
}
const MAX_TOTAL_MB = 50
const FORMATS = ['pdf', 'jpeg', 'png', 'gif', 'docx']

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

// Simple camera shutter beep using the Web Audio API — no external sound file
// needed, so it can never fail to load or 404.
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
  } catch (err) {
    // Silently ignore — some browsers block audio until user interaction elsewhere on the page
  }
}

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

async function compressFromSrc(src, tier, customQuality) {
  const config = TIER_CONFIG[tier]
  const quality = tier === 'custom' ? customQuality : config.quality
  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * config.scale))
  canvas.height = Math.max(1, Math.round(img.height * config.scale))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

async function convertToGifBlob(dataUrl) {
  const img = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const palette = quantize(imageData.data, 256)
  const index = applyPalette(imageData.data, palette)
  const gif = GIFEncoder()
  gif.writeFrame(index, canvas.width, canvas.height, { palette })
  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}

async function convertToDocxBlob(dataUrl) {
  const res = await fetch(dataUrl)
  const arrayBuffer = await res.arrayBuffer()
  const img = await loadImage(dataUrl)
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

// ---------- Perspective crop math ----------
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

// ---------- Crop modal ----------
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-5 pb-2 flex-shrink-0">
          <h3 className="font-semibold text-slate-800 mb-1">Adjust Corners</h3>
          <p className="text-xs text-slate-500">Drag each blue dot to match the document's edges, then apply.</p>
        </div>
        <div className="px-5 overflow-y-auto flex-1">
          <div
            ref={containerRef}
            className="relative select-none touch-none"
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
                  className="absolute w-6 h-6 -ml-3 -mt-3 bg-sky-600 border-2 border-white rounded-full shadow-md cursor-grab active:cursor-grabbing"
                  style={{ left: d.x, top: d.y }} />
              )
            })}
          </div>
        </div>
        <div className="flex gap-2 p-5 pt-3 flex-shrink-0 border-t border-slate-100">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium">Cancel</button>
          <button onClick={() => onApply(corners)} className="flex-1 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium">Apply Crop</button>
        </div>
      </div>
    </div>
  )
}

// ---------- Preview modal (fixed: unique key per page forces reliable re-render,
// plus a thumbnail strip so you can jump straight to any page and visually confirm it changed) ----------
function PreviewModal({ pages, onClose }) {
  const [index, setIndex] = useState(0)
  const page = pages[Math.min(index, pages.length - 1)]

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="p-4 flex items-center justify-between flex-shrink-0 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Preview — Page {index + 1} of {pages.length}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500"><X size={18} /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 flex items-center justify-center bg-slate-50">
          <img key={page.id} src={page.previewUrl} alt={page.name} className="max-w-full max-h-[55vh] rounded-lg shadow" />
        </div>

        {/* Thumbnail strip — tap any page directly, and it visually proves navigation works */}
        <div className="flex gap-2 px-4 overflow-x-auto flex-shrink-0 pb-2">
          {pages.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setIndex(i)}
              className="flex-shrink-0 rounded-md overflow-hidden border-2"
              style={{ borderColor: i === index ? '#0284c7' : 'transparent' }}
            >
              <img src={p.previewUrl} alt={p.name} className="w-12 h-12 object-cover" />
            </button>
          ))}
        </div>

        <div className="flex gap-2 p-4 pt-2 flex-shrink-0 border-t border-slate-100">
          <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-medium">Previous</button>
          <button onClick={() => setIndex((i) => Math.min(pages.length - 1, i + 1))} disabled={index === pages.length - 1} className="flex-1 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-medium">Next</button>
        </div>
      </div>
    </div>
  )
}

// ---------- Batch OCR modal ----------
function BatchOcrModal({ text, onClose, onCopy }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-5 pb-2 flex-shrink-0 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Text from All Pages</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500"><X size={18} /></button>
        </div>
        <div className="px-5 overflow-y-auto flex-1">
          <textarea readOnly value={text} className="w-full h-64 text-xs border border-slate-200 rounded-md p-3 font-mono" />
        </div>
        <div className="flex gap-2 p-5 pt-3 flex-shrink-0 border-t border-slate-100">
          <button onClick={onCopy} className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium">Copy All</button>
          <button onClick={() => triggerDownload(new Blob([text], { type: 'text/plain' }), 'kamalscan-text.txt')} className="flex-1 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium">Download .txt</button>
        </div>
      </div>
    </div>
  )
}

// ---------- Collage modal ----------
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-5 pb-2 flex-shrink-0">
          <h3 className="font-semibold text-slate-800 mb-1">Create Collage</h3>
          <p className="text-xs text-slate-500">Pick images and a grid layout.</p>
        </div>

        <div className="px-5 flex-shrink-0">
          <div className="flex gap-2 mb-3">
            {layouts.map((l) => (
              <button
                key={l}
                onClick={() => setLayout(l)}
                className={`flex-1 text-xs py-2 rounded-md font-medium ${layout === l ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-3 gap-2">
            {queue.map((item) => (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className="relative rounded-lg overflow-hidden border-2"
                style={{ borderColor: selectedIds.includes(item.id) ? '#0284c7' : 'transparent' }}
              >
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

        <div className="flex gap-2 p-5 pt-3 flex-shrink-0 border-t border-slate-100">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium">Cancel</button>
          <button onClick={handleGenerate} disabled={generating || selectedIds.length === 0} className="flex-1 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2">
            {generating && <Loader2 size={14} className="animate-spin" />}
            {generating ? 'Building...' : `Generate (${selectedIds.length} selected)`}
          </button>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [queue, setQueue] = useState([])
  const [toasts, setToasts] = useState([])
  const [processing, setProcessing] = useState(false)
  const [summary, setSummary] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [pdfFilename, setPdfFilename] = useState('kamalscan-output')
  const [insertAt, setInsertAt] = useState('')
  const [cropItemId, setCropItemId] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showCollage, setShowCollage] = useState(false)
  const [batchOcrText, setBatchOcrText] = useState(null)
  const [batchOcrRunning, setBatchOcrRunning] = useState(false)

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const addToast = (message, type = 'success') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  const updateItem = (id, patch) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  useEffect(() => {
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop()) }
  }, [])

  const makeItem = (previewUrl, name, kind, originalSize) => ({
    id: crypto.randomUUID(), name, kind, previewUrl, originalSize,
    tier: 'balanced', customQuality: 0.8, downloadFormat: 'pdf',
    status: 'ready', savedPercent: null, ocrText: '', ocrLoading: false,
  })

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

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); addFilesToQueue(e.dataTransfer.files) }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      setCameraActive(true)
    } catch (err) { addToast('Camera access denied: ' + err.message, 'error') }
  }

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((track) => track.stop()); streamRef.current = null }
    setCameraActive(false)
  }

  const captureFrame = () => {
    playShutterSound()
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/png')
    setQueue((prev) => [...prev, makeItem(dataUrl, `scan-${Date.now()}.png`, 'pdf-page', estimateDataUrlSize(dataUrl))])
    addToast('Frame captured and added to queue')
  }

  const runOcr = async (id) => {
    const item = queue.find((f) => f.id === id)
    if (!item) return
    updateItem(id, { ocrLoading: true, ocrText: '' })
    try {
      const result = await Tesseract.recognize(item.previewUrl, 'eng')
      updateItem(id, { ocrText: result.data.text.trim() || '(No readable text found)', ocrLoading: false })
    } catch (err) {
      updateItem(id, { ocrText: 'OCR error: ' + err.message, ocrLoading: false })
    }
  }

  const runBatchOcr = async () => {
    if (queue.length === 0) return
    setBatchOcrRunning(true)
    let combined = ''
    for (let i = 0; i < queue.length; i++) {
      const result = await Tesseract.recognize(queue[i].previewUrl, 'eng')
      combined += `--- Page ${i + 1} (${queue[i].name}) ---\n${result.data.text.trim() || '(no text found)'}\n\n`
    }
    setBatchOcrRunning(false)
    setBatchOcrText(combined)
  }

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); addToast('Text copied to clipboard') }

  const downloadSingle = async (item) => {
    const base = item.name.replace(/\.[^/.]+$/, '') || 'kamalscan-file'
    if (item.downloadFormat === 'pdf') {
      const compressedBlob = await compressFromSrc(item.previewUrl, item.tier, item.customQuality)
      const dataUrl = await blobToDataUrl(compressedBlob)
      const pdf = new jsPDF()
      const imgProps = pdf.getImageProperties(dataUrl)
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`${base}.pdf`)
    } else if (item.downloadFormat === 'png') {
      triggerDownload(await (await fetch(item.previewUrl)).blob(), `${base}.png`)
    } else if (item.downloadFormat === 'jpeg') {
      triggerDownload(await compressFromSrc(item.previewUrl, item.tier, item.customQuality), `${base}.jpeg`)
    } else if (item.downloadFormat === 'gif') {
      triggerDownload(await convertToGifBlob(item.previewUrl), `${base}.gif`)
    } else if (item.downloadFormat === 'docx') {
      triggerDownload(await convertToDocxBlob(item.previewUrl), `${base}.docx`)
    }
    addToast(`Thank you for downloading ${base}.${item.downloadFormat}!`)
  }

  const processAll = async () => {
    if (queue.length === 0) return
    setProcessing(true)
    const pdf = new jsPDF()
    let totalOriginal = 0
    let totalCompressed = 0
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i]
      updateItem(item.id, { status: 'processing' })
      const blob = await compressFromSrc(item.previewUrl, item.tier, item.customQuality)
      totalOriginal += item.originalSize
      totalCompressed += blob.size
      const savedPercent = Math.max(0, Math.round((1 - blob.size / item.originalSize) * 100))
      updateItem(item.id, { status: 'done', savedPercent })
      const dataUrl = await blobToDataUrl(blob)
      const imgProps = pdf.getImageProperties(dataUrl)
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
      if (i > 0) pdf.addPage()
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight)
    }
    pdf.save(`${pdfFilename || 'kamalscan-output'}.pdf`)
    setSummary({ totalOriginal, totalCompressed, savedPercent: Math.round((1 - totalCompressed / totalOriginal) * 100) })
    setProcessing(false)
    addToast('Thank you for downloading — all pages combined into one PDF!')
  }

  const totalSize = queue.reduce((sum, f) => sum + f.originalSize, 0)
  const cropItem = queue.find((f) => f.id === cropItemId)

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-cyan-50 to-blue-100 text-slate-800 pb-28">
      <header className="max-w-5xl mx-auto px-6 pt-10 pb-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="bg-sky-600 text-white p-2 rounded-xl shadow-sm"><FileText size={22} /></div>
            <h1 className="text-2xl font-bold text-slate-900">KamalScan</h1>
          </div>
          <span className="text-xs font-semibold bg-sky-100 text-sky-700 px-3 py-1.5 rounded-full">Client-Side Secure</span>
        </div>
        <p className="text-slate-500 text-sm mt-2">Scan, convert, compress, and extract text — 100% locally in your browser.</p>
      </header>

      <main className="max-w-5xl mx-auto px-6 space-y-6">
        <section
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-12 text-center transition-colors shadow-sm ${dragOver ? 'border-sky-400 bg-sky-50' : 'border-slate-300 bg-white'}`}
        >
          <div className="flex justify-center mb-4"><div className="bg-sky-100 text-sky-600 p-4 rounded-full"><UploadCloud size={32} /></div></div>
          <label className="inline-block cursor-pointer bg-sky-600 hover:bg-sky-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors focus-within:ring-2 focus-within:ring-sky-400 shadow-sm">
            Browse Files
            <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => addFilesToQueue(e.target.files)} />
          </label>
          <p className="text-sm text-slate-500 mt-3">or drag &amp; drop images and PDFs here</p>
          <p className="text-xs text-slate-400 mt-1">Supports up to {MAX_TOTAL_MB}MB per batch.</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <label className="text-xs text-slate-500">Insert new pages at position:</label>
            <input
              type="number"
              min="1"
              value={insertAt}
              onChange={(e) => setInsertAt(e.target.value)}
              placeholder="end"
              className="w-16 text-xs border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2 text-slate-800"><Camera size={20} className="text-sky-600" /> Scanner</h2>
          <div className="relative w-full max-w-2xl mx-auto aspect-[3/4] sm:aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center">
            {!cameraActive && (
              <div className="text-center text-slate-400 px-6">
                <Camera size={56} className="mx-auto mb-2 opacity-60" />
                <p className="text-sm">Camera preview inactive. Click "Initialize Scanner" to begin.</p>
              </div>
            )}
            <video ref={videoRef} autoPlay playsInline className={`absolute inset-0 w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`} />
            {cameraActive && (
              <>
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>Live
                </div>
                <div className="absolute inset-8 border-2 border-dashed border-white/70 rounded-lg pointer-events-none"></div>
              </>
            )}
          </div>
          <div className="flex justify-center gap-3 mt-4">
            <button onClick={cameraActive ? stopCamera : startCamera} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors">
              {cameraActive ? 'Stop Camera' : 'Initialize Scanner'}
            </button>
            <button onClick={captureFrame} disabled={!cameraActive} className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center gap-2">
              <Camera size={16} /> Capture Document Frame
            </button>
          </div>
        </section>

        {queue.length > 0 && (
          <section className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <h2 className="font-semibold text-lg text-slate-800">PDF Pages <span className="text-sky-600 text-sm font-normal">({queue.length})</span></h2>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setShowCollage(true)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md flex items-center gap-1.5"><LayoutGrid size={13} /> Collage</button>
                <button onClick={() => setShowPreview(true)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md flex items-center gap-1.5"><Eye size={13} /> Preview</button>
                <button onClick={runBatchOcr} disabled={batchOcrRunning} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md flex items-center gap-1.5 disabled:opacity-50">
                  {batchOcrRunning ? <Loader2 size={13} className="animate-spin" /> : <FileSearch size={13} />}
                  {batchOcrRunning ? 'Reading all pages...' : 'Extract Text from All'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {queue.map((item, index) => (
                <div key={item.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-lg transition-shadow relative bg-slate-50/50">
                  <span className="absolute top-2 left-2 bg-slate-800/80 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{index + 1}</span>
                  <button onClick={() => removeFile(item.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50">
                    <X size={14} />
                  </button>
                  <img src={item.previewUrl} alt={item.name} className="w-full h-32 object-cover rounded-lg mb-2 bg-slate-100 mt-2" />
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-slate-400 mb-2">{formatBytes(item.originalSize)}</p>

                  {item.status === 'processing' && (
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2"><div className="h-full bg-sky-500 animate-pulse w-2/3"></div></div>
                  )}

                  <div className="flex gap-1.5 mb-2">
                    <button onClick={() => moveItem(item.id, -1)} disabled={index === 0} className="flex-1 text-xs bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-md py-1.5 flex items-center justify-center"><ArrowUp size={13} /></button>
                    <button onClick={() => moveItem(item.id, 1)} disabled={index === queue.length - 1} className="flex-1 text-xs bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-md py-1.5 flex items-center justify-center"><ArrowDown size={13} /></button>
                    <button onClick={() => rotateItem(item.id)} className="flex-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-md py-1.5 flex items-center justify-center"><RotateCw size={13} /></button>
                    <button onClick={() => setCropItemId(item.id)} className="flex-1 text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-md py-1.5 flex items-center justify-center"><Crop size={13} /></button>
                  </div>

                  <select value={item.tier} onChange={(e) => updateItem(item.id, { tier: e.target.value })} className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 mb-2 focus:outline-none focus:ring-2 focus:ring-sky-300">
                    {Object.entries(TIER_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                  </select>

                  {item.tier === 'custom' && (
                    <div className="mb-2">
                      <label className="text-xs text-slate-500">
                        Quality: <b>{Math.round(item.customQuality * 100)}%</b>
                        <input type="range" min="0.1" max="1" step="0.05" value={item.customQuality} onChange={(e) => updateItem(item.id, { customQuality: parseFloat(e.target.value) })} className="w-full" />
                      </label>
                    </div>
                  )}

                  {item.savedPercent !== null && (
                    <span className="inline-block text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded-full mb-2">Saved {item.savedPercent}%</span>
                  )}

                  <div className="flex gap-1.5 mb-2">
                    <select value={item.downloadFormat} onChange={(e) => updateItem(item.id, { downloadFormat: e.target.value })} className="flex-1 text-xs border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-300">
                      {FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                    </select>
                    <button onClick={() => downloadSingle(item)} className="bg-sky-600 hover:bg-sky-700 text-white text-xs px-3 rounded-md flex items-center gap-1"><Download size={13} /></button>
                  </div>

                  <button onClick={() => runOcr(item.id)} disabled={item.ocrLoading} className="w-full text-xs bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-md py-1.5 font-medium flex items-center justify-center gap-1.5">
                    {item.ocrLoading ? <Loader2 size={13} className="animate-spin" /> : <ScanText size={13} />}
                    {item.ocrLoading ? 'Reading text...' : 'Extract Text'}
                  </button>

                  {item.ocrText && (
                    <div className="mt-2">
                      <textarea readOnly value={item.ocrText} className="w-full text-xs border border-slate-200 rounded-md p-2 h-20 font-mono" />
                      <button onClick={() => copyToClipboard(item.ocrText)} className="mt-1 w-full text-xs bg-slate-100 hover:bg-slate-200 rounded-md py-1 flex items-center justify-center gap-1.5"><Copy size={12} /> Copy Text</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {summary && (
          <section className="bg-white rounded-2xl shadow-md p-6 text-sm text-slate-600">
            <p>Combined {queue.length} file(s): {formatBytes(summary.totalOriginal)} → {formatBytes(summary.totalCompressed)} (<span className="text-green-600 font-semibold">{summary.savedPercent}% saved</span>)</p>
          </section>
        )}
      </main>

      {queue.length > 0 && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-2xl">
          <div className="max-w-5xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-4 items-center text-sm text-slate-600">
              <div><span className="font-semibold text-slate-900">{queue.length}</span> files</div>
              <div><span className="font-semibold text-slate-900">{formatBytes(totalSize)}</span> total</div>
              {summary && <div><span className="font-semibold text-green-600">{summary.savedPercent}%</span> saved</div>}
              <input type="text" value={pdfFilename} onChange={(e) => setPdfFilename(e.target.value)} placeholder="filename" className="text-xs border border-slate-200 rounded-md px-2 py-1.5 w-28 focus:outline-none focus:ring-2 focus:ring-sky-300" />
            </div>
            <button onClick={processAll} disabled={processing} className="px-6 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold flex items-center gap-2">
              {processing && <Loader2 size={16} className="animate-spin" />}
              {processing ? 'Processing...' : 'Combine All → PDF'}
            </button>
          </div>
        </footer>
      )}

      {cropItem && <CropModal item={cropItem} onCancel={() => setCropItemId(null)} onApply={applyCrop} />}
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

      <div className="fixed top-4 right-4 space-y-2 z-50">
        {toasts.map((t) => (
          <div key={t.id} className={`px-4 py-3 rounded-lg shadow-md text-sm font-medium text-white ${t.type === 'error' ? 'bg-red-500' : 'bg-slate-800'}`}>{t.message}</div>
        ))}
      </div>
    </div>
  )
}

export default App