import { useState, useRef, useEffect } from 'react'
import {
  X, Check, RotateCcw, PenTool, Type, Download, Plus, Stamp,
  Layers, CheckCircle2, ChevronDown, Sparkles, ShieldCheck
} from 'lucide-react'

const OFFICIAL_STAMPS = [
  { id: 'APPROVED', label: 'APPROVED', color: '#059669', subtext: 'VERIFIED & PASSED', angle: -8 },
  { id: 'CONFIDENTIAL', label: 'CONFIDENTIAL', color: '#dc2626', subtext: 'RESTRICTED ACCESS', angle: -10 },
  { id: 'VERIFIED', label: 'VERIFIED', color: '#2563eb', subtext: 'ATTESTED AUTHENTIC', angle: 0 },
  { id: 'PAID', label: 'PAID IN FULL', color: '#d97706', subtext: 'PAYMENT CLEARED', angle: -12 },
  { id: 'OFFICIAL', label: 'OFFICIAL SEAL', color: '#7c3aed', subtext: 'CERTIFIED COPY', angle: -6 },
]

export function SignatureModal({
  isOpen = true,
  onCancel,
  queuePages = [],
  initialTargetId = null,
  onApplySignature,
  onSaveAsNewPage,
}) {
  const canvasRef = useRef(null)
  const [mode, setMode] = useState('draw') // 'draw' | 'type' | 'stamp'
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [color, setColor] = useState('#0f172a') // Black ink
  const [lineWidth, setLineWidth] = useState(3)

  // Type mode state
  const [typedName, setTypedName] = useState('Kamal Raj')
  const [fontFamily, setFontFamily] = useState('cursive') // 'cursive' | 'brush' | 'serif' | 'casual'

  // Stamp mode state
  const [stampPreset, setStampPreset] = useState('APPROVED')
  const [stampCustomText, setStampCustomText] = useState('')
  const [stampAngle, setStampAngle] = useState(-8)

  // Stamping options
  const [targetPageId, setTargetPageId] = useState(
    initialTargetId || (queuePages.length > 0 ? queuePages[0].id : '')
  )
  const [stampPosition, setStampPosition] = useState('bottom-right') // 'bottom-right' | 'bottom-left' | 'center'

  useEffect(() => {
    if (initialTargetId) {
      setTargetPageId(initialTargetId)
    } else if (queuePages.length > 0 && !targetPageId) {
      setTargetPageId(queuePages[0].id)
    }
  }, [initialTargetId, queuePages])

  // Setup drawing canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (mode === 'type') {
      renderTypedSignature()
    } else if (mode === 'stamp') {
      renderOfficialStamp()
    }
  }, [mode, typedName, fontFamily, color, stampPreset, stampCustomText, stampAngle])

  const renderTypedSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!typedName.trim()) {
      setHasDrawn(false)
      return
    }

    ctx.save()
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    let fontStyle = 'italic 52px "Brush Script MT", "Caveat", "Segoe Script", cursive'
    if (fontFamily === 'serif') {
      fontStyle = 'italic 46px "Times New Roman", "Playfair Display", Georgia, serif'
    } else if (fontFamily === 'casual') {
      fontStyle = 'italic 50px "Comic Sans MS", "Caveat", cursive'
    } else if (fontFamily === 'cursive') {
      fontStyle = 'italic 54px "Dancing Script", "Lucida Handwriting", cursive'
    }

    ctx.font = fontStyle
    ctx.fillText(typedName, canvas.width / 2, canvas.height / 2 - 8)

    // Subtle signature flourish underline
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    const textWidth = ctx.measureText(typedName).width
    const startX = (canvas.width - textWidth) / 2
    const endX = startX + textWidth
    const y = canvas.height / 2 + 32
    ctx.moveTo(startX, y)
    ctx.bezierCurveTo(startX + textWidth * 0.4, y + 10, startX + textWidth * 0.7, y - 5, endX + 15, y)
    ctx.stroke()

    ctx.restore()
    setHasDrawn(true)
  }

  const renderOfficialStamp = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const preset = OFFICIAL_STAMPS.find((s) => s.id === stampPreset) || OFFICIAL_STAMPS[0]
    const effectiveColor = color !== '#0f172a' ? color : preset.color
    const effectiveText = stampCustomText.trim() || preset.label

    ctx.save()
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((stampAngle * Math.PI) / 180)

    const w = 440
    const h = 145
    const r = 14

    // Outer double border
    ctx.strokeStyle = effectiveColor
    ctx.lineWidth = 4.5
    ctx.beginPath()
    ctx.roundRect(-w / 2, -h / 2, w, h, r)
    ctx.stroke()

    // Inner inset border
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, r - 3)
    ctx.stroke()

    // Main Stamp Headline
    ctx.fillStyle = effectiveColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '900 36px Impact, Arial Black, sans-serif'
    ctx.fillText(effectiveText, 0, -18)

    // Divider Line
    ctx.beginPath()
    ctx.lineWidth = 2
    ctx.moveTo(-w / 2 + 25, 14)
    ctx.lineTo(w / 2 - 25, 14)
    ctx.stroke()

    // Subtext & Date
    ctx.font = '700 13px monospace, sans-serif'
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
    ctx.fillText(`${preset.subtext} • ${today}`, 0, 36)

    ctx.restore()
    setHasDrawn(true)
  }

  const getCoordinates = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const startDrawing = (e) => {
    if (mode !== 'draw') return
    e.preventDefault()
    setIsDrawing(true)
    setHasDrawn(true)
    const { x, y } = getCoordinates(e)
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
  }

  const draw = (e) => {
    if (!isDrawing || mode !== 'draw') return
    e.preventDefault()
    const { x, y } = getCoordinates(e)
    const ctx = canvasRef.current.getContext('2d')
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  const handleApply = () => {
    if (!hasDrawn || !canvasRef.current) return
    const dataUrl = canvasRef.current.toDataURL('image/png')
    onApplySignature(dataUrl, targetPageId, stampPosition)
  }

  const handleSaveAsPage = () => {
    if (!hasDrawn || !canvasRef.current) return
    const dataUrl = canvasRef.current.toDataURL('image/png')
    onSaveAsNewPage(dataUrl)
  }

  const handleExportPNG = () => {
    if (!hasDrawn || !canvasRef.current) return
    const dataUrl = canvasRef.current.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `kamalscan-${mode === 'stamp' ? 'stamp' : 'signature'}-${Date.now()}.png`
    a.click()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800">
              <PenTool size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Digital E-Signature &amp; Stamp Studio
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Draw, type cursive signature, stamp official seals, or export transparent PNG
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Mode Switcher Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => {
                setMode('draw')
                clearCanvas()
              }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'draw'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <PenTool size={14} /> Draw by Hand
            </button>
            <button
              onClick={() => {
                setMode('type')
              }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'type'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Type size={14} /> Type Calligraphy
            </button>
            <button
              onClick={() => {
                setMode('stamp')
              }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'stamp'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Stamp size={14} /> Official Stamps
            </button>
          </div>

          {/* Type Mode Controls */}
          {mode === 'type' && (
            <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Type Your Full Name / Signature Text:
                </label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="e.g. Kamal Raj"
                  className="w-full text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Calligraphy Style:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'cursive', label: 'Dancing Script' },
                    { id: 'brush', label: 'Brush Casual' },
                    { id: 'serif', label: 'Formal Serif' },
                    { id: 'casual', label: 'Natural Flow' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFontFamily(f.id)}
                      className={`px-2 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer truncate ${
                        fontFamily === f.id
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Official Stamp Mode Controls */}
          {mode === 'stamp' && (
            <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Choose Official Preset:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {OFFICIAL_STAMPS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setStampPreset(s.id)
                        setColor(s.color)
                        setStampAngle(s.angle)
                      }}
                      className={`px-2 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                        stampPreset === s.id
                          ? 'bg-white dark:bg-slate-900 shadow-sm border-2'
                          : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100'
                      }`}
                      style={{ borderColor: stampPreset === s.id ? s.color : undefined }}
                    >
                      <span style={{ color: s.color }}>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    Custom Stamp Text (Optional):
                  </label>
                  <input
                    type="text"
                    value={stampCustomText}
                    onChange={(e) => setStampCustomText(e.target.value)}
                    placeholder={`Default: ${stampPreset}`}
                    className="w-full text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    Angle / Tilt:
                  </label>
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    {[-12, -8, 0, 8].map((ang) => (
                      <button
                        key={ang}
                        onClick={() => setStampAngle(ang)}
                        className={`px-1.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                          stampAngle === ang ? 'bg-emerald-600 text-white' : 'text-slate-500'
                        }`}
                      >
                        {ang}°
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Signature / Stamp Canvas Box */}
          <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-950 overflow-hidden touch-none select-none shadow-inner">
            <canvas
              ref={canvasRef}
              width={640}
              height={240}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-44 cursor-crosshair block"
            />
            {!hasDrawn && mode === 'draw' && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-1">
                <PenTool size={22} className="opacity-40" />
                <span className="text-xs font-medium">Sign with your finger or stylus inside this box</span>
              </div>
            )}
            <div className="absolute bottom-3 left-6 right-6 border-b border-dashed border-slate-200 dark:border-slate-800 pointer-events-none flex justify-between text-[10px] text-slate-400 pb-0.5">
              <span>✕ Document placement target</span>
              <span>100% vector-sharp</span>
            </div>
          </div>

          {/* Ink & Color Settings */}
          <div className="flex items-center justify-between gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Color:</span>
              {[
                { name: 'Pitch Black', hex: '#0f172a' },
                { name: 'Royal Blue', hex: '#1d4ed8' },
                { name: 'Emerald Green', hex: '#059669' },
                { name: 'Ruby Red', hex: '#dc2626' },
                { name: 'Amber Gold', hex: '#d97706' },
                { name: 'Royal Purple', hex: '#7c3aed' },
              ].map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                    color === c.hex ? 'scale-115 border-sky-500 shadow-md ring-2 ring-sky-300/40' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              ))}
            </div>

            {mode === 'draw' && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Thickness:</span>
                {[
                  { w: 2, label: 'Fine' },
                  { w: 3, label: 'Medium' },
                  { w: 5, label: 'Bold' },
                ].map((item) => (
                  <button
                    key={item.w}
                    onClick={() => setLineWidth(item.w)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      lineWidth === item.w
                        ? 'bg-sky-100 dark:bg-sky-950 border-sky-400 text-sky-700 dark:text-sky-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  onClick={clearCanvas}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                  title="Clear & Reset"
                >
                  <RotateCcw size={15} />
                </button>
              </div>
            )}
          </div>

          {/* Stamping Options (Page Selection & Corner Position) */}
          {queuePages.length > 0 && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Stamp size={14} className="text-sky-600" /> Apply to Page:
                </span>
                <span className="text-[10px] text-slate-400">{queuePages.length} pages in scanner</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Page Dropdown */}
                <div>
                  <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                    Target Page:
                  </label>
                  <select
                    value={targetPageId}
                    onChange={(e) => setTargetPageId(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-400 cursor-pointer"
                  >
                    {queuePages.map((p, idx) => (
                      <option key={p.id} value={p.id}>
                        Page {idx + 1}: {p.name.slice(0, 24)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Position Options */}
                <div>
                  <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                    Placement Position:
                  </label>
                  <div className="flex gap-1.5">
                    {[
                      { id: 'bottom-right', label: 'Bottom Right' },
                      { id: 'bottom-left', label: 'Bottom Left' },
                      { id: 'center', label: 'Center' },
                    ].map((pos) => (
                      <button
                        key={pos.id}
                        onClick={() => setStampPosition(pos.id)}
                        className={`flex-1 py-1 rounded-xl text-[10px] font-semibold border transition-all cursor-pointer ${
                          stampPosition === pos.id
                            ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={handleExportPNG}
            disabled={!hasDrawn}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
            title="Download transparent PNG stamp"
          >
            <Download size={14} /> Transparent PNG
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAsPage}
              disabled={!hasDrawn}
              className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
            >
              <Plus size={14} /> Add as New Page
            </button>

            {queuePages.length > 0 && (
              <button
                onClick={handleApply}
                disabled={!hasDrawn || !targetPageId}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-98 disabled:opacity-40 cursor-pointer"
              >
                <Check size={14} /> Stamp on Page
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
