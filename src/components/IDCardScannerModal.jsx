import { useState, useRef } from 'react'
import {
  X, CreditCard, Camera, Upload, Check, RotateCw, Sparkles, Layers, AlertCircle
} from 'lucide-react'

export function IDCardScannerModal({ onCancel, onApplyIDCard }) {
  const [frontImage, setFrontImage] = useState(null)
  const [backImage, setBackImage] = useState(null)
  const [activeStep, setActiveStep] = useState('front') // 'front' | 'back' | 'preview'
  const [cameraActive, setCameraActive] = useState(false)
  const [addLabels, setAddLabels] = useState(true)

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setCameraActive(true)
      }
    } catch (e) {
      alert('Camera access denied: ' + e.message)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  const captureCard = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95)

    if (activeStep === 'front') {
      setFrontImage(dataUrl)
      setActiveStep('back')
    } else if (activeStep === 'back') {
      setBackImage(dataUrl)
      setActiveStep('preview')
      stopCamera()
    }
  }

  const handleFileUpload = (e, side) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (side === 'front') {
        setFrontImage(reader.result)
        if (!backImage) setActiveStep('back')
      } else {
        setBackImage(reader.result)
        if (frontImage) setActiveStep('preview')
      }
    }
    reader.readAsDataURL(file)
  }

  const generateCombinedA4 = async () => {
    if (!frontImage || !backImage) return

    // Standard A4 aspect ratio at print resolution: 1240 x 1754 px
    const canvas = document.createElement('canvas')
    canvas.width = 1240
    canvas.height = 1754
    const ctx = canvas.getContext('2d')

    // Clean white background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Load images
    const loadImg = (src) =>
      new Promise((res) => {
        const img = new Image()
        img.onload = () => res(img)
        img.src = src
      })

    const front = await loadImg(frontImage)
    const back = await loadImg(backImage)

    // Standard ID Card size on canvas (approx 85mm x 54mm equivalent)
    const cardW = 860
    const cardH = 540
    const marginX = (canvas.width - cardW) / 2

    // Front card placement (top half)
    const frontY = 220
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 4
    ctx.fillStyle = '#f8fafc'
    ctx.roundRect ? ctx.roundRect(marginX, frontY, cardW, cardH, 20) : ctx.rect(marginX, frontY, cardW, cardH)
    ctx.fill()
    ctx.clip()
    ctx.drawImage(front, marginX, frontY, cardW, cardH)
    ctx.restore()

    // Front card border
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 2
    ctx.strokeRect(marginX, frontY, cardW, cardH)

    if (addLabels) {
      ctx.fillStyle = '#64748b'
      ctx.font = 'bold 22px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('FRONT SIDE', canvas.width / 2, frontY - 20)
    }

    // Back card placement (bottom half)
    const backY = 940
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 4
    ctx.fillStyle = '#f8fafc'
    ctx.roundRect ? ctx.roundRect(marginX, backY, cardW, cardH, 20) : ctx.rect(marginX, backY, cardW, cardH)
    ctx.fill()
    ctx.clip()
    ctx.drawImage(back, marginX, backY, cardW, cardH)
    ctx.restore()

    // Back card border
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 2
    ctx.strokeRect(marginX, backY, cardW, cardH)

    if (addLabels) {
      ctx.fillStyle = '#64748b'
      ctx.font = 'bold 22px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('BACK SIDE', canvas.width / 2, backY - 20)
    }

    // Subtle divider guideline in the middle
    ctx.strokeStyle = '#e2e8f0'
    ctx.setLineDash([8, 8])
    ctx.beginPath()
    ctx.moveTo(100, (frontY + cardH + backY) / 2)
    ctx.lineTo(canvas.width - 100, (frontY + cardH + backY) / 2)
    ctx.stroke()
    ctx.setLineDash([])

    // Watermark / footer info
    ctx.fillStyle = '#94a3b8'
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Scanned with KamalScan ID Mode', canvas.width / 2, canvas.height - 40)

    const finalDataUrl = canvas.toDataURL('image/jpeg', 0.92)
    onApplyIDCard(finalDataUrl)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">ID Card Dual-Side Mode</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Merges Front &amp; Back onto a single A4 page</p>
            </div>
          </div>
          <button onClick={() => { stopCamera(); onCancel() }} className="text-slate-400 hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/70 border-b border-slate-100 dark:border-slate-800 flex items-center justify-around text-xs">
          <button
            onClick={() => setActiveStep('front')}
            className={`flex items-center gap-1.5 font-semibold ${
              activeStep === 'front' ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              frontImage ? 'bg-emerald-500 text-white' : activeStep === 'front' ? 'bg-sky-600 text-white' : 'bg-slate-200 dark:bg-slate-800'
            }`}>
              {frontImage ? '✓' : '1'}
            </span>
            Front Side
          </button>

          <span className="text-slate-300">→</span>

          <button
            onClick={() => setActiveStep('back')}
            className={`flex items-center gap-1.5 font-semibold ${
              activeStep === 'back' ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              backImage ? 'bg-emerald-500 text-white' : activeStep === 'back' ? 'bg-sky-600 text-white' : 'bg-slate-200 dark:bg-slate-800'
            }`}>
              {backImage ? '✓' : '2'}
            </span>
            Back Side
          </button>

          <span className="text-slate-300">→</span>

          <button
            onClick={() => { if (frontImage && backImage) setActiveStep('preview') }}
            disabled={!frontImage || !backImage}
            className={`flex items-center gap-1.5 font-semibold disabled:opacity-40 ${
              activeStep === 'preview' ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              activeStep === 'preview' ? 'bg-sky-600 text-white' : 'bg-slate-200 dark:bg-slate-800'
            }`}>
              3
            </span>
            Combine A4
          </button>
        </div>

        {/* Content body */}
        <div className="p-4 space-y-4">
          {activeStep !== 'preview' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>
                  Capture <b>{activeStep === 'front' ? 'FRONT Side' : 'BACK Side'}</b> of Card:
                </span>
                <span className="text-slate-400 text-[11px]">Aspect Ratio ~1.6 : 1</span>
              </div>

              {/* Viewport / Card outline */}
              <div className="relative aspect-[16/10] w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center border-2 border-slate-700 shadow-inner">
                {cameraActive ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute inset-4 border-2 border-dashed border-sky-400/80 rounded-xl pointer-events-none" />
                  </>
                ) : (
                  <div className="text-center p-6 text-slate-400">
                    <CreditCard size={40} className="mx-auto mb-2 text-slate-500" />
                    <p className="text-xs">Camera preview inactive</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-center">
                <button
                  onClick={cameraActive ? stopCamera : startCamera}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                >
                  {cameraActive ? 'Stop Camera' : 'Start Camera'}
                </button>
                <button
                  onClick={captureCard}
                  disabled={!cameraActive}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white shadow-xs flex items-center gap-1.5"
                >
                  <Camera size={14} /> Capture {activeStep === 'front' ? 'Front' : 'Back'}
                </button>
                <label className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer flex items-center gap-1.5">
                  <Upload size={14} /> Upload File
                  <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, activeStep)} className="hidden" />
                </label>
              </div>

              {/* Mini thumbnails of both sides */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className={`p-2 rounded-xl border text-center ${frontImage ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                  <p className="text-[10px] font-bold text-slate-500 mb-1">FRONT SIDE</p>
                  {frontImage ? (
                    <img src={frontImage} alt="Front" className="h-16 w-full object-cover rounded-md" />
                  ) : (
                    <span className="text-[10px] text-slate-400">Not captured yet</span>
                  )}
                </div>

                <div className={`p-2 rounded-xl border text-center ${backImage ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                  <p className="text-[10px] font-bold text-slate-500 mb-1">BACK SIDE</p>
                  {backImage ? (
                    <img src={backImage} alt="Back" className="h-16 w-full object-cover rounded-md" />
                  ) : (
                    <span className="text-[10px] text-slate-400">Not captured yet</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Step 3: Combined A4 preview */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  A4 Merged Preview (Top: Front, Bottom: Back)
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-500">
                  <input type="checkbox" checked={addLabels} onChange={(e) => setAddLabels(e.target.checked)} className="rounded text-sky-600" />
                  Include Labels
                </label>
              </div>

              {/* Vertical Sheet Mockup */}
              <div className="bg-slate-200 dark:bg-slate-950 p-4 rounded-xl flex items-center justify-center">
                <div className="bg-white text-slate-900 rounded-lg shadow-xl p-3 w-48 aspect-[1/1.414] flex flex-col justify-around items-center border border-slate-300">
                  <div className="w-full text-center">
                    {addLabels && <p className="text-[7px] font-bold text-slate-400 uppercase">Front Side</p>}
                    <img src={frontImage} alt="Front" className="w-full h-12 object-cover rounded-xs border border-slate-200 shadow-2xs" />
                  </div>
                  <div className="w-full border-t border-dashed border-slate-300" />
                  <div className="w-full text-center">
                    {addLabels && <p className="text-[7px] font-bold text-slate-400 uppercase">Back Side</p>}
                    <img src={backImage} alt="Back" className="w-full h-12 object-cover rounded-xs border border-slate-200 shadow-2xs" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex gap-2">
          <button
            onClick={() => { stopCamera(); onCancel() }}
            className="flex-1 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          >
            Cancel
          </button>
          {activeStep === 'preview' ? (
            <button
              onClick={generateCombinedA4}
              className="flex-1 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white shadow-md flex items-center justify-center gap-1.5"
            >
              <Check size={14} /> Add 1-Page ID to Queue
            </button>
          ) : (
            <button
              onClick={() => {
                if (frontImage && backImage) {
                  stopCamera()
                  setActiveStep('preview')
                } else if (activeStep === 'front' && frontImage) {
                  setActiveStep('back')
                }
              }}
              disabled={activeStep === 'front' ? !frontImage : !backImage}
              className="flex-1 py-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white shadow-xs flex items-center justify-center gap-1.5"
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
