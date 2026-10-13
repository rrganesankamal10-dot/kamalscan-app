import { useState, useRef, useEffect } from 'react'
import {
  X, QrCode, Camera, Upload, Copy, ExternalLink, Check, RefreshCw, AlertCircle
} from 'lucide-react'
import jsQR from 'jsqr'

export function QRBarcodeScannerModal({ onCancel, onInsertToNotes }) {
  const [activeTab, setActiveTab] = useState('camera') // 'camera' | 'file'
  const [result, setResult] = useState(null) // { text, format }
  const [isScanning, setIsScanning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const animFrameRef = useRef(null)

  // Start / stop camera
  useEffect(() => {
    if (activeTab === 'camera') {
      startCameraScan()
    } else {
      stopCameraScan()
    }
    return () => {
      stopCameraScan()
    }
  }, [activeTab])

  const startCameraScan = async () => {
    setErrorMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setIsScanning(true)
        scanVideoFrame()
      }
    } catch (err) {
      setErrorMsg('Unable to access camera: ' + err.message)
      setIsScanning(false)
    }
  }

  const stopCameraScan = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsScanning(false)
  }

  const scanVideoFrame = () => {
    const video = videoRef.current
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanVideoFrame)
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Decode with jsQR
    const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    })

    if (qrCode && qrCode.data) {
      playBeepSound()
      setResult({ text: qrCode.data, format: 'QR Code' })
      stopCameraScan()
      return
    }

    // Continue scanning next frame
    animFrameRef.current = requestAnimationFrame(scanVideoFrame)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErrorMsg('')
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0)
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const qrCode = jsQR(imgData.data, imgData.width, imgData.height)
        if (qrCode && qrCode.data) {
          playBeepSound()
          setResult({ text: qrCode.data, format: 'QR Code' })
        } else {
          setErrorMsg('No QR code or barcode detected in this image.')
        }
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  }

  const playBeepSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(1000, ctx.currentTime)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
      osc.start()
      osc.stop(ctx.currentTime + 0.15)
    } catch (e) {}
  }

  const copyResult = () => {
    if (!result?.text) return
    navigator.clipboard.writeText(result.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isUrl = result?.text && (result.text.startsWith('http://') || result.text.startsWith('https://'))

  const resetScan = () => {
    setResult(null)
    setErrorMsg('')
    if (activeTab === 'camera') startCameraScan()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400">
              <QrCode size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">QR &amp; Barcode Scanner</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">100% Offline Optical Recognition</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        {/* Tab switch: Camera vs Image File */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold">
          <button
            onClick={() => { setActiveTab('camera'); setResult(null) }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'camera'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 border-b-2 border-sky-600'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Camera size={14} /> Live Camera
          </button>
          <button
            onClick={() => { setActiveTab('file'); setResult(null) }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'file'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 border-b-2 border-sky-600'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Upload size={14} /> Scan from Image File
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 space-y-3">
          {activeTab === 'camera' && !result && (
            <div className="relative w-full aspect-square max-w-xs mx-auto rounded-xl overflow-hidden bg-black flex items-center justify-center">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              {/* Target Aiming Reticle */}
              <div className="absolute inset-8 border-2 border-dashed border-cyan-400/80 rounded-2xl pointer-events-none flex items-center justify-center">
                <div className="w-full h-0.5 bg-cyan-400/70 shadow-sm animate-pulse" />
              </div>
              <div className="absolute bottom-2 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded-full">
                Align QR or Barcode inside box
              </div>
            </div>
          )}

          {activeTab === 'file' && !result && (
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center bg-slate-50 dark:bg-slate-950">
              <QrCode size={36} className="mx-auto mb-2 text-slate-400" />
              <p className="text-xs font-semibold mb-1">Select an image with a QR code</p>
              <p className="text-[11px] text-slate-400 mb-3">JPEG, PNG, WEBP supported</p>
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl cursor-pointer shadow-xs">
                <Upload size={13} /> Choose Image
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          )}

          {/* Error notice */}
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Decoded Result Box */}
          {result && (
            <div className="space-y-3 bg-sky-50/60 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900 px-2 py-0.5 rounded-md">
                  {result.format} Detected
                </span>
                <button
                  onClick={resetScan}
                  className="text-xs text-slate-500 hover:text-sky-600 flex items-center gap-1 font-medium"
                >
                  <RefreshCw size={12} /> Scan Another
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 font-mono text-xs text-slate-800 dark:text-slate-100 break-all select-all max-h-36 overflow-auto">
                {result.text}
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={copyResult}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  {copied ? 'Copied!' : 'Copy Content'}
                </button>

                {isUrl && (
                  <a
                    href={result.text}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <ExternalLink size={13} /> Open Link
                  </a>
                )}

                {onInsertToNotes && (
                  <button
                    onClick={() => onInsertToNotes(result.text)}
                    className="w-full py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    Add to Document Text
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
