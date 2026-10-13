import { useState, useRef, useEffect } from 'react'
import { X, Check, RotateCcw, PenTool, Sparkles } from 'lucide-react'

export function SignatureModal({ onCancel, onApplySignature }) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [color, setColor] = useState('#0f172a') // Black ink
  const [lineWidth, setLineWidth] = useState(3)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

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
    if (!isDrawing) return
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
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  const handleApply = () => {
    if (!hasDrawn) return
    const canvas = canvasRef.current
    const signatureDataUrl = canvas.toDataURL('image/png')
    onApplySignature(signatureDataUrl)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-slide-in">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
              <PenTool size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm">Draw Digital Signature</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Use finger or mouse to sign document</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Drawing Canvas */}
          <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 overflow-hidden touch-none select-none">
            <canvas
              ref={canvasRef}
              width={600}
              height={260}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-44 cursor-crosshair block"
            />
            {!hasDrawn && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 dark:text-slate-700 text-xs font-medium">
                Sign inside this box
              </div>
            )}
            <div className="absolute bottom-2 left-4 right-4 border-b border-slate-200 dark:border-slate-800 pointer-events-none"></div>
          </div>

          {/* Controls: Ink color & thickness */}
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Ink:</span>
              {[
                { name: 'Black', hex: '#0f172a' },
                { name: 'Blue', hex: '#1d4ed8' },
                { name: 'Dark Blue', hex: '#0e3a6c' },
                { name: 'Red', hex: '#dc2626' },
              ].map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    color === c.hex ? 'scale-110 border-sky-500 shadow-xs' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Pen:</span>
              {[2, 3, 5].map((w) => (
                <button
                  key={w}
                  onClick={() => setLineWidth(w)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                    lineWidth === w
                      ? 'bg-sky-100 dark:bg-sky-900 border-sky-400 text-sky-700 dark:text-sky-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {w === 2 ? 'Fine' : w === 3 ? 'Medium' : 'Thick'}
                </button>
              ))}
              <button
                onClick={clearCanvas}
                className="p-1 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                title="Clear Signature"
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!hasDrawn}
            className="flex-1 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 disabled:opacity-40 text-white shadow-sm flex items-center justify-center gap-1.5"
          >
            <Check size={14} /> Stamp on Document
          </button>
        </div>
      </div>
    </div>
  )
}
