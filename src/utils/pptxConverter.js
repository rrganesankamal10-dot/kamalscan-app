/**
 * Offline Client-Side PDF to PPTX & PPTX to PDF Converter
 * 100% offline & client-side using JSZip and jsPDF. Zero server dependencies.
 */
import JSZip from 'jszip'
import jsPDF from 'jspdf'
import { parsePptx } from './documentParser'

/**
 * Converts scanned document pages or images into a Microsoft PowerPoint (.pptx) file
 */
export async function convertPagesToPptx(pages, presentationTitle = 'KamalScan-Presentation') {
  if (!pages || pages.length === 0) throw new Error('No pages to convert to PowerPoint')

  const zip = new JSZip()
  const cleanTitle = presentationTitle.replace(/[^\w\s-]/gi, '').trim() || 'Presentation'

  // Standard 16:9 Widescreen slide dimensions in EMU (914400 EMU = 1 inch)
  // 10 inches wide x 5.625 inches high
  const slideWidthEMU = 9144000
  const slideHeightEMU = 5143500

  // 1. [Content_Types].xml
  let contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>`

  for (let i = 1; i <= pages.length; i++) {
    contentTypes += `\n  <Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
  }
  contentTypes += '\n</Types>'
  zip.file('[Content_Types].xml', contentTypes)

  // 2. _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`)

  // 3. ppt/presentation.xml
  let sldIdLst = ''
  let presRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`

  for (let i = 1; i <= pages.length; i++) {
    const rId = `rId${i}`
    sldIdLst += `\n    <p:sldId id="${255 + i}" r:id="${rId}"/>`
    presRels += `\n  <Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`
  }
  presRels += '\n</Relationships>'

  zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst/>
  <p:sldIdLst>${sldIdLst}
  </p:sldIdLst>
  <p:sldSz cx="${slideWidthEMU}" cy="${slideHeightEMU}" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`)

  zip.file('ppt/_rels/presentation.xml.rels', presRels)

  // 4. Process each page into a slide and add image to ppt/media/
  for (let i = 0; i < pages.length; i++) {
    const pageIndex = i + 1
    const page = pages[i]
    const imgSrc = page.previewUrl || page.dataUrl
    
    // Extract raw base64 data and mime type
    const match = imgSrc.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/)
    const ext = match && match[1].includes('png') ? 'png' : 'jpeg'
    const base64Data = match ? match[2] : ''
    const imgFilename = `image${pageIndex}.${ext}`

    zip.file(`ppt/media/${imgFilename}`, base64Data, { base64: true })

    // Slide relationship pointing to media image
    zip.file(`ppt/slides/_rels/slide${pageIndex}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${imgFilename}"/>
</Relationships>`)

    // Slide XML with centered full image
    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="${pageIndex + 1}" name="Slide Page ${pageIndex}"/>
          <p:cNvPicPr>
            <a:picLocks noChangeAspect="1"/>
          </p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId1"/>
          <a:stretch>
            <a:fillRect/>
          </a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="457200" y="257175"/>
            <a:ext cx="${slideWidthEMU - 914400}" cy="${slideHeightEMU - 514350}"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`
    zip.file(`ppt/slides/slide${pageIndex}.xml`, slideXml)
  }

  const pptxBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
  return {
    blob: pptxBlob,
    filename: `${cleanTitle}.pptx`
  }
}

/**
 * Converts a PowerPoint presentation (.pptx) into a high-resolution PDF document
 */
export async function convertPptxToPdf(fileOrBuffer, presentationTitle = 'PowerPoint-Doc') {
  const parsed = await parsePptx(fileOrBuffer)
  const slides = parsed.slides || []
  if (slides.length === 0) throw new Error('No slides found in this PowerPoint file')

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: [960, 540] // 16:9 widescreen presentation format
  })

  for (let i = 0; i < slides.length; i++) {
    if (i > 0) pdf.addPage([960, 540], 'landscape')
    const slide = slides[i]

    // Background gradient / dark theme
    pdf.setFillColor(248, 250, 252)
    pdf.rect(0, 0, 960, 540, 'F')

    // Top accent bar
    pdf.setFillColor(2, 132, 199)
    pdf.rect(0, 0, 960, 8, 'F')

    // Slide Title
    pdf.setTextColor(15, 23, 42)
    pdf.setFontSize(26)
    pdf.setFont('helvetica', 'bold')
    const title = slide.title || `Slide ${slide.slideNumber || i + 1}`
    pdf.text(title, 50, 55, { maxWidth: 860 })

    // If slide has images, embed primary image
    if (slide.images && slide.images.length > 0) {
      try {
        const primaryImg = slide.images[0]
        pdf.addImage(primaryImg, 'JPEG', 500, 90, 410, 380, undefined, 'FAST')
      } catch (e) {
        console.warn('Could not render slide image in PDF:', e)
      }
    }

    // Bullet points / Text content
    const bullets = slide.bullets || []
    if (bullets.length > 0) {
      pdf.setFontSize(15)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(51, 65, 85)
      let yPos = 110
      const textMaxWidth = slide.images && slide.images.length > 0 ? 420 : 860

      for (const bullet of bullets) {
        if (!bullet || !bullet.trim()) continue
        pdf.setFillColor(2, 132, 199)
        pdf.circle(55, yPos - 5, 3, 'F') // Bullet dot
        const lines = pdf.splitTextToSize(bullet, textMaxWidth)
        pdf.text(lines, 68, yPos)
        yPos += lines.length * 20 + 8
        if (yPos > 480) break
      }
    }

    // Slide footer
    pdf.setFontSize(10)
    pdf.setTextColor(148, 163, 184)
    pdf.text(`KamalScan Presentation Studio • Slide ${i + 1} of ${slides.length}`, 50, 515)
  }

  const cleanName = presentationTitle.replace(/\.[^/.]+$/, '').trim() || 'Presentation'
  const pdfBlob = pdf.output('blob')
  return {
    blob: pdfBlob,
    filename: `${cleanName}.pdf`
  }
}
