import { useState, useRef, useEffect } from 'react'
import {
  X, FileText, Presentation, FileCode, ZoomIn, ZoomOut, Maximize2, Minimize2,
  ChevronLeft, ChevronRight, Download, Printer, Copy, Check, Upload,
  Layers, Loader2, Sparkles, AlertCircle, Eye, ArrowRight, RotateCw,
  Sun, Moon, BookOpen, PenTool, Image as ImageIcon, Search
} from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import { parseDocx, parsePptx, parsePlainText } from '../utils/documentParser'

export function UniversalDocViewerModal({ initialFile, onClose, onImportToQueue }) {
  const [fileData, setFileData] = useState(null)
  const [docType, setDocType] = useState('') // 'pdf' | 'docx' | 'pptx' | 'text' | 'image'
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Reading / Study State
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0) // 0, 90, 180, 270
  const [studyTheme, setStudyTheme] = useState('dark') // 'dark' | 'sepia' | 'light'
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [copied, setCopied] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // PDF specific
  const [pdfDoc, setPdfDoc] = useState(null)
  const pdfCanvasRef = useRef(null)

  // DOCX specific
  const [docxHtml, setDocxHtml] = useState('')

  // PPTX specific
  const [pptxSlides, setPptxSlides] = useState([])

  // Text specific
  const [plainText, setPlainText] = useState('')

  // Image specific
  const [imageUrl, setImageUrl] = useState('')
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })

  const modalContainerRef = useRef(null)

  // Auto-load initialFile if provided
  useEffect(() => {
    if (initialFile) {
      loadFile(initialFile)
    }
  }, [initialFile])

  // Handle keyboard shortcuts (Esc, Left/Right arrows, F for fullscreen, R for rotate)
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'Escape' && !isFullscreen) onClose()
      if (e.key === 'ArrowLeft') prevPage()
      if (e.key === 'ArrowRight') nextPage()
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
      if (e.key === 'r' || e.key === 'R') rotateClockwise()
      if (e.key === '+' || e.key === '=') handleZoomIn()
      if (e.key === '-') handleZoomOut()
      if (e.key === '0') handleResetZoom()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [currentPage, totalPages, isFullscreen, zoom])

  // Re-render PDF page when page or zoom changes
  useEffect(() => {
    if (docType === 'pdf' && pdfDoc) {
      renderPdfPage(currentPage, zoom, rotation)
    }
  }, [currentPage, zoom, rotation, pdfDoc, docType])

  const loadFile = async (file) => {
    setLoading(true)
    setErrorMsg('')
    setFileName(file.name)
    setFileSize(file.size)
    setCurrentPage(1)
    setZoom(1)
    setRotation(0)

    const name = file.name.toLowerCase()

    try {
      if (name.endsWith('.pdf') || file.type === 'application/pdf') {
        setDocType('pdf')
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        setPdfDoc(pdf)
        setTotalPages(pdf.numPages)
      } else if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) {
        setDocType('docx')
        const result = await parseDocx(file)
        setDocxHtml(result.html)
        setTotalPages(1)
      } else if (name.endsWith('.pptx') || file.type.includes('presentationml')) {
        setDocType('pptx')
        const result = await parsePptx(file)
        setPptxSlides(result.slides)
        setTotalPages(result.slides.length || 1)
      } else if (
        name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv') ||
        name.endsWith('.json') || name.endsWith('.log') || file.type.startsWith('text/')
      ) {
        setDocType('text')
        const result = await parsePlainText(file)
        setPlainText(result.text)
        setTotalPages(1)
      } else if (file.type.startsWith('image/')) {
        setDocType('image')
        const url = URL.createObjectURL(file)
        setImageUrl(url)
        setTotalPages(1)

        // Read natural image dimensions
        const img = new Image()
        img.onload = () => {
          setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
        }
        img.src = url
      } else {
        // Fallback: try reading as text
        setDocType('text')
        const text = await file.text()
        setPlainText(text)
        setTotalPages(1)
      }
    } catch (err) {
      console.error(err)
      setErrorMsg(`Failed to open document: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const renderPdfPage = async (pageNumber, zoomScale, rotAngle) => {
    if (!pdfDoc || !pdfCanvasRef.current) return
    try {
      const page = await pdfDoc.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1.8 * zoomScale, rotation: (page.rotate + rotAngle) % 360 })
      const canvas = pdfCanvasRef.current
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      await page.render({ canvasContext: ctx, viewport }).promise
    } catch (e) {
      console.error('Error rendering PDF page:', e)
    }
  }

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1)
  }

  const nextPage = () => {
    if (currentPage < totalPages) setCurrentPage((p) => p + 1)
  }

  const handleZoomIn = () => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, +(z - 0.25).toFixed(2)))
  const handleResetZoom = () => setZoom(1)
  const handleFitWidth = () => setZoom(1.35)

  const rotateClockwise = () => {
    setRotation((r) => (r + 90) % 360)
  }

  const toggleFullscreen = () => {
    if (!modalContainerRef.current) return
    if (!document.fullscreenElement) {
      modalContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  const copyDocText = () => {
    let textToCopy = ''
    if (docType === 'docx') {
      const tmp = document.createElement('div')
      tmp.innerHTML = docxHtml
      textToCopy = tmp.innerText || tmp.textContent
    } else if (docType === 'pptx') {
      textToCopy = pptxSlides.map((s, i) => `--- Slide ${i + 1}: ${s.title} ---\n${s.notes}`).join('\n\n')
    } else if (docType === 'text') {
      textToCopy = plainText
    }
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const downloadOriginal = () => {
    if (docType === 'image' && imageUrl) {
      const a = document.createElement('a')
      a.href = imageUrl
      a.download = fileName || 'document_image.jpg'
      a.click()
    } else {
      window.print()
    }
  }

  // Switch to Scanner / Editor Studio
  const handleOpenInEditor = async () => {
    if (!onImportToQueue) return
    setLoading(true)

    try {
      if (docType === 'pdf' && pdfDoc) {
        const pagesData = []
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i)
          const viewport = page.getViewport({ scale: 2 })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d')
          await page.render({ canvasContext: ctx, viewport }).promise
          pagesData.push({
            dataUrl: canvas.toDataURL('image/png'),
            name: `${fileName} (p.${i})`,
          })
        }
        onImportToQueue(pagesData)
        onClose()
      } else if (docType === 'image' && imageUrl) {
        onImportToQueue([{ dataUrl: imageUrl, name: fileName }])
        onClose()
      } else {
        alert('This text document cannot be edited in the scanner studio.')
      }
    } catch (e) {
      alert('Error switching to Studio: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  // Background style based on Study Theme
  const getThemeClasses = () => {
    if (studyTheme === 'sepia') {
      return {
        bg: 'bg-[#fbf0d9]',
        panel: 'bg-[#f4e4c1] text-[#433422] border-[#e2cca4]',
        text: 'text-[#433422]',
        viewerBg: 'bg-[#f7ebd0]',
      }
    }
    if (studyTheme === 'light') {
      return {
        bg: 'bg-slate-100',
        panel: 'bg-white text-slate-900 border-slate-200',
        text: 'text-slate-800',
        viewerBg: 'bg-slate-200/70',
      }
    }
    // Dark (Default - Google Drive / Acrobat OLED style)
    return {
      bg: 'bg-slate-950',
      panel: 'bg-slate-900/95 text-slate-100 border-slate-800',
      text: 'text-slate-200',
      viewerBg: 'bg-slate-950',
    }
  }

  const theme = getThemeClasses()

  return (
    <div
      ref={modalContainerRef}
      className={`fixed inset-0 z-50 flex flex-col ${theme.bg} select-none transition-colors duration-200`}
    >
      {/* ─── Top Full-Screen Header Toolbar (Google Drive & Files style) ─── */}
      <div className={`px-3 py-2.5 sm:px-5 border-b flex items-center justify-between gap-2 flex-shrink-0 z-20 backdrop-blur-md ${theme.panel}`}>
        {/* Left: Document Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-xl text-white shadow-xs shrink-0 ${
            docType === 'pdf' ? 'bg-red-500' :
            docType === 'docx' ? 'bg-blue-600' :
            docType === 'pptx' ? 'bg-orange-500' :
            docType === 'text' ? 'bg-emerald-600' : 'bg-sky-600'
          }`}>
            {docType === 'pptx' ? <Presentation size={18} /> :
             docType === 'text' ? <FileCode size={18} /> :
             docType === 'image' ? <ImageIcon size={18} /> : <FileText size={18} />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                {fileName || 'KamalScan Study & Document Viewer'}
              </h3>
              {docType && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 shrink-0">
                  {docType}
                </span>
              )}
            </div>
            <p className="text-[11px] opacity-60 truncate">
              Study & Reading Mode • 100% Offline
            </p>
          </div>
        </div>

        {/* Center: Page Controls & Reading Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Page navigation for PDF & PPTX */}
          {totalPages > 1 && (
            <div className="flex items-center rounded-xl px-2 py-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs">
              <button
                onClick={prevPage}
                disabled={currentPage <= 1}
                className="p-1 hover:text-sky-500 disabled:opacity-25 transition-colors"
                title="Previous Page (←)"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 font-semibold">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={nextPage}
                disabled={currentPage >= totalPages}
                className="p-1 hover:text-sky-500 disabled:opacity-25 transition-colors"
                title="Next Page (→)"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          {(docType === 'pdf' || docType === 'image') && (
            <div className="flex items-center rounded-xl p-0.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs">
              <button onClick={handleZoomOut} className="p-1.5 hover:text-sky-500" title="Zoom Out (-)">
                <ZoomOut size={15} />
              </button>
              <button onClick={handleResetZoom} className="px-2 text-[11px] font-semibold hover:text-sky-500" title="Reset Zoom (0)">
                {Math.round(zoom * 100)}%
              </button>
              <button onClick={handleZoomIn} className="p-1.5 hover:text-sky-500" title="Zoom In (+)">
                <ZoomIn size={15} />
              </button>
            </div>
          )}

          {/* Rotate (Essential for sideways student notes) */}
          {(docType === 'pdf' || docType === 'image') && (
            <button
              onClick={rotateClockwise}
              className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Rotate 90° Clockwise (R)"
            >
              <RotateCw size={15} />
            </button>
          )}

          {/* Eye-Care Study Themes */}
          <div className="hidden sm:flex items-center rounded-xl p-0.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs">
            <button
              onClick={() => setStudyTheme('dark')}
              className={`p-1.5 rounded-lg transition-colors ${studyTheme === 'dark' ? 'bg-sky-600 text-white' : 'opacity-60 hover:opacity-100'}`}
              title="Night / OLED Dark Study"
            >
              <Moon size={14} />
            </button>
            <button
              onClick={() => setStudyTheme('sepia')}
              className={`p-1.5 rounded-lg transition-colors ${studyTheme === 'sepia' ? 'bg-amber-600 text-white' : 'opacity-60 hover:opacity-100'}`}
              title="Warm Paper / Sepia Eye-Care Mode"
            >
              <BookOpen size={14} />
            </button>
            <button
              onClick={() => setStudyTheme('light')}
              className={`p-1.5 rounded-lg transition-colors ${studyTheme === 'light' ? 'bg-sky-600 text-white' : 'opacity-60 hover:opacity-100'}`}
              title="Day / Light Mode"
            >
              <Sun size={14} />
            </button>
          </div>
        </div>

        {/* Right: Switch to Studio / Fullscreen / Close */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Switch to Scanner / Editor Studio */}
          {(docType === 'pdf' || docType === 'image') && onImportToQueue && (
            <button
              onClick={handleOpenInEditor}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-xl bg-linear-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-98"
              title="Switch to Editing Studio: Crop, Magic Filters, Watermark, E-Sign & Compress"
            >
              <PenTool size={13} />
              <span className="hidden sm:inline">Edit in</span> Studio
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen (F)'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {/* Close / Back to Scanner */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="Close Viewer (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ─── Main Full-Screen Reader Canvas (Google Drive Style) ─────────── */}
      <div className={`flex-1 overflow-auto flex flex-col items-center justify-center p-2 sm:p-6 relative ${theme.viewerBg}`}>
        {loading && (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 size={36} className="animate-spin text-sky-500" />
            <p className="text-sm font-semibold">Opening document for study...</p>
          </div>
        )}

        {errorMsg && (
          <div className="p-5 bg-red-500/10 border border-red-500/30 rounded-2xl max-w-md text-center text-red-500 text-xs space-y-2">
            <AlertCircle size={28} className="mx-auto" />
            <p className="font-bold text-sm">Cannot Read Document</p>
            <p>{errorMsg}</p>
          </div>
        )}

        {/* 1. PDF Study View */}
        {!loading && !errorMsg && docType === 'pdf' && (
          <div className="flex items-center justify-center p-2 min-h-full">
            <canvas
              ref={pdfCanvasRef}
              className={`rounded-xl shadow-2xl block max-w-full transition-all ${
                studyTheme === 'sepia' ? 'sepia-[0.25]' : ''
              }`}
            />
          </div>
        )}

        {/* 2. Notes Image Study View */}
        {!loading && !errorMsg && docType === 'image' && (
          <div
            className="transition-transform duration-150 ease-out flex items-center justify-center max-h-full max-w-full"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
            }}
          >
            <img
              src={imageUrl}
              alt={fileName}
              className={`max-h-[85vh] max-w-[90vw] rounded-2xl shadow-2xl object-contain transition-all ${
                studyTheme === 'sepia' ? 'sepia-[0.35] brightness-95' : ''
              }`}
            />
          </div>
        )}

        {/* 3. PowerPoint Presentation Deck Study View */}
        {!loading && !errorMsg && docType === 'pptx' && pptxSlides.length > 0 && (
          <div className="w-full max-w-5xl flex flex-col items-center gap-4 h-full justify-between py-2">
            {/* 16:9 Presentation Canvas */}
            <div className={`w-full aspect-[16/9] max-h-[72vh] rounded-3xl shadow-2xl p-8 sm:p-14 flex flex-col justify-between border relative overflow-hidden transition-all ${
              studyTheme === 'sepia' ? 'bg-[#fbf0d9] border-[#e2cca4] text-[#433422]' :
              studyTheme === 'light' ? 'bg-white border-slate-200 text-slate-900' :
              'bg-slate-900 border-slate-800 text-white'
            }`}>
              <div className="space-y-4 overflow-y-auto">
                <span className="text-[11px] font-bold uppercase tracking-widest text-orange-500">
                  Slide {currentPage} of {totalPages}
                </span>
                <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight">
                  {pptxSlides[currentPage - 1]?.title || `Slide ${currentPage}`}
                </h2>
                <div className="text-sm sm:text-base opacity-80 whitespace-pre-wrap leading-relaxed space-y-2 select-text font-sans">
                  {pptxSlides[currentPage - 1]?.notes || 'No notes or text on this slide.'}
                </div>
              </div>

              <div className="pt-4 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-xs opacity-60">
                <span>KamalScan Offline Presentation Deck</span>
                <span>Use ← and → to navigate slides</span>
              </div>
            </div>

            {/* Bottom Thumbnail Strip */}
            <div className="w-full max-w-3xl flex items-center gap-2 overflow-x-auto py-2 px-1">
              {pptxSlides.map((slide, sIdx) => (
                <button
                  key={sIdx}
                  onClick={() => setCurrentPage(sIdx + 1)}
                  className={`shrink-0 w-24 aspect-[16/9] rounded-xl p-1.5 text-left border-2 transition-all flex flex-col justify-between ${
                    currentPage === sIdx + 1
                      ? 'border-orange-500 bg-orange-500/10 shadow-md scale-105'
                      : 'border-slate-700/50 opacity-60 hover:opacity-100'
                  }`}
                >
                  <span className="text-[9px] font-bold text-orange-500">{sIdx + 1}</span>
                  <p className="text-[8px] font-semibold truncate">
                    {slide.title}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. Word DOCX Study View */}
        {!loading && !errorMsg && docType === 'docx' && (
          <div className={`w-full max-w-4xl rounded-2xl shadow-2xl p-8 sm:p-14 overflow-auto max-h-[85vh] leading-relaxed text-sm space-y-4 font-serif border select-text ${
            studyTheme === 'sepia' ? 'bg-[#fbf0d9] border-[#e2cca4] text-[#433422]' :
            studyTheme === 'light' ? 'bg-white border-slate-200 text-slate-800' :
            'bg-slate-900 border-slate-800 text-slate-100'
          }`}>
            <div dangerouslySetInnerHTML={{ __html: docxHtml }} />
          </div>
        )}

        {/* 5. Plain Text Study View */}
        {!loading && !errorMsg && docType === 'text' && (
          <div className={`w-full max-w-4xl rounded-2xl shadow-2xl p-6 sm:p-10 overflow-auto max-h-[85vh] font-mono text-xs border whitespace-pre-wrap select-text leading-relaxed ${
            studyTheme === 'sepia' ? 'bg-[#fbf0d9] border-[#e2cca4] text-[#433422]' :
            studyTheme === 'light' ? 'bg-white border-slate-200 text-slate-800' :
            'bg-slate-900 border-slate-800 text-slate-200'
          }`}>
            {plainText}
          </div>
        )}
      </div>

      {/* ─── Bottom Footer Status Bar ───────────────────────────────────── */}
      <div className={`px-4 py-2 border-t flex items-center justify-between text-xs flex-shrink-0 ${theme.panel}`}>
        <div className="flex items-center gap-3 opacity-70">
          <span>{(fileSize / 1024).toFixed(1)} KB</span>
          <span>•</span>
          {imageDimensions.width > 0 && (
            <>
              <span>{imageDimensions.width} × {imageDimensions.height} px</span>
              <span>•</span>
            </>
          )}
          <span className="hidden sm:inline">Press <b>F</b> for Fullscreen • <b>R</b> to Rotate • <b>+</b> / <b>-</b> to Zoom</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy Text for DOCX/PPTX */}
          {(docType === 'docx' || docType === 'pptx' || docType === 'text') && (
            <button
              onClick={copyDocText}
              className="px-3 py-1 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-black/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy Text'}
            </button>
          )}

          {/* Open Another Document */}
          <label className="px-3 py-1 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-black/20 font-semibold cursor-pointer flex items-center gap-1.5 transition-colors">
            <Upload size={12} /> Open File
            <input
              type="file"
              accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.csv,image/*"
              onChange={(e) => {
                if (e.target.files?.[0]) loadFile(e.target.files[0])
              }}
              className="hidden"
            />
          </label>

          <button
            onClick={onClose}
            className="px-3.5 py-1 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
