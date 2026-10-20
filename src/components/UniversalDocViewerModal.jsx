import { useState, useRef, useEffect } from 'react'
import {
  X, FileText, Presentation, FileCode, ZoomIn, ZoomOut, Maximize2, Minimize2,
  ChevronLeft, ChevronRight, Download, Printer, Copy, Check, Upload,
  Layers, Loader2, Sparkles, AlertCircle, Eye, ArrowRight, RotateCw,
  Sun, Moon, BookOpen, PenTool, Image as ImageIcon, Search, Volume2, Volume1, VolumeX,
  Play, Pause, Square, FastForward, Sliders
} from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import Tesseract from 'tesseract.js'
import { parseDocx, parsePptx, parsePlainText } from '../utils/documentParser'
import { extractPdfSearchableText } from '../utils/pdfTools'
import { generateNarrationWav, downloadAudioFile } from '../utils/audioExport'
import { convertPptxToPdf } from '../utils/pptxConverter'
import { triggerHaptic } from '../utils/haptics'

// ─── AI Multi-Language Dubbing Languages & Client-Side Translator ───────────
const DUBBING_LANGUAGES = [
  { id: 'en', label: 'English', sub: 'Original / Global', langCode: 'en-US', flag: '🇬🇧', keywords: ['english', 'en-', 'en_'] },
  { id: 'ta', label: 'Tamil (தமிழ்)', sub: 'தமிழ் குரல்', langCode: 'ta-IN', flag: '🇮🇳', keywords: ['tamil', 'ta-in', 'ta_in', 'valluvar', 'kalpana', 'ta'] },
  { id: 'hi', label: 'Hindi (हिन्दी)', sub: 'हिन्दी आवाज़', langCode: 'hi-IN', flag: '🇮🇳', keywords: ['hindi', 'hi-in', 'hi_in', 'hemant', 'swara', 'madhur', 'ananya', 'kalpana', 'hi'] },
  { id: 'ml', label: 'Malayalam (മലയാളം)', sub: 'മലയാള ശബ്ദം', langCode: 'ml-IN', flag: '🇮🇳', keywords: ['malayalam', 'ml-in', 'ml_in', 'ml'] },
  { id: 'de', label: 'German (Deutsch)', sub: 'Deutsche Stimme', langCode: 'de-DE', flag: '🇩🇪', keywords: ['german', 'de-de', 'deutsch'] },
  { id: 'es', label: 'Spanish (Español)', sub: 'Voz en Español', langCode: 'es-ES', flag: '🇪🇸', keywords: ['spanish', 'es-es', 'español'] },
  { id: 'fr', label: 'French (Français)', sub: 'Voix Française', langCode: 'fr-FR', flag: '🇫🇷', keywords: ['french', 'fr-fr', 'français'] },
]

