import { useState, useRef, useEffect } from 'react'
import jsPDF from 'jspdf'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import Tesseract from 'tesseract.js'
import { FileText, UploadCloud, Camera, X, ScanText, Copy, Loader2 } from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const TIER_CONFIG = {
  lossless: { label: 'Lossless / High Quality', quality: 0.95, scale: 1 },
  balanced: { label: 'Balanced / Recommended', quality: 0.75, scale: 0.85 },
  max: { label: 'Max Compression', quality: 0.5, scale: 0.6 },
  custom: { label: 'Custom (manual)', quality: null, scale: 1 },
}
const MAX_TOTAL_MB = 50

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

function App() {
  const [queue, setQueue] = useState([])
  const [toasts, setToasts] = useState([])
  const [processing, setProcessing] = useState(false)
  const [summary, setSummary] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [dragOver, setDragOver] = useState(false)

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
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const addFilesToQueue = async (fileList) => {
    const files = Array.from(fileList)
    let runningTotal = queue.reduce((sum, f) => sum + f.originalSize, 0)
    const newItems = []

    for (const file of files) {
      const isImage = file.type.startsWith('image/')
      const isPdf = file.type === 'application/pdf'

      if (!isImage && !isPdf) {
        addToast(`Unsupported file type: ${file.name}`, 'error')
        continue
      }
      if (runningTotal + file.size > MAX_TOTAL_MB * 1024 * 1024) {
        addToast(`Batch limit of ${MAX_TOTAL_MB}MB exceeded — "${file.name}" skipped`, 'error')
        continue
      }
      runningTotal += file.size

      if (isImage) {
        newItems.push({
          id: crypto.randomUUID(),
          name: file.name,
          kind: 'image',
          previewUrl: URL.createObjectURL(file),
          originalSize: file.size,
          tier: 'balanced',
          customQuality: 0.8,
          status: 'ready',
          savedPercent: null,
          ocrText: '',
          ocrLoading: false,
        })
      } else {
        try {
          const pages = await renderPdfPagesToImages(file)
          pages.forEach((dataUrl, idx) => {
            newItems.push({
              id: crypto.randomUUID(),
              name: `${file.name} (page ${idx + 1})`,
              kind: 'pdf-page',
              previewUrl: dataUrl,
              originalSize: estimateDataUrlSize(dataUrl),
              tier: 'balanced',
              customQuality: 0.8,
              status: 'ready',
              savedPercent: null,
              ocrText: '',
              ocrLoading: false,
            })
          })
        } catch (err) {
          addToast(`Could not read "${file.name}"`, 'error')
        }
      }
    }

    setQueue((prev) => [...prev, ...newItems])
    if (newItems.length) addToast(`${newItems.length} file(s) added to queue`)
  }

  const removeFile = (id) => {
    setQueue((prev) => {
      const item = prev.find((f) => f.id === id)
      if (item && item.kind === 'image') URL.revokeObjectURL(item.previewUrl)
      return prev.filter((f) => f.id !== id)
    })
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    addFilesToQueue(e.dataTransfer.files)
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      setCameraActive(true)
    } catch (err) {
      addToast('Camera access denied: ' + err.message, 'error')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  const captureFrame = () => {
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/png')
    setQueue((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `scan-${Date.now()}.png`,
        kind: 'pdf-page',
        previewUrl: dataUrl,
        originalSize: estimateDataUrlSize(dataUrl),
        tier: 'balanced',
        customQuality: 0.8,
        status: 'ready',
        savedPercent: null,
        ocrText: '',
        ocrLoading: false,
      },
    ])
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    addToast('Text copied to clipboard')
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
      const compressedSize = blob.size
      totalOriginal += item.originalSize
      totalCompressed += compressedSize
      const savedPercent = Math.max(0, Math.round((1 - compressedSize / item.originalSize) * 100))
      updateItem(item.id, { status: 'done', savedPercent })

      const dataUrl = await blobToDataUrl(blob)
      const imgProps = pdf.getImageProperties(dataUrl)
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
      if (i > 0) pdf.addPage()
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight)
    }

    pdf.save('kamalscan-output.pdf')
    setSummary({
      totalOriginal,
      totalCompressed,
      savedPercent: Math.round((1 - totalCompressed / totalOriginal) * 100),
    })
    setProcessing(false)
    addToast('All files processed and combined into one PDF')
  }

  const totalSize = queue.reduce((sum, f) => sum + f.originalSize, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-cyan-50 to-blue-100 text-slate-800 pb-28">
      {/* Header */}
      <header className="max-w-5xl mx-auto px-6 pt-10 pb-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="bg-sky-600 text-white p-2 rounded-xl shadow-sm">
              <FileText size={22} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">KamalScan</h1>
          </div>
          <span className="text-xs font-semibold bg-sky-100 text-sky-700 px-3 py-1.5 rounded-full">
            Client-Side Secure
          </span>
        </div>
        <p className="text-slate-500 text-sm mt-2">
          Scan, convert, compress, and extract text — 100% locally in your browser.
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-6 space-y-6">
        {/* Dropzone */}
        <section
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-12 text-center transition-colors shadow-sm ${
            dragOver ? 'border-sky-400 bg-sky-50' : 'border-slate-300 bg-white'
          }`}
        >
          <div className="flex justify-center mb-4">
            <div className="bg-sky-100 text-sky-600 p-4 rounded-full">
              <UploadCloud size={32} />
            </div>
          </div>
          <label className="inline-block cursor-pointer bg-sky-600 hover:bg-sky-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors focus-within:ring-2 focus-within:ring-sky-400 shadow-sm">
            Browse Files
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => addFilesToQueue(e.target.files)}
            />
          </label>
          <p className="text-sm text-slate-500 mt-3">or drag &amp; drop images and PDFs here</p>
          <p className="text-xs text-slate-400 mt-1">Supports up to {MAX_TOTAL_MB}MB per batch</p>
        </section>

        {/* Camera Scanner */}
        <section className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2 text-slate-800">
            <Camera size={20} className="text-sky-600" /> Scanner
          </h2>

          <div className="relative w-full max-w-md mx-auto aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
            {!cameraActive && (
              <div className="text-center text-slate-400 px-6">
                <Camera size={44} className="mx-auto mb-2 opacity-60" />
                <p className="text-sm">Camera preview inactive. Click "Initialize Scanner" to begin.</p>
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className={`absolute inset-0 w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
            />
            {cameraActive && (
              <>
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                  Live
                </div>
                <div className="absolute inset-6 border-2 border-dashed border-white/70 rounded-lg pointer-events-none"></div>
              </>
            )}
          </div>

          <div className="flex justify-center gap-3 mt-4">
            <button
              onClick={cameraActive ? stopCamera : startCamera}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {cameraActive ? 'Stop Camera' : 'Initialize Scanner'}
            </button>
            <button
              onClick={captureFrame}
              disabled={!cameraActive}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 flex items-center gap-2"
            >
              <Camera size={16} /> Capture Document Frame
            </button>
          </div>
        </section>

        {/* Queue Grid */}
        {queue.length > 0 && (
          <section className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="font-semibold text-lg mb-4 text-slate-800">
              Document Queue <span className="text-sky-600 text-sm font-normal">({queue.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {queue.map((item) => (
                <div key={item.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-lg transition-shadow relative bg-slate-50/50">
                  <button
                    onClick={() => removeFile(item.id)}
                    className="absolute top-2 right-2 text-slate-400 hover:text-red-500 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    <X size={14} />
                  </button>
                  <img src={item.previewUrl} alt={item.name} className="w-full h-32 object-cover rounded-lg mb-2 bg-slate-100" />
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-slate-400 mb-2">{formatBytes(item.originalSize)}</p>

                  {item.status === 'processing' && (
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-sky-500 animate-pulse w-2/3"></div>
                    </div>
                  )}

                  <select
                    value={item.tier}
                    onChange={(e) => updateItem(item.id, { tier: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 mb-2 focus:outline-none focus:ring-2 focus:ring-sky-300"
                  >
                    {Object.entries(TIER_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>

                  {item.tier === 'custom' && (
                    <div className="mb-2">
                      <label className="text-xs text-slate-500">
                        Quality: <b>{Math.round(item.customQuality * 100)}%</b>
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.05"
                          value={item.customQuality}
                          onChange={(e) => updateItem(item.id, { customQuality: parseFloat(e.target.value) })}
                          className="w-full"
                        />
                      </label>
                    </div>
                  )}

                  {item.savedPercent !== null && (
                    <span className="inline-block text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded-full mb-2">
                      Saved {item.savedPercent}%
                    </span>
                  )}

                  <button
                    onClick={() => runOcr(item.id)}
                    disabled={item.ocrLoading}
                    className="w-full text-xs bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-md py-1.5 font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    {item.ocrLoading ? <Loader2 size={13} className="animate-spin" /> : <ScanText size={13} />}
                    {item.ocrLoading ? 'Reading text...' : 'Extract Text'}
                  </button>

                  {item.ocrText && (
                    <div className="mt-2">
                      <textarea
                        readOnly
                        value={item.ocrText}
                        className="w-full text-xs border border-slate-200 rounded-md p-2 h-20 font-mono"
                      />
                      <button
                        onClick={() => copyToClipboard(item.ocrText)}
                        className="mt-1 w-full text-xs bg-slate-100 hover:bg-slate-200 rounded-md py-1 flex items-center justify-center gap-1.5"
                      >
                        <Copy size={12} /> Copy Text
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {summary && (
          <section className="bg-white rounded-2xl shadow-md p-6 text-sm text-slate-600">
            <p>
              Combined {queue.length} file(s): {formatBytes(summary.totalOriginal)} → {formatBytes(summary.totalCompressed)}
              {' '}(<span className="text-green-600 font-semibold">{summary.savedPercent}% saved</span>)
            </p>
          </section>
        )}
      </main>

      {/* Sticky Footer */}
      {queue.length > 0 && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-2xl">
          <div className="max-w-5xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-6 text-sm text-slate-600">
              <div><span className="font-semibold text-slate-900">{queue.length}</span> files queued</div>
              <div><span className="font-semibold text-slate-900">{formatBytes(totalSize)}</span> total size</div>
              {summary && (
                <div><span className="font-semibold text-green-600">{summary.savedPercent}%</span> saved</div>
              )}
            </div>
            <button
              onClick={processAll}
              disabled={processing}
              className="px-6 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              {processing && <Loader2 size={16} className="animate-spin" />}
              {processing ? 'Processing...' : 'Process All Files → PDF'}
            </button>
          </div>
        </footer>
      )}

      {/* Toasts */}
      <div className="fixed top-4 right-4 space-y-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-lg shadow-md text-sm font-medium text-white ${
              t.type === 'error' ? 'bg-red-500' : 'bg-slate-800'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App