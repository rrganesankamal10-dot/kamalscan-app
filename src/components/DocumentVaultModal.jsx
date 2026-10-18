import React, { useState, useEffect } from 'react'
import {
  X, Folder, FolderPlus, Search, Trash2, Download,
  ExternalLink, Calendar, FileText, Check, Sparkles,
  Share2, ArrowRight, Tag, BookOpen, CreditCard, Receipt, Award
} from 'lucide-react'
import {
  VAULT_CATEGORIES,
  getAllVaultDocuments,
  saveDocumentToVault,
  deleteVaultDocument
} from '../utils/vaultDb'
import { triggerHaptic } from '../utils/haptics'

export default function DocumentVaultModal({
  isOpen,
  onClose,
  currentQueue = [],
  onLoadPagesToQueue,
  onDirectExportPdf,
}) {
  const [documents, setDocuments] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Save new doc state
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocCategory, setNewDocCategory] = useState('study')
  const [isSaving, setIsSaving] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadDocs()
      if (currentQueue.length > 0) {
        setNewDocTitle(`Document_${new Date().toISOString().slice(0, 10)}`)
      }
    }
  }, [isOpen])

  const loadDocs = async () => {
    setIsLoading(true)
    try {
      const docs = await getAllVaultDocuments()
      setDocuments(docs)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveCurrentQueue = async () => {
    if (currentQueue.length === 0) return
    setIsSaving(true)
    try {
      triggerHaptic('medium')
      await saveDocumentToVault({
        title: newDocTitle.trim() || 'Untitled Scan',
        category: newDocCategory,
        pages: currentQueue,
      })
      triggerHaptic('success')
      setFeedbackMsg('Saved successfully to Vault!')
      setShowSaveForm(false)
      setTimeout(() => setFeedbackMsg(''), 3000)
      await loadDocs()
    } catch (err) {
      alert('Error saving to vault: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (docId, title) => {
    if (!window.confirm(`Delete "${title}" from offline vault?`)) return
    triggerHaptic('light')
    await deleteVaultDocument(docId)
    setDocuments((prev) => prev.filter((d) => d.id !== docId))
  }

  const handleLoadToWorkspace = (doc) => {
    triggerHaptic('medium')
    onLoadPagesToQueue(doc.pages)
    onClose()
  }

  if (!isOpen) return null

  const filteredDocs = documents.filter((doc) => {
    const matchesCat = selectedCategory === 'all' || doc.category === selectedCategory
    const matchesQuery = !searchQuery || doc.title.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesQuery
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
              <Folder size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Offline Document Vault</h3>
                <span className="text-[10px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full">
                  100% On-Device
                </span>
              </div>
              <p className="text-xs text-slate-400">Organize scanned folders, study notes &amp; receipts locally</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentQueue.length > 0 && (
              <button
                onClick={() => {
                  triggerHaptic('light')
                  setShowSaveForm(!showSaveForm)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <FolderPlus size={14} />
                <span className="hidden sm:inline">Save {currentQueue.length} Pages</span>
                <span className="sm:hidden">Save</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="px-5 py-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 border-b border-emerald-200 dark:border-emerald-800">
            <Check size={14} /> {feedbackMsg}
          </div>
        )}

        {/* Save Current Workspace Form (Collapsible) */}
        {showSaveForm && currentQueue.length > 0 && (
          <div className="p-4 bg-sky-50/60 dark:bg-sky-950/40 border-b border-sky-100 dark:border-sky-900/60 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input
              type="text"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              placeholder="Document name (e.g. Physics Notes Chapter 4)"
              className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            />
            <select
              value={newDocCategory}
              onChange={(e) => setNewDocCategory(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium"
            >
              {VAULT_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <button
              onClick={handleSaveCurrentQueue}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Check size={14} /> Save to Vault
            </button>
          </div>
        )}

        {/* Search & Category Filter Pills */}
        <div className="p-3 sm:px-5 sm:py-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {VAULT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  triggerHaptic('light')
                  setSelectedCategory(cat.id)
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Documents Grid / List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              Loading offline vault...
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="py-16 text-center max-w-sm mx-auto space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <Folder size={24} />
              </div>
              <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">No documents in this folder</h4>
              <p className="text-xs text-slate-400">
                Scan pages or tap "Save Pages" to organize your files into offline folders with instant 1-tap recall!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredDocs.map((doc) => {
                const catObj = VAULT_CATEGORIES.find((c) => c.id === doc.category) || VAULT_CATEGORIES[1]
                const dateStr = new Date(doc.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })

                return (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top thumbnail & badge */}
                      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 mb-3 border border-slate-100 dark:border-slate-800 flex items-center justify-center">
                        {doc.thumbnail ? (
                          <img
                            src={doc.thumbnail}
                            alt={doc.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <FileText size={32} className="text-slate-400" />
                        )}
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white">
                          {doc.pageCount || 1} {doc.pageCount === 1 ? 'Page' : 'Pages'}
                        </span>
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 text-[9px] font-bold shadow-xs">
                          {catObj.label}
                        </span>
                      </div>

                      {/* Title & Date */}
                      <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate mb-1" title={doc.title}>
                        {doc.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 mb-3">
                        <Calendar size={10} /> {dateStr}
                      </p>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-1.5">
                      <button
                        onClick={() => handleLoadToWorkspace(doc)}
                        className="flex-1 py-1.5 px-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="Load into scanner workspace"
                      >
                        <ArrowRight size={12} /> Open in Scanner
                      </button>

                      {onDirectExportPdf && (
                        <button
                          onClick={() => onDirectExportPdf(doc.pages, doc.title)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors"
                          title="Export PDF"
                        >
                          <Download size={14} />
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(doc.id, doc.title)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                        title="Delete from vault"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-400 font-medium">
          Vault data is stored encrypted/isolated inside your device browser/app IndexedDB. Zero cloud uploads.
        </div>
      </div>
    </div>
  )
}
