import React, { useState, useRef, useEffect } from 'react'
import {
  X, Layers, Scissors, Upload, Download, ArrowUp, ArrowDown, Trash2, RotateCw,
  CheckCircle2, FileText, Sparkles, Loader2, Plus, AlertCircle, Eye, ArrowRight,
  Check, RefreshCw, FilePlus2, Split
} from 'lucide-react'
import { mergePdfFiles, splitAndOrganizePdf, renderPdfThumbnails } from '../utils/pdfTools'

export function PDFMergeSplitModal({ isOpen, onClose, onImportToQueue }) {
  if (!isOpen) return null

  // Escape key to close
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const [activeTab, setActiveTab] = useState('merge') // 'merge' | 'split'
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // ─── Merge State ────────────────────────────────────────────────────────────
  const [mergeFiles, setMergeFiles] = useState([]) // File[]

  // ─── Split State ────────────────────────────────────────────────────────────
  const [splitFile, setSplitFile] = useState(null)
  const [pageThumbnails, setPageThumbnails] = useState([]) // { pageIndex, pageNumber, dataUrl }[]
  const [selectedPages, setSelectedPages] = useState(new Set()) // Set of pageIndex (0-based)
  const [pageRotations, setPageRotations] = useState({}) // { [pageIndex]: 90 | 180 | 270 }
  const [rangeInput, setRangeInput] = useState('')

  // ─── Merge Handlers ────────────────────────────────────────────────────────
  const handleAddMergeFiles = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const validPdfs = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (validPdfs.length < files.length) {
      alert('Some non-PDF files were skipped. Merge requires PDF documents.')
    }
    setMergeFiles((prev) => [...prev, ...validPdfs])
  }

  const moveMergeFile = (index, direction) => {
    const targetIdx = index + direction
    if (targetIdx < 0 || targetIdx >= mergeFiles.length) return
    const copy = [...mergeFiles]
    const temp = copy[index]
    copy[index] = copy[targetIdx]
    copy[targetIdx] = temp
    setMergeFiles(copy)
  }

  const removeMergeFile = (index) => {
    setMergeFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleExecuteMerge = async (sendToStudio = false) => {
    if (mergeFiles.length < 2) {
      alert('Please add at least 2 PDF files to merge.')
      return
    }

    setLoading(true)
    setStatusMsg('Merging PDF documents losslessly...')
    setErrorMsg('')

    try {
      const mergedBytes = await mergePdfFiles(mergeFiles)
      const blob = new Blob([mergedBytes], { type: 'application/pdf' })

      if (sendToStudio && onImportToQueue) {
        const file = new File([blob], 'merged_document.pdf', { type: 'application/pdf' })
        // Render pages to send to studio
        const thumbs = await renderPdfThumbnails(file, 1.5)
        const pagesData = thumbs.map((t) => ({
          dataUrl: t.dataUrl,
          name: `Merged Document (p.${t.pageNumber})`,
        }))
        onImportToQueue(pagesData)
        onClose()
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `KamalScan_Merged_${Date.now()}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error(err)
      setErrorMsg(`Merge failed: ${err.message}`)
    } finally {
      setLoading(false)
      setStatusMsg('')
    }
  }

  // ─── Split Handlers ────────────────────────────────────────────────────────
  const handleLoadSplitFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setStatusMsg('Extracting pages and rendering visual thumbnails...')
    setErrorMsg('')
    setSplitFile(file)
    setSelectedPages(new Set())
    setPageRotations({})
    setRangeInput('')

    try {
      const thumbs = await renderPdfThumbnails(file, 0.45)
      setPageThumbnails(thumbs)
      // Default: select all pages
      setSelectedPages(new Set(thumbs.map((t) => t.pageIndex)))
      setRangeInput(`1-${thumbs.length}`)
    } catch (err) {
      console.error(err)
      setErrorMsg(`Could not read PDF: ${err.message}`)
    } finally {
      setLoading(false)
      setStatusMsg('')
    }
  }

  const togglePageSelection = (pageIndex) => {
    setSelectedPages((prev) => {
      const next = new Set(prev)
      if (next.has(pageIndex)) {
        next.delete(pageIndex)
      } else {
        next.add(pageIndex)
      }
      return next
    })
  }

  const selectAllPages = () => {
    setSelectedPages(new Set(pageThumbnails.map((t) => t.pageIndex)))
  }

  const deselectAllPages = () => {
    setSelectedPages(new Set())
  }

  const rotatePage = (pageIndex) => {
    setPageRotations((prev) => ({
      ...prev,
      [pageIndex]: ((prev[pageIndex] || 0) + 90) % 360,
    }))
  }

  const applyRangeInput = () => {
    if (!rangeInput.trim() || !pageThumbnails.length) return
    const newSelected = new Set()
    const parts = rangeInput.split(',')

    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-')
        const start = parseInt(startStr, 10)
        const end = parseInt(endStr, 10)
        if (!isNaN(start) && !isNaN(end)) {
          for (let p = Math.min(start, end); p <= Math.max(start, end); p++) {
            if (p >= 1 && p <= pageThumbnails.length) {
              newSelected.add(p - 1)
            }
          }
        }
      } else {
        const num = parseInt(trimmed, 10)
        if (!isNaN(num) && num >= 1 && num <= pageThumbnails.length) {
          newSelected.add(num - 1)
        }
      }
    }

    setSelectedPages(newSelected)
  }

  const handleExecuteSplit = async (sendToStudio = false) => {
    if (!splitFile) return
    const indices = Array.from(selectedPages).sort((a, b) => a - b)
    if (!indices.length) {
      alert('Please select at least one page to extract.')
      return
    }

    setLoading(true)
    setStatusMsg(`Extracting ${indices.length} pages...`)
    setErrorMsg('')

    try {
      const newPdfBytes = await splitAndOrganizePdf(splitFile, indices, pageRotations)
      const blob = new Blob([newPdfBytes], { type: 'application/pdf' })

      if (sendToStudio && onImportToQueue) {
        const file = new File([blob], 'extracted_pages.pdf', { type: 'application/pdf' })
        const thumbs = await renderPdfThumbnails(file, 1.5)
        const pagesData = thumbs.map((t) => ({
          dataUrl: t.dataUrl,
          name: `${splitFile.name} (extracted p.${t.pageNumber})`,
        }))
        onImportToQueue(pagesData)
        onClose()
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `KamalScan_Extracted_${Date.now()}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error(err)
      setErrorMsg(`Failed to extract pages: ${err.message}`)
    } finally {
      setLoading(false)
      setStatusMsg('')
    }
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none"
    >
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-scale-up">
        {/* ─── Top Header & Mode Tabs ───────────────────────────────────────── */}
        <div className="px-6 py-4 bg-linear-to-r from-sky-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-sm">
              <Layers size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">PDF Merge & Split Studio</h3>
              <p className="text-xs text-sky-100">
                Lossless 100% Offline Vector Page Organizer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Switcher */}
            <div className="flex items-center bg-black/20 backdrop-blur-xs p-1 rounded-2xl border border-white/20">
              <button
                onClick={() => setActiveTab('merge')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'merge' ? 'bg-white text-sky-700 shadow-md' : 'text-white/80 hover:text-white'
                }`}
              >
                <Layers size={14} /> Merge PDFs
              </button>
              <button
                onClick={() => setActiveTab('split')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'split' ? 'bg-white text-sky-700 shadow-md' : 'text-white/80 hover:text-white'
                }`}
              >
                <Scissors size={14} /> Split & Organize
              </button>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              className="p-2 rounded-xl bg-white/20 hover:bg-red-500 hover:text-white text-white font-bold transition-all shadow-sm ml-2 flex items-center justify-center active:scale-95"
              title="Close (Esc)"
              aria-label="Close modal"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* ─── Body Area ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ════════════════════ TAB 1: MERGE ════════════════════ */}
          {activeTab === 'merge' && (
            <div className="space-y-4">
              {/* File Dropzone */}
              <label className="border-2 border-dashed border-sky-300 dark:border-sky-800 hover:border-sky-500 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-sky-50/40 dark:bg-sky-950/20 transition-all hover:bg-sky-50/70">
                <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-600/20 mb-3">
                  <FilePlus2 size={24} />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Select or Drag Multiple PDF Files to Combine
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Merge school notes, bank statements, assignments, and scanned forms losslessly.
                </p>
                <input
                  type="file"
                  multiple
                  accept=".pdf,application/pdf"
                  onChange={handleAddMergeFiles}
                  className="hidden"
                />
              </label>

              {/* Added Files List */}
              {mergeFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
                    <span>{mergeFiles.length} PDF Document(s) in Merge Queue:</span>
                    <button
                      onClick={() => setMergeFiles([])}
                      className="text-red-500 hover:underline font-semibold"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {mergeFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {file.name}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => moveMergeFile(idx, -1)}
                            disabled={idx === 0}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-20"
                            title="Move Up"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            onClick={() => moveMergeFile(idx, 1)}
                            disabled={idx === mergeFiles.length - 1}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-20"
                            title="Move Down"
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            onClick={() => removeMergeFile(idx)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════ TAB 2: SPLIT & ORGANIZE ════════════════════ */}
          {activeTab === 'split' && (
            <div className="space-y-4">
              {!splitFile ? (
                <label className="border-2 border-dashed border-indigo-300 dark:border-indigo-800 hover:border-indigo-500 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-indigo-50/40 dark:bg-indigo-950/20 transition-all hover:bg-indigo-50/70">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 mb-3">
                    <Scissors size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Upload a Multi-Page PDF to Split, Rearrange, or Rotate
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Visual page-by-page grid with instant selective extraction.
                  </p>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleLoadSplitFile}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  {/* Controls Bar */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                        {splitFile.name}
                      </span>
                      <span className="text-slate-400">({pageThumbnails.length} pages)</span>
                    </div>

                    {/* Page Range Input */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Range:</span>
                      <input
                        type="text"
                        value={rangeInput}
                        onChange={(e) => setRangeInput(e.target.value)}
                        placeholder="e.g. 1-3, 5"
                        className="w-24 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-semibold"
                      />
                      <button
                        onClick={applyRangeInput}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700"
                      >
                        Select
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={selectAllPages}
                        className="px-2 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold"
                      >
                        All
                      </button>
                      <button
                        onClick={deselectAllPages}
                        className="px-2 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold"
                      >
                        None
                      </button>
                      <label className="text-sky-600 dark:text-sky-400 cursor-pointer hover:underline font-semibold ml-2">
                        Change File
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={handleLoadSplitFile}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Thumbnail Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-96 overflow-y-auto p-1">
                    {pageThumbnails.map((thumb) => {
                      const isSelected = selectedPages.has(thumb.pageIndex)
                      const rot = pageRotations[thumb.pageIndex] || 0

                      return (
                        <div
                          key={thumb.pageIndex}
                          className={`relative rounded-2xl border-2 p-2 flex flex-col justify-between transition-all bg-white dark:bg-slate-800 shadow-xs ${
                            isSelected
                              ? 'border-indigo-600 ring-2 ring-indigo-500/20'
                              : 'border-slate-200 dark:border-slate-700 opacity-60'
                          }`}
                        >
                          {/* Page Image */}
                          <div
                            onClick={() => togglePageSelection(thumb.pageIndex)}
                            className="cursor-pointer flex items-center justify-center aspect-[3/4] bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden p-1 relative"
                          >
                            <img
                              src={thumb.dataUrl}
                              alt={`Page ${thumb.pageNumber}`}
                              className="max-h-full max-w-full object-contain transition-transform duration-200"
                              style={{ transform: `rotate(${rot}deg)` }}
                            />
                            {isSelected && (
                              <div className="absolute top-2 right-2 p-1 rounded-full bg-indigo-600 text-white shadow-md">
                                <Check size={12} />
                              </div>
                            )}
                          </div>

                          {/* Page Bottom Details & Rotate */}
                          <div className="pt-2 flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              Page {thumb.pageNumber}
                            </span>
                            <button
                              onClick={() => rotatePage(thumb.pageIndex)}
                              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 transition-colors"
                              title="Rotate Page 90°"
                            >
                              <RotateCw size={13} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Bottom Actions Footer ────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {loading ? (
              <span className="flex items-center gap-2 text-sky-600 font-semibold animate-pulse">
                <Loader2 size={15} className="animate-spin" />
                {statusMsg}
              </span>
            ) : activeTab === 'merge' ? (
              <span>Ready to merge {mergeFiles.length} file(s) into one document.</span>
            ) : (
              <span>Selected {selectedPages.size} of {pageThumbnails.length} pages to extract.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
            >
              Close
            </button>
            {activeTab === 'merge' ? (
              <>
                <button
                  onClick={() => handleExecuteMerge(true)}
                  disabled={loading || mergeFiles.length < 2}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all disabled:opacity-40"
                >
                  Send to Scanner Studio
                </button>
                <button
                  onClick={() => handleExecuteMerge(false)}
                  disabled={loading || mergeFiles.length < 2}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 disabled:opacity-40"
                >
                  <Download size={15} /> Merge & Download
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleExecuteSplit(true)}
                  disabled={loading || !splitFile || selectedPages.size === 0}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all disabled:opacity-40"
                >
                  Send to Studio
                </button>
                <button
                  onClick={() => handleExecuteSplit(false)}
                  disabled={loading || !splitFile || selectedPages.size === 0}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 disabled:opacity-40"
                >
                  <Download size={15} /> Extract Selected ({selectedPages.size})
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
