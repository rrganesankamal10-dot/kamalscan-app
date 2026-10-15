/**
 * Client-Side Universal Document Parser
 * Parses DOCX, PPTX, PDF, and Text files 100% locally in browser.
 */
import mammoth from 'mammoth'
import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist'

/**
 * Parses a DOCX file into clean HTML and plain text
 */
export async function parseDocx(fileOrBuffer) {
  const arrayBuffer = fileOrBuffer instanceof ArrayBuffer
    ? fileOrBuffer
    : await fileOrBuffer.arrayBuffer()

  const result = await mammoth.convertToHtml({ arrayBuffer })
  const rawTextResult = await mammoth.extractRawText({ arrayBuffer })

  return {
    type: 'docx',
    html: result.value,
    text: rawTextResult.value,
    messages: result.messages,
  }
}

/**
 * Parses a PPTX presentation file into individual slides with titles, bullet points, and images.
 */
export async function parsePptx(fileOrBuffer) {
  const arrayBuffer = fileOrBuffer instanceof ArrayBuffer
    ? fileOrBuffer
    : await fileOrBuffer.arrayBuffer()

  const zip = await JSZip.loadAsync(arrayBuffer)
  const slides = []

  // 1. Find all slide XML files in ppt/slides/
  const slideFileNames = Object.keys(zip.files).filter((path) =>
    path.match(/^ppt\/slides\/slide[0-9]+\.xml$/i)
  )

  // Sort slides in natural numeric order (slide1, slide2, ..., slide10)
  slideFileNames.sort((a, b) => {
    const numA = parseInt(a.match(/slide([0-9]+)\.xml/i)[1], 10)
    const numB = parseInt(b.match(/slide([0-9]+)\.xml/i)[1], 10)
    return numA - numB
  })

  // 2. Pre-extract all media images from ppt/media/
  const mediaCache = {}
  const mediaFiles = Object.keys(zip.files).filter((path) =>
    path.startsWith('ppt/media/')
  )
  for (const mPath of mediaFiles) {
    const file = zip.files[mPath]
    if (file && !file.dir) {
      const base64 = await file.async('base64')
      const ext = mPath.split('.').pop().toLowerCase()
      const mime = ext === 'png' ? 'image/png' : ext === 'jpeg' || ext === 'jpg' ? 'image/jpeg' : 'image/png'
      mediaCache[mPath] = `data:${mime};base64,${base64}`
    }
  }

  // 3. Parse each slide XML
  const parser = new DOMParser()
  for (let idx = 0; idx < slideFileNames.length; idx++) {
    const slidePath = slideFileNames[idx]
    const xmlContent = await zip.files[slidePath].async('string')
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml')

    // Find slide relationships to resolve embedded images
    const relsPath = slidePath.replace('ppt/slides/slide', 'ppt/slides/_rels/slide') + '.rels'
    const slideImages = []
    if (zip.files[relsPath]) {
      const relsXml = await zip.files[relsPath].async('string')
      const relsDoc = parser.parseFromString(relsXml, 'application/xml')
      const relElements = relsDoc.getElementsByTagName('Relationship')
      for (let r = 0; r < relElements.length; r++) {
        const target = relElements[r].getAttribute('Target')
        if (target && target.includes('../media/')) {
          const mediaKey = 'ppt/' + target.replace('../', '')
          if (mediaCache[mediaKey]) {
            slideImages.push(mediaCache[mediaKey])
          }
        }
      }
    }

    // Extract text paragraphs and runs (<a:p>, <a:t>)
    const paragraphs = []
    const pElements = xmlDoc.getElementsByTagName('a:p')
    for (let p = 0; p < pElements.length; p++) {
      const pNode = pElements[p]
      const textNodes = pNode.getElementsByTagName('a:t')
      let pText = ''
      for (let t = 0; t < textNodes.length; t++) {
        pText += textNodes[t].textContent
      }
      pText = pText.trim()
      if (pText) {
        paragraphs.push(pText)
      }
    }

    const title = paragraphs[0] || `Slide ${idx + 1}`
    const bodyText = paragraphs.slice(1)

    slides.push({
      slideNumber: idx + 1,
      title,
      paragraphs,
      bodyText,
      images: slideImages,
    })
  }

  return {
    type: 'pptx',
    totalSlides: slides.length,
    slides,
  }
}

/**
 * Parses plain text / Markdown / CSV
 */
export async function parsePlainText(file) {
  const text = await file.text()
  return {
    type: 'text',
    text,
  }
}
