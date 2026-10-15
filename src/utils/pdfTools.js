import { PDFDocument, degrees } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'

/**
 * Merge multiple PDF files into a single PDF Document.
 * @param {File[]} pdfFiles - Array of File objects representing PDFs
 * @returns {Promise<Uint8Array>} - Merged PDF bytes
 */
export async function mergePdfFiles(pdfFiles) {
  const mergedPdf = await PDFDocument.create()

  for (const file of pdfFiles) {
    const arrayBuffer = await file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    const pageIndices = pdfDoc.getPageIndices()
    const copiedPages = await mergedPdf.copyPages(pdfDoc, pageIndices)
    copiedPages.forEach((page) => mergedPdf.addPage(page))
  }

  return await mergedPdf.save()
}

/**
 * Split a PDF by extracting specific page indices.
 * @param {File} pdfFile - Source PDF file
 * @param {number[]} pageIndices - 0-indexed array of pages to extract
 * @param {Object} rotations - Map of page index to rotation angle (e.g. { 0: 90 })
 * @returns {Promise<Uint8Array>} - New PDF bytes with only selected pages
 */
export async function splitAndOrganizePdf(pdfFile, pageIndices, rotations = {}) {
  const arrayBuffer = await pdfFile.arrayBuffer()
  const sourcePdf = await PDFDocument.load(arrayBuffer)
  const targetPdf = await PDFDocument.create()

  const copiedPages = await targetPdf.copyPages(sourcePdf, pageIndices)

  copiedPages.forEach((page, idx) => {
    const origIndex = pageIndices[idx]
    if (rotations[origIndex]) {
      const currentRotation = page.getRotation().angle
      page.setRotation(degrees((currentRotation + rotations[origIndex]) % 360))
    }
    targetPdf.addPage(page)
  })

  return await targetPdf.save()
}

/**
 * Renders thumbnail data URLs for all pages of a PDF file using pdfjs-dist.
 * @param {File} pdfFile 
 * @param {number} scale 
 * @returns {Promise<{ pageIndex: number, dataUrl: string, width: number, height: number }[]>}
 */
export async function renderPdfThumbnails(pdfFile, scale = 0.5) {
  const arrayBuffer = await pdfFile.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const thumbnails = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise

    thumbnails.push({
      pageIndex: i - 1, // 0-based
      pageNumber: i,
      dataUrl: canvas.toDataURL('image/jpeg', 0.8),
      width: viewport.width,
      height: viewport.height,
    })
  }

  return thumbnails
}

/**
 * Extracts searchable text per page from a PDF file using pdfjs-dist.
 * @param {File} pdfFile 
 * @returns {Promise<{ pageNumber: number, text: string }[]>}
 */
export async function extractPdfSearchableText(pdfFile) {
  const arrayBuffer = await pdfFile.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pagesText = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageString = textContent.items.map((item) => item.str).join(' ')
    pagesText.push({
      pageNumber: i,
      text: pageString,
    })
  }

  return pagesText
}
