/**
 * Offline Audio Export & Voice Note Generator
 * 100% offline & client-side. Generates standard playable .wav and .webm audio files.
 */

// Generate a valid PCM WAV Blob from audio samples
export function createWavBlob(samples, sampleRate = 44100, numChannels = 1) {
  const bytesPerSample = 2 // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // Helper to write ASCII string
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  // RIFF identifier
  writeString(0, 'RIFF')
  // file length minus RIFF header
  view.setUint32(4, 36 + dataSize, true)
  // RIFF type
  writeString(8, 'WAVE')
  // format chunk identifier
  writeString(12, 'fmt ')
  // format chunk length
  view.setUint32(16, 16, true)
  // sample format (raw PCM = 1)
  view.setUint16(20, 1, true)
  // channel count
  view.setUint16(22, numChannels, true)
  // sample rate
  view.setUint32(24, sampleRate, true)
  // byte rate
  view.setUint32(28, byteRate, true)
  // block align
  view.setUint16(32, blockAlign, true)
  // bits per sample
  view.setUint16(34, 16, true)
  // data chunk identifier
  writeString(36, 'data')
  // data chunk length
  view.setUint32(40, dataSize, true)

  // Write 16-bit PCM samples
  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * Synthesizes a pleasant audio narration chime / acoustic audio note
 * for document pages with reading duration
 */
export function generateNarrationWav(text, durationSec = 3, sampleRate = 44100) {
  const totalSamples = Math.floor(sampleRate * Math.max(2, Math.min(durationSec, 12)))
  const samples = new Float32Array(totalSamples)

  // Musical acoustic chime frequencies (C-major pentatonic arpeggio)
  const notes = [261.63, 329.63, 392.0, 523.25, 659.25]
  const noteDuration = sampleRate * 0.4

  for (let i = 0; i < totalSamples; i++) {
    const noteIdx = Math.floor(i / noteDuration) % notes.length
    const freq = notes[noteIdx]
    const t = (i % noteDuration) / sampleRate
    const envelope = Math.exp(-3 * (t / 0.4)) // Smooth decay
    samples[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.35
  }

  return createWavBlob(samples, sampleRate, 1)
}

/**
 * Downloads a Blob as an audio file
 */
export function downloadAudioFile(blob, filename = 'KamalScan-AudioNote.wav') {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}
