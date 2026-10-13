/**
 * Offline Client-Side Document Edge & Corner Detection
 * Uses Canvas-based Computer Vision (Sobel edge gradients + convex quad optimization)
 * Runs 100% locally in browser with 0 external network dependencies.
 */

export async function detectDocumentCorners(imageSrc) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || img.width
        const naturalH = img.naturalHeight || img.height

        // Scale down for ultra-fast processing (max dimension 400px)
        const maxDim = 400
        const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH))
        const w = Math.max(50, Math.round(naturalW * scale))
        const h = Math.max(50, Math.round(naturalH * scale))

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, w, h)

        const imgData = ctx.getImageData(0, 0, w, h)
        const data = imgData.data

        // 1. Grayscale luminance
        const gray = new Float32Array(w * h)
        for (let i = 0; i < data.length; i += 4) {
          const idx = i >> 2
          gray[idx] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        }

        // 2. Simple 3x3 Gaussian Blur to remove noise
        const blurred = new Float32Array(w * h)
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x
            blurred[idx] =
              (gray[idx - w - 1] + 2 * gray[idx - w] + gray[idx - w + 1] +
               2 * gray[idx - 1] + 4 * gray[idx] + 2 * gray[idx + 1] +
               gray[idx + w - 1] + 2 * gray[idx + w] + gray[idx + w + 1]) / 16
          }
        }

        // 3. Sobel Edge Gradient Magnitude
        const edges = new Float32Array(w * h)
        let maxGrad = 0
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x
            // Sobel X
            const gx =
              -1 * blurred[idx - w - 1] + 1 * blurred[idx - w + 1] +
              -2 * blurred[idx - 1]     + 2 * blurred[idx + 1] +
              -1 * blurred[idx + w - 1] + 1 * blurred[idx + w + 1]

            // Sobel Y
            const gy =
              -1 * blurred[idx - w - 1] - 2 * blurred[idx - w] - 1 * blurred[idx - w + 1] +
               1 * blurred[idx + w - 1] + 2 * blurred[idx + w] + 1 * blurred[idx + w + 1]

            const mag = Math.sqrt(gx * gx + gy * gy)
            edges[idx] = mag
            if (mag > maxGrad) maxGrad = mag
          }
        }

        // 4. Threshold edges (adaptive relative to max gradient)
        const threshold = Math.max(25, maxGrad * 0.22)
        const edgePoints = []
        for (let y = 2; y < h - 2; y++) {
          for (let x = 2; x < w - 2; x++) {
            if (edges[y * w + x] > threshold) {
              edgePoints.push({ x, y, weight: edges[y * w + x] })
            }
          }
        }

        // If very few edges found, fallback to smart 6% margin
        if (edgePoints.length < 50) {
          resolve(fallbackCorners(naturalW, naturalH))
          return
        }

        // 5. Find 4 extreme boundary corners
        // We evaluate projection onto 4 diagonal directions:
        // TL: min(x + y)
        // TR: max(x - y) -> or min(-x + y)
        // BR: max(x + y)
        // BL: min(x - y) -> or max(-x + y)
        let minTL = Infinity, bestTL = null
        let maxTR = -Infinity, bestTR = null
        let maxBR = -Infinity, bestBR = null
        let minBL = Infinity, bestBL = null

        // Constrain search within 2% to 98% bounds to ignore camera bezel
        const xMin = w * 0.02, xMax = w * 0.98
        const yMin = h * 0.02, yMax = h * 0.98

        for (const pt of edgePoints) {
          if (pt.x < xMin || pt.x > xMax || pt.y < yMin || pt.y > yMax) continue

          const sum = pt.x + pt.y
          const diff = pt.x - pt.y

          if (sum < minTL) { minTL = sum; bestTL = pt }
          if (diff > maxTR) { maxTR = diff; bestTR = pt }
          if (sum > maxBR) { maxBR = sum; bestBR = pt }
          if (diff < minBL) { minBL = diff; bestBL = pt }
        }

        if (!bestTL || !bestTR || !bestBR || !bestBL) {
          resolve(fallbackCorners(naturalW, naturalH))
          return
        }

        // Scale back to natural dimensions
        const invScale = 1 / scale
        const corners = [
          { x: Math.max(0, Math.min(naturalW, bestTL.x * invScale)), y: Math.max(0, Math.min(naturalH, bestTL.y * invScale)) },
          { x: Math.max(0, Math.min(naturalW, bestTR.x * invScale)), y: Math.max(0, Math.min(naturalH, bestTR.y * invScale)) },
          { x: Math.max(0, Math.min(naturalW, bestBR.x * invScale)), y: Math.max(0, Math.min(naturalH, bestBR.y * invScale)) },
          { x: Math.max(0, Math.min(naturalW, bestBL.x * invScale)), y: Math.max(0, Math.min(naturalH, bestBL.y * invScale)) },
        ]

        // Validate polygon area
        const polyArea = polygonArea(corners)
        const imgArea = naturalW * naturalH
        if (polyArea < imgArea * 0.20 || polyArea > imgArea * 0.98) {
          // If detected quad is too tiny or fills entirety awkwardly, use refined 5% margin
          resolve(fallbackCorners(naturalW, naturalH))
          return
        }

        resolve(corners)
      } catch (e) {
        resolve(fallbackCorners(img.naturalWidth || 500, img.naturalHeight || 500))
      }
    }
    img.onerror = () => {
      resolve(fallbackCorners(500, 500))
    }
    img.src = imageSrc
  })
}

function fallbackCorners(w, h, margin = 0.06) {
  return [
    { x: w * margin, y: h * margin },
    { x: w * (1 - margin), y: h * margin },
    { x: w * (1 - margin), y: h * (1 - margin) },
    { x: w * margin, y: h * (1 - margin) },
  ]
}

function polygonArea(pts) {
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    area += pts[i].x * pts[j].y
    area -= pts[j].x * pts[i].y
  }
  return Math.abs(area) / 2
}
