/**
 * Color Filters & Document Enhancement Presets
 * Designed specifically for high-clarity document scanning & reading.
 */

export const ENHANCE_MODES = {
  none: {
    id: 'none',
    label: 'Original',
    badge: 'Raw',
    filter: 'none',
    description: 'Natural unaltered image',
  },
  magic: {
    id: 'magic',
    label: 'Magic Color (HD)',
    badge: 'Popular',
    filter: 'contrast(1.28) brightness(1.08) saturate(1.22)',
    description: 'Vibrant colors, whiter paper, enhanced text legibility',
  },
  super: {
    id: 'super',
    label: 'Super HD Crisp',
    badge: 'HD',
    filter: 'contrast(1.42) brightness(1.1) saturate(1.2)',
    description: 'High dynamic range with sharpened edges',
  },
  doc_bw: {
    id: 'doc_bw',
    label: 'Clean B&W',
    badge: 'Clean',
    filter: 'grayscale(1) contrast(1.75) brightness(1.12)',
    description: 'Strips out shadows and paper discoloration for pure B&W print',
  },
  grayscale: {
    id: 'grayscale',
    label: 'Grayscale',
    badge: 'Mono',
    filter: 'grayscale(1) contrast(1.2) brightness(1.04)',
    description: 'Balanced 256-level monochrome with smooth gradients',
  },
  warm: {
    id: 'warm',
    label: 'Warm Reading',
    badge: 'Soft',
    filter: 'sepia(0.3) contrast(1.1) brightness(1.02)',
    description: 'Gentle warm paper tone for comfortable long reading',
  },
  sharp: {
    id: 'sharp',
    label: 'Deep Contrast',
    badge: 'Sharp',
    filter: 'contrast(1.6) brightness(1.04)',
    description: 'Maximizes ink density on faint or pencil handwriting',
  },
  blueprint: {
    id: 'blueprint',
    label: 'Inverted Dark',
    badge: 'Night',
    filter: 'invert(1) hue-rotate(180deg) contrast(1.2)',
    description: 'Dark mode inverted view for low light inspection',
  },
}

export function getFilterStyle(mode) {
  return ENHANCE_MODES[mode]?.filter || 'none'
}