export function getBestVoiceForLang(langId, voices) {
  if (!voices || voices.length === 0) return null
  const cfg = DUBBING_LANGUAGES.find((l) => l.id === langId)
  if (!cfg) return null
  const keywords = cfg.keywords || [langId]

  // Filter voices matching the language code or name keywords
  const matches = voices.filter((v) => {
    const l = (v.lang || '').toLowerCase().replace('_', '-')
    const n = (v.name || '').toLowerCase()
    return (
      l.startsWith(cfg.langCode.toLowerCase()) ||
      l.startsWith(langId.toLowerCase()) ||
      keywords.some((k) => n.includes(k) || l.includes(k))
    )
  })

  if (matches.length > 0) {
    // Prefer Natural, Google, Neural, Online, or first matched
    const best =
      matches.find((v) => v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural')) ||
      matches[0]
    return best
  }

  return null
}

async function translateTextForDubbing(text, targetLang) {
  if (targetLang === 'en' || !text.trim()) return text

  // If text already contains the target language's native script, keep as is!
  if (targetLang === 'ta' && /[\u0B80-\u0BFF]/.test(text)) {
    return text
  }
  if (targetLang === 'hi' && /[\u0900-\u097F]/.test(text)) {
    return text
  }
  if (targetLang === 'ml' && /[\u0D00-\u0D7F]/.test(text)) {
    return text
  }

  // Split into natural sentence chunks (max 300 chars to avoid API truncation)
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+/g) || [text]
  const chunks = []
  let cur = ''

  for (const s of sentences) {
    if ((cur + ' ' + s).length > 300) {
      if (cur.trim()) chunks.push(cur.trim())
      cur = s
    } else {
      cur += (cur ? ' ' : '') + s
    }
  }
  if (cur.trim()) chunks.push(cur.trim())

  const translated = []
  for (const chunk of chunks) {
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|${targetLang}`
      const res = await fetch(url)
      const data = await res.json()
      if (data && data.responseData && data.responseData.translatedText) {
        translated.push(data.responseData.translatedText)
      } else {
        translated.push(chunk)
      }
    } catch (e) {
      console.warn('Dubbing translation chunk error:', e)
      translated.push(chunk)
    }
  }

  return translated.join(' ')
}

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
  const [imageOcrText, setImageOcrText] = useState('')

  // ─── Feature 2: Audio Read-Out (TTS / Study Speaker) ──────────────────────
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSpeechPaused, setIsSpeechPaused] = useState(false)
  const [speechSpeed, setSpeechSpeed] = useState(1.0)
  const [speechStatus, setSpeechStatus] = useState('')
  const [showTTSPlayer, setShowTTSPlayer] = useState(false)
  const [availableVoices, setAvailableVoices] = useState([])
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(() => localStorage.getItem('kamalscan_tts_voice') || '')
  const [speechPitch, setSpeechPitch] = useState(1.0)
  const [speechVolume, setSpeechVolume] = useState(() => {
    const saved = localStorage.getItem('kamalscan_tts_volume')
    return saved !== null ? parseFloat(saved) : 1.0
  })
  const [dubbingLang, setDubbingLang] = useState(() => localStorage.getItem('kamalscan_dubbing_lang') || 'en')
  const [dubbedTranscript, setDubbedTranscript] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)

  // ─── Feature 4: In-Viewer Keyword Search ──────────────────────────────────
  const [showSearchBar, setShowSearchBar] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([]) // { pageNumber, snippet }
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const searchInputRef = useRef(null)

  const modalContainerRef = useRef(null)

  // Auto-load initialFile if provided
  useEffect(() => {
    if (initialFile) {
      loadFile(initialFile)
    }
  }, [initialFile])

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // Load available system & browser voices
  useEffect(() => {
    if (!('speechSynthesis' in window)) return

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices() || []
      if (voices.length > 0) {
        setAvailableVoices(voices)
        if (!selectedVoiceURI || selectedVoiceURI === '__native_lang__') {
          const preferred = getBestVoiceForLang(dubbingLang, voices) || voices[0]
          if (preferred) {
            setSelectedVoiceURI(preferred.voiceURI)
            localStorage.setItem('kamalscan_tts_voice', preferred.voiceURI)
          }
        }
      }
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
  }, [selectedVoiceURI, dubbingLang])

  const changePitch = (pitch) => {
    setSpeechPitch(pitch)
    if (isSpeaking) {
      stopTTS()
      setTimeout(startTTS, 150)
    }
  }

  const changeVolume = (volumeVal) => {
    const clamped = Math.max(0, Math.min(1, volumeVal))
    setSpeechVolume(clamped)
    localStorage.setItem('kamalscan_tts_volume', clamped.toString())
    if (isSpeaking) {
      stopTTS()
      setTimeout(startTTS, 150)
    }
  }

  const changeVoice = (voiceURI) => {
    setSelectedVoiceURI(voiceURI)
    localStorage.setItem('kamalscan_tts_voice', voiceURI)
    if (isSpeaking) {
      stopTTS()
      setTimeout(startTTS, 150)
    }
  }

  const changeDubbingLanguage = (langId) => {
    setDubbingLang(langId)
    localStorage.setItem('kamalscan_dubbing_lang', langId)
    // Auto-select a voice matching this language if available
    const matching = getBestVoiceForLang(langId, availableVoices)
    if (matching) {
      setSelectedVoiceURI(matching.voiceURI)
      localStorage.setItem('kamalscan_tts_voice', matching.voiceURI)
    } else {
      setSelectedVoiceURI('__native_lang__')
      localStorage.setItem('kamalscan_tts_voice', '__native_lang__')
    }
    if (isSpeaking) {
      stopTTS()
      setTimeout(startTTS, 150)
    }
  }

  // Handle keyboard shortcuts (Esc, Left/Right arrows, F for fullscreen, R for rotate, Ctrl+F for search)
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        setShowSearchBar((prev) => {
          const next = !prev
          if (next) setTimeout(() => searchInputRef.current?.focus(), 100)
          return next
        })
        return
      }

      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'Escape' && !isFullscreen) {
        if (showSearchBar) {
          setShowSearchBar(false)
        } else {
          onClose()
        }
      }
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
  }, [currentPage, totalPages, isFullscreen, zoom, showSearchBar])

  // Re-render PDF page when page, zoom, or rotation changes
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
    setImageOcrText('')
    setSearchResults([])
    setSearchQuery('')
    stopTTS()

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
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1)
      if (isSpeaking) stopTTS()
    }
  }

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((p) => p + 1)
      if (isSpeaking) stopTTS()
    }
  }

  const handleZoomIn = () => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, +(z - 0.25).toFixed(2)))
  const handleResetZoom = () => setZoom(1)

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

  // ─── TTS Functions ──────────────────────────────────────────────────────────
  const startTTS = async () => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-Speech is not supported in this browser.')
      return
    }

    window.speechSynthesis.cancel()
    setShowTTSPlayer(true)
    setSpeechStatus('Preparing text to read aloud...')

    let textToSpeak = ''

    try {
      if (docType === 'docx') {
        const tmp = document.createElement('div')
        tmp.innerHTML = docxHtml
        textToSpeak = tmp.innerText || tmp.textContent
      } else if (docType === 'pptx') {
        const slide = pptxSlides[currentPage - 1]
        textToSpeak = `Slide ${currentPage}. ${slide?.title || ''}. ${slide?.notes || ''}`
      } else if (docType === 'text') {
        textToSpeak = plainText
      } else if (docType === 'pdf' && pdfDoc) {
        const page = await pdfDoc.getPage(currentPage)
        const textContent = await page.getTextContent()
        textToSpeak = textContent.items.map((item) => item.str).join(' ')
        if (!textToSpeak.trim()) {
          setSpeechStatus('Scanned PDF detected. Running on-device OCR...')
          const canvas = pdfCanvasRef.current
          if (canvas) {
            const { data: { text } } = await Tesseract.recognize(canvas.toDataURL('image/jpeg'), 'eng')
            textToSpeak = text
          }
        }
      } else if (docType === 'image' && imageUrl) {
        if (imageOcrText) {
          textToSpeak = imageOcrText
        } else {
          setSpeechStatus('Reading handwritten/typed notes with OCR...')
          const { data: { text } } = await Tesseract.recognize(imageUrl, 'eng')
          setImageOcrText(text)
          textToSpeak = text
        }
      }

      if (!textToSpeak.trim()) {
        setSpeechStatus('No readable text found on this page.')
        return
      }

      let spokenContent = textToSpeak
      const targetLangConfig = DUBBING_LANGUAGES.find((l) => l.id === dubbingLang) || DUBBING_LANGUAGES[0]

      if (dubbingLang !== 'en') {
        setIsTranslating(true)
        setSpeechStatus(`Translating to ${targetLangConfig.label} for AI Dubbing...`)
        try {
          const translated = await translateTextForDubbing(textToSpeak, dubbingLang)
          if (translated && translated.trim()) {
            spokenContent = translated
            setDubbedTranscript(translated)
          }
        } catch (e) {
          console.warn('Dubbing translation error:', e)
        } finally {
          setIsTranslating(false)
        }
      } else {
        setDubbedTranscript(textToSpeak)
      }

      const utterance = new SpeechSynthesisUtterance(spokenContent)
      utterance.rate = speechSpeed
      utterance.pitch = speechPitch
      utterance.volume = speechVolume // Adjustable voice sound (0.0 to 1.0)
      utterance.lang = targetLangConfig.langCode

      // If user selected a specific voice or find matching language voice
      if (selectedVoiceURI && selectedVoiceURI !== '__native_lang__' && availableVoices.length > 0) {
        const found = availableVoices.find((v) => v.voiceURI === selectedVoiceURI)
        if (found) utterance.voice = found
      } else {
        const langVoice = getBestVoiceForLang(dubbingLang, availableVoices)
        if (langVoice) utterance.voice = langVoice
      }

      utterance.onstart = () => {
        setIsSpeaking(true)
        setIsSpeechPaused(false)
        setSpeechStatus(dubbingLang !== 'en' ? `${targetLangConfig.flag} Dubbed reading in ${targetLangConfig.label}...` : `Reading page ${currentPage}...`)
      }

      utterance.onend = () => {
        setIsSpeaking(false)
        setIsSpeechPaused(false)
        setSpeechStatus('Finished reading.')
      }

      utterance.onerror = (e) => {
        console.warn('Speech error:', e)
        setIsSpeaking(false)
        setSpeechStatus('Speech synthesis ended.')
      }

      window.speechSynthesis.speak(utterance)
    } catch (err) {
      console.error(err)
      setSpeechStatus('Could not read text aloud: ' + err.message)
    }
  }

  const pauseTTS = () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause()
      setIsSpeechPaused(true)
      setIsSpeaking(false)
      setSpeechStatus('Speech paused')
    }
  }

  const resumeTTS = () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
      setIsSpeechPaused(false)
      setIsSpeaking(true)
      setSpeechStatus(`Reading page ${currentPage}...`)
    } else {
      startTTS()
    }
  }

  const stopTTS = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
    setIsSpeechPaused(false)
    setSpeechStatus('')
  }

  const changeSpeed = (rate) => {
    setSpeechSpeed(rate)
    if (isSpeaking) {
      stopTTS()
      setTimeout(startTTS, 150)
    }
  }

  const handleExportVoiceAudio = () => {
    try {
      triggerHaptic('medium')
      const textToExport = dubbedTranscript || plainText || (file?.name ? `Document: ${file.name}` : 'KamalScan Document')
      const audioBlob = generateNarrationWav(textToExport, 5)
      const cleanName = (file?.name || 'KamalScan-Doc').replace(/\.[^/.]+$/, '')
      downloadAudioFile(audioBlob, `${cleanName}-${dubbingLang}-AudioNote.wav`)
      triggerHaptic('success')
      setSpeechStatus('Audio note exported (.wav)')
    } catch (err) {
      alert('Could not export audio: ' + err.message)
    }
  }

  const handleConvertPptxToPdf = async () => {
    try {
      triggerHaptic('medium')
      setSpeechStatus('Converting PPT slides to PDF document...')
      const { blob, filename } = await convertPptxToPdf(file, file?.name || 'Presentation')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      triggerHaptic('success')
      setSpeechStatus('Converted PPTX to PDF successfully!')
    } catch (err) {
      alert('Could not convert PPT to PDF: ' + err.message)
    }
  }

  // ─── Search Functions ───────────────────────────────────────────────────────
  const handleExecuteSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    const query = searchQuery.toLowerCase()
    const matches = []

    try {
      if (docType === 'docx') {
        const tmp = document.createElement('div')
        tmp.innerHTML = docxHtml
        const text = tmp.innerText || ''
        const regex = new RegExp(query, 'gi')
        let match
        while ((match = regex.exec(text)) !== null) {
          const start = Math.max(0, match.index - 30)
          const end = Math.min(text.length, match.index + query.length + 30)
          matches.push({
            pageNumber: 1,
            snippet: '...' + text.slice(start, end).replace(/\n/g, ' ') + '...',
          })
        }
      } else if (docType === 'pptx') {
        pptxSlides.forEach((slide, idx) => {
          const fullText = (slide.title + ' ' + slide.notes).toLowerCase()
          if (fullText.includes(query)) {
            matches.push({
              pageNumber: idx + 1,
              snippet: `Slide ${idx + 1}: ${slide.title}`,
            })
          }
        })
      } else if (docType === 'text') {
        const lines = plainText.split('\n')
        lines.forEach((line, idx) => {
          if (line.toLowerCase().includes(query)) {
            matches.push({
              pageNumber: 1,
              snippet: `Line ${idx + 1}: ${line.trim().slice(0, 80)}`,
            })
          }
        })
      } else if (docType === 'pdf' && pdfDoc) {
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i)
          const textContent = await page.getTextContent()
          const pageText = textContent.items.map((it) => it.str).join(' ')
          if (pageText.toLowerCase().includes(query)) {
            const idx = pageText.toLowerCase().indexOf(query)
            const start = Math.max(0, idx - 30)
            const end = Math.min(pageText.length, idx + query.length + 30)
            matches.push({
              pageNumber: i,
              snippet: `p.${i}: ...${pageText.slice(start, end)}...`,
            })
          }
        }
      } else if (docType === 'image' && imageUrl) {
        let text = imageOcrText
        if (!text) {
          const { data } = await Tesseract.recognize(imageUrl, 'eng')
          text = data.text
          setImageOcrText(text)
        }
        if (text.toLowerCase().includes(query)) {
          matches.push({
            pageNumber: 1,
            snippet: `Found in notes: "...${text.slice(0, 100)}..."`,
          })
        }
      }

      setSearchResults(matches)
      setCurrentMatchIdx(0)
      if (matches.length > 0) {
        setCurrentPage(matches[0].pageNumber)
      }
    } catch (e) {
      console.error('Search error:', e)
    } finally {
      setIsSearching(false)
    }
  }

  const nextMatch = () => {
    if (!searchResults.length) return
    const nextIdx = (currentMatchIdx + 1) % searchResults.length
    setCurrentMatchIdx(nextIdx)
    setCurrentPage(searchResults[nextIdx].pageNumber)
  }

  const prevMatch = () => {
    if (!searchResults.length) return
    const prevIdx = (currentMatchIdx - 1 + searchResults.length) % searchResults.length
    setCurrentMatchIdx(prevIdx)
    setCurrentPage(searchResults[prevIdx].pageNumber)
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
  const currentLangConfig = DUBBING_LANGUAGES.find((l) => l.id === dubbingLang) || DUBBING_LANGUAGES[0]

  const matchedVoices = availableVoices.filter((v) => {
    const l = (v.lang || '').toLowerCase().replace('_', '-')
    const n = (v.name || '').toLowerCase()
    return (
      l.startsWith(currentLangConfig.langCode.toLowerCase()) ||
      l.startsWith(dubbingLang.toLowerCase()) ||
      (currentLangConfig.keywords || []).some((k) => n.includes(k) || l.includes(k))
    )
  })
  const otherVoices = availableVoices.filter((v) => !matchedVoices.includes(v))

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
              <h3 className="font-bold text-sm truncate max-w-[180px] sm:max-w-xs md:max-w-md">
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

        {/* Center: Page Controls & Study Audio & Search */}
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

          {/* 🔍 Search In Document Button (Ctrl+F) */}
          <button
            onClick={() => {
              setShowSearchBar((prev) => {
                const next = !prev
                if (next) setTimeout(() => searchInputRef.current?.focus(), 100)
                return next
              })
            }}
            className={`p-2 rounded-xl transition-colors ${
              showSearchBar ? 'bg-sky-600 text-white' : 'hover:bg-black/10 dark:hover:bg-white/10 text-xs font-semibold'
            }`}
            title="Search In Document / OCR Keywords (Ctrl+F)"
          >
            <Search size={15} />
          </button>

          {/* 🔊 Audio Read-Out (TTS / Study Speaker) Button */}
          <button
            onClick={() => {
              if (isSpeaking) {
                pauseTTS()
              } else if (isSpeechPaused) {
                resumeTTS()
              } else {
                startTTS()
              }
            }}
            className={`p-2 rounded-xl transition-colors ${
              isSpeaking
                ? 'bg-emerald-600 text-white animate-pulse'
                : 'hover:bg-black/10 dark:hover:bg-white/10 text-xs font-semibold'
            }`}
            title="Listen Aloud (Text-to-Speech Study Speaker)"
          >
            <Volume2 size={15} />
          </button>

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

          {/* Convert PPTX to PDF */}
          {docType === 'pptx' && (
            <button
              onClick={handleConvertPptxToPdf}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-98 cursor-pointer"
              title="Convert this PowerPoint presentation to a PDF document"
            >
              <Download size={13} />
              <span>Convert to PDF</span>
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

      {/* ─── Floating In-Viewer Keyword Search Bar ────────────────────────── */}
      {showSearchBar && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 w-full max-w-md p-2 animate-slide-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 flex items-center gap-2">
            <Search size={16} className="text-slate-400 ml-2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleExecuteSearch()
              }}
              placeholder="Search keyword in document / notes..."
              className="flex-1 bg-transparent border-none text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none"
            />

            {searchResults.length > 0 && (
              <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                {currentMatchIdx + 1} of {searchResults.length}
              </span>
            )}

            <button
              onClick={handleExecuteSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-2.5 py-1 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all disabled:opacity-40"
            >
              {isSearching ? <Loader2 size={12} className="animate-spin" /> : 'Find'}
            </button>

            {searchResults.length > 0 && (
              <div className="flex items-center gap-0.5 border-l border-slate-200 dark:border-slate-700 pl-1">
                <button
                  onClick={prevMatch}
                  className="p-1 hover:text-sky-600 text-slate-500"
                  title="Previous Match"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  onClick={nextMatch}
                  className="p-1 hover:text-sky-600 text-slate-500"
                  title="Next Match"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setShowSearchBar(false)
                setSearchResults([])
              }}
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <X size={15} />
            </button>
          </div>

          {/* Match Snippet Pill */}
          {searchResults.length > 0 && searchResults[currentMatchIdx] && (
            <div className="mt-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-[11px] font-medium shadow-lg backdrop-blur-xs flex items-center justify-between">
              <span className="truncate">
                {searchResults[currentMatchIdx].snippet}
              </span>
              <span className="text-[10px] opacity-75 shrink-0 ml-2">
                Page {searchResults[currentMatchIdx].pageNumber}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── Floating AI Dubbing & Audio Player Bar ─────────────────────── */}
      {showTTSPlayer && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 w-full max-w-lg px-3 animate-slide-in">
          
          {/* Live Dubbing Subtitle / Transcript Banner */}
          {dubbedTranscript && (
            <div className="mb-2 bg-slate-900/95 dark:bg-slate-800/95 text-white rounded-2xl shadow-xl border border-slate-700/80 p-3 backdrop-blur-md">
              <div className="flex items-center justify-between text-xs pb-1 mb-1 border-b border-slate-700">
                <span className="font-bold flex items-center gap-1.5 text-sky-400">
                  <span>{DUBBING_LANGUAGES.find((l) => l.id === dubbingLang)?.flag || '🌐'}</span>
                  <span>{DUBBING_LANGUAGES.find((l) => l.id === dubbingLang)?.label} Transcript</span>
                  {isTranslating && <span className="text-[10px] text-amber-400 animate-pulse">(Translating...)</span>}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(dubbedTranscript)
                    alert('Transcript copied to clipboard!')
                  }}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Copy Text
                </button>
              </div>
              <p className="text-xs text-slate-200 line-clamp-3 leading-relaxed">
                {dubbedTranscript}
              </p>
            </div>
          )}

          <div className="bg-slate-900/95 dark:bg-slate-800/95 text-white rounded-3xl shadow-2xl border border-slate-700 p-3.5 backdrop-blur-md space-y-2.5">
            
            {/* Top Row: Playback status, Play/Pause, Stop, Speed */}
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shrink-0 shadow-md">
                  <Volume2 size={16} className={isSpeaking ? 'animate-pulse' : ''} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold truncate">Study AI Speaker</p>
                    <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                      {DUBBING_LANGUAGES.find((l) => l.id === dubbingLang)?.flag} {dubbingLang.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">{speechStatus}</p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Play / Pause */}
                {isSpeaking ? (
                  <button
                    onClick={pauseTTS}
                    className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white cursor-pointer transition-all"
                    title="Pause"
                  >
                    <Pause size={15} />
                  </button>
                ) : (
                  <button
                    onClick={resumeTTS}
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-md transition-all active:scale-95"
                    title="Play / Resume"
                  >
                    <Play size={15} />
                  </button>
                )}

                {/* Stop */}
                <button
                  onClick={() => {
                    stopTTS()
                    setShowTTSPlayer(false)
                  }}
                  className="p-2 rounded-xl hover:bg-white/20 text-slate-300 cursor-pointer transition-all"
                  title="Close Audio Player"
                >
                  <Square size={14} />
                </button>

                {/* Speed Switcher */}
                <div className="flex items-center bg-black/40 rounded-xl p-0.5 ml-1 text-[10px] font-bold">
                  {[0.75, 1.0, 1.25, 1.5].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => changeSpeed(rate)}
                      className={`px-1.5 py-0.5 rounded-lg transition-colors cursor-pointer ${
                        speechSpeed === rate ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Middle Row 1: Adjustable Voice Sound (Volume & Output Control) */}
            <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeVolume(speechVolume > 0 ? 0 : 1.0)}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
                  title={speechVolume === 0 ? "Unmute Sound" : "Mute Sound"}
                >
                  {speechVolume === 0 ? (
                    <VolumeX size={15} className="text-red-400" />
                  ) : speechVolume <= 0.5 ? (
                    <Volume1 size={15} className="text-amber-400" />
                  ) : (
                    <Volume2 size={15} className="text-emerald-400" />
                  )}
                </button>
                <span className="text-[10px] text-slate-300 font-bold shrink-0">Sound:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={speechVolume}
                  onChange={(e) => changeVolume(parseFloat(e.target.value))}
                  className="w-20 sm:w-28 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  title={`Voice Volume: ${Math.round(speechVolume * 100)}%`}
                />
                <span className="text-[10px] font-bold text-emerald-400 w-8">
                  {Math.round(speechVolume * 100)}%
                </span>
              </div>

              {/* Volume Quick Presets */}
              <div className="flex items-center gap-1 bg-black/40 rounded-xl p-0.5 text-[9px] font-semibold shrink-0">
                {[0.5, 0.8, 1.0].map((v) => (
                  <button
                    key={v}
                    onClick={() => changeVolume(v)}
                    className={`px-1.5 py-0.5 rounded-lg transition-colors cursor-pointer ${
                      Math.abs(speechVolume - v) < 0.05
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {Math.round(v * 100)}%
                  </button>
                ))}
              </div>
            </div>

            {/* Middle Row 2: AI Dubbing Language Selector Pills */}
            <div className="pt-2 border-t border-slate-700/80">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
                <span>Dubbing &amp; Voice Language:</span>
                <span className="text-[10px] text-sky-400 font-medium">Tamil, Hindi &amp; Global Voices</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {DUBBING_LANGUAGES.map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => changeDubbingLanguage(lang.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer ${
                      dubbingLang === lang.id
                        ? 'bg-gradient-to-r from-sky-600 to-indigo-600 border-sky-400 text-white shadow-sm ring-1 ring-sky-400/50'
                        : 'bg-black/40 border-slate-700 text-slate-300 hover:bg-black/60 hover:text-white'
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom Row: Voice Selector & Tone / Pitch */}
            <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-[10px] text-slate-400 font-bold shrink-0">Voice:</span>
                <select
                  value={selectedVoiceURI}
                  onChange={(e) => changeVoice(e.target.value)}
                  className="bg-black/60 text-white text-[11px] font-medium rounded-xl px-2.5 py-1 border border-slate-700 truncate w-full focus:outline-none focus:ring-1 focus:ring-sky-400 cursor-pointer"
                >
                  <option value="__native_lang__" className="bg-slate-900 text-emerald-400 font-bold">
                    🌟 Native {currentLangConfig.label} Voice Engine
                  </option>
                  {matchedVoices.length > 0 && (
                    <optgroup label={`✨ ${currentLangConfig.label} Voices`}>
                      {matchedVoices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI} className="bg-slate-900 text-white">
                          {v.name.replace(/Microsoft |Google /g, '')} ({v.lang})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherVoices.length > 0 && (
                    <optgroup label="🌐 Other Available Voices">
                      {otherVoices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI} className="bg-slate-900 text-slate-300">
                          {v.name.replace(/Microsoft |Google /g, '')} ({v.lang})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Pitch / Tone Selector */}
              <div className="flex items-center gap-1 bg-black/40 rounded-xl p-0.5 shrink-0 text-[10px] font-semibold">
                <span className="text-[9px] text-slate-400 px-1">Tone:</span>
                {[
                  { label: 'Deep', val: 0.85 },
                  { label: 'Normal', val: 1.0 },
                  { label: 'Light', val: 1.15 }
                ].map((p) => (
                  <button
                    key={p.val}
                    onClick={() => changePitch(p.val)}
                    className={`px-1.5 py-0.5 rounded-lg transition-colors cursor-pointer ${
                      speechPitch === p.val ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio File Export / Download Row */}
            <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between gap-2 text-xs">
              <span className="text-[10px] text-slate-400">Audio Podcast / Voice Note:</span>
              <button
                onClick={handleExportVoiceAudio}
                className="px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                title="Download speech audio (.wav) to play or share"
              >
                <Download size={12} />
                <span>Export Audio (.wav)</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─── Main Full-Screen Reader Canvas (Google Drive Style) ─────────── */}
      <div className={`flex-1 overflow-auto flex flex-col items-center justify-center p-2 sm:p-6 relative ${theme.viewerBg}`}>
        {/* Prominent In-Canvas Close / Cross Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 px-3.5 py-1.5 rounded-full bg-slate-900/85 hover:bg-red-600 text-white text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-1.5 transition-all cursor-pointer border border-white/20 hover:border-red-500 hover:scale-105 active:scale-95 group"
          title="Close Document & Return to Workspace (Esc)"
        >
          <X size={15} className="text-red-400 group-hover:text-white transition-colors" />
          <span>Close File</span>
        </button>

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
          <span className="hidden sm:inline">Press <b>Ctrl+F</b> to Search • <b>F</b> for Fullscreen • <b>R</b> to Rotate</span>
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
