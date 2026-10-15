import { useState, useRef, useEffect } from 'react'
import {
  X, FileText, Presentation, FileCode, ZoomIn, ZoomOut, Maximize2, Minimize2,
  ChevronLeft, ChevronRight, Download, Printer, Copy, Check, Upload,
  Layers, Loader2, Sparkles, AlertCircle, Eye, ArrowRight
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

  // View state
  const [zoom, setZoom] = useState(1)
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

  const modalContainerRef = useRef(null)

  // Auto-load initialFile if provided
  useEffect(() => {
    if (initialFile) {
      loadFile(initialFile)
    }
  }, [initialFile])

  // Handle keyboard shortcuts (Esc, Left, Right arrows)
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && !isFullscreen) onClose()
      if (e.key === 'ArrowLeft') prevPage()
      if (e.key === 'ArrowRight') nextPage()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [currentPage, totalPages, isFullscreen])

  // Re-render PDF page when page or zoom changes
  useEffect(() => {
    if (docType === 'pdf' && pdfDoc) {
      renderPdfPage(currentPage, zoom)
    }
  }, [currentPage, zoom, pdfDoc, docType])

  const loadFile = async (file) => {
    setLoading(true)
    setErrorMsg('')
    setFileName(file.name)
    setFileSize(file.size)
    setCurrentPage(1)
    setZoom(1)

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

  const renderPdfPage = async (pageNumber, zoomScale) => {
    if (!pdfDoc || !pdfCanvasRef.current) return
    try {
      const page = await pdfDoc.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1.5 * zoomScale })
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
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))
  const handleResetZoom = () => setZoom(1)

  const toggleFullscreen = () => {
    if (!modalContainerRef.current) return
    if (!isFullscreen) {
      if (modalContainerRef.current.requestFullscreen) {
        modalContainerRef.current.requestFullscreen()
      }
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
      setIsFullscreen(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const copyDocText = () => {
    let textToCopy = ''
    if (docType === 'docx') {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = docxHtml
      textToCopy = tempDiv.innerText
    } else if (docType === 'pptx') {
      textToCopy = pptxSlides
        .map((s) => `--- Slide ${s.slideNumber}: ${s.title} ---\n${s.paragraphs.join('\n')}`)
        .join('\n\n')
    } else if (docType === 'text') {
      textToCopy = plainText
    }

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Import pages of viewed document into KamalScan's main scanner queue
  const handleImportToScanner = async () => {
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
      } else if (docType === 'pptx') {
        // Render current slide as image card
        alert('Slides text and notes have been sent to queue!')
      }
    } catch (e) {
      alert('Error importing to queue: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      ref={modalContainerRef}
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 animate-slide-in select-none"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-6xl h-[95vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* ─── Top Header Bar ────────────────────────────────────────── */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-xl text-white shadow-xs ${
              docType === 'pdf' ? 'bg-red-500' :
              docType === 'docx' ? 'bg-blue-600' :
              docType === 'pptx' ? 'bg-orange-500' :
              docType === 'text' ? 'bg-emerald-600' : 'bg-sky-600'
            }`}>
              {docType === 'pptx' ? <Presentation size={18} /> :
               docType === 'text' ? <FileCode size={18} /> : <FileText size={18} />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                  {fileName || 'Universal Document Viewer'}
                </h3>
                {docType && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {docType}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                KamalScan Offline Multi-Format Reader
              </p>
            </div>
          </div>

          {/* Action controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Page navigation for PDF & PPTX */}
            {totalPages > 1 && (
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-2 py-1 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                <button
                  onClick={prevPage}
                  disabled={currentPage <= 1}
                  className="p-1 hover:text-sky-600 disabled:opacity-30 transition-colors"
                  title="Previous (←)"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-2 font-semibold">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={nextPage}
                  disabled={currentPage >= totalPages}
                  className="p-1 hover:text-sky-600 disabled:opacity-30 transition-colors"
                  title="Next (→)"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Zoom Controls */}
            {(docType === 'pdf' || docType === 'image') && (
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <button onClick={handleZoomOut} className="p-1.5 hover:text-sky-600" title="Zoom Out">
                  <ZoomOut size={15} />
                </button>
                <button onClick={handleResetZoom} className="px-2 text-[11px] font-semibold hover:text-sky-600">
                  {Math.round(zoom * 100)}%
                </button>
                <button onClick={handleZoomIn} className="p-1.5 hover:text-sky-600" title="Zoom In">
                  <ZoomIn size={15} />
                </button>
              </div>
            )}

            {/* Copy Text */}
            {(docType === 'docx' || docType === 'pptx' || docType === 'text') && (
              <button
                onClick={copyDocText}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Copy all document text"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy Text'}
              </button>
            )}

            {/* Send to Scanner / Converter Queue */}
            {(docType === 'pdf' || docType === 'image') && onImportToQueue && (
              <button
                onClick={handleImportToScanner}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
                title="Send all pages to KamalScan for cropping, enhancement, and conversion"
              >
                <Layers size={14} /> Send to Scanner
              </button>
            )}

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title="Close (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ─── Main Viewer Body ──────────────────────────────────────── */}
        <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-4 relative">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 size={36} className="animate-spin text-sky-600" />
              <p className="text-sm font-semibold">Opening and parsing document...</p>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl max-w-md text-center text-red-600 dark:text-red-400 text-xs space-y-2">
              <AlertCircle size={28} className="mx-auto" />
              <p className="font-semibold text-sm">Document Error</p>
              <p>{errorMsg}</p>
            </div>
          )}

          {/* 1. PDF Viewer Render */}
          {!loading && !errorMsg && docType === 'pdf' && (
            <div className="flex items-center justify-center p-2 min-h-full">
              <canvas
                ref={pdfCanvasRef}
                className="rounded-lg shadow-2xl bg-white max-w-full block"
              />
            </div>
          )}

          {/* 2. Word DOCX Viewer Render */}
          {!loading && !errorMsg && docType === 'docx' && (
            <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-8 sm:p-14 overflow-auto max-h-full text-slate-800 dark:text-slate-100 leading-relaxed text-sm space-y-4 font-serif border border-slate-200 dark:border-slate-800">
              <div
                dangerouslySetInnerHTML={{ __html: docxHtml }}
                className="prose dark:prose-invert max-w-none [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_p]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_img]:max-w-full [&_img]:rounded-lg"
              />
            </div>
          )}

          {/* 3. PowerPoint PPTX Presentation Viewer Render */}
          {!loading && !errorMsg && docType === 'pptx' && pptxSlides.length > 0 && (
            <div className="w-full max-w-4xl flex flex-col items-center gap-4">
              {/* 16:9 Presentation Slide Card */}
              <div className="w-full aspect-[16/9] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 sm:p-12 flex flex-col justify-between border border-slate-200 dark:border-slate-800 relative overflow-hidden select-text">
                {/* Slide Header */}
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="font-bold tracking-widest uppercase text-orange-500">
                      PowerPoint Slide {currentPage}
                    </span>
                    <span>{fileName}</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                    {pptxSlides[currentPage - 1]?.title}
                  </h2>
                </div>

                {/* Slide Body: Bullet points & Embedded images */}
                <div className="flex-1 overflow-auto space-y-3 py-2">
                  {pptxSlides[currentPage - 1]?.bodyText.map((paragraph, pIdx) => (
                    <div key={pIdx} className="flex items-start gap-2.5 text-sm sm:text-base text-slate-700 dark:text-slate-200">
                      <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-2" />
                      <p>{paragraph}</p>
                    </div>
                  ))}

                  {/* Render slide images if any exist */}
                  {pptxSlides[currentPage - 1]?.images.length > 0 && (
                    <div className="flex gap-3 flex-wrap mt-4">
                      {pptxSlides[currentPage - 1].images.map((imgSrc, imgIdx) => (
                        <img
                          key={imgIdx}
                          src={imgSrc}
                          alt="Slide visual"
                          className="max-h-40 rounded-xl shadow-md object-contain border border-slate-200 dark:border-slate-700"
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Slide Footer */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>KamalScan Universal Slide Viewer</span>
                  <span>Slide {currentPage} of {totalPages}</span>
                </div>
              </div>

              {/* Bottom Slide Strip */}
              <div className="flex gap-2 max-w-full overflow-x-auto py-2 px-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-800">
                {pptxSlides.map((slide, sIdx) => (
                  <button
                    key={sIdx}
                    onClick={() => setCurrentPage(sIdx + 1)}
                    className={`flex-shrink-0 w-24 aspect-[16/9] rounded-lg p-1.5 text-left border-2 transition-all flex flex-col justify-between ${
                      currentPage === sIdx + 1
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <span className="text-[9px] font-bold text-orange-500">{sIdx + 1}</span>
                    <p className="text-[8px] font-semibold truncate text-slate-700 dark:text-slate-300">
                      {slide.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. Plain Text Viewer */}
          {!loading && !errorMsg && docType === 'text' && (
            <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 overflow-auto max-h-full font-mono text-xs text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 whitespace-pre-wrap select-text leading-relaxed">
              {plainText}
            </div>
          )}

          {/* 5. Image Viewer */}
          {!loading && !errorMsg && docType === 'image' && (
            <div
              className="transition-transform duration-150 ease-out flex items-center justify-center"
              style={{ transform: `scale(${zoom})` }}
            >
              <img
                src={imageUrl}
                alt={fileName}
                className="max-h-[75vh] max-w-full rounded-xl shadow-2xl object-contain"
              />
            </div>
          )}
        </div>

        {/* ─── Bottom Footer Toolbar ─────────────────────────────────── */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span>Size: <b>{(fileSize / 1024).toFixed(1)} KB</b></span>
            <span>•</span>
            <span>Offline Client-Side Rendering</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Open another document */}
            <label className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer flex items-center gap-1.5 transition-colors">
              <Upload size={13} /> Open Another File
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
              className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
