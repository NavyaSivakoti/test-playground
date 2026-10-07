// Identifies which sample document a captured frame/image shows, by average colour.
// front fixtures are green, back fixtures are blue (see public/fixtures).

export type Detected = 'FRONT' | 'BACK' | 'UNKNOWN'

export function detectFromCanvas(canvas: HTMLCanvasElement): { detected: Detected; avg: [number, number, number] } {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx || !canvas.width || !canvas.height) return { detected: 'UNKNOWN', avg: [0, 0, 0] }
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < data.length; i += 16) {
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
  }
  const avg: [number, number, number] = [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
  const [R, G, B] = avg
  let detected: Detected = 'UNKNOWN'
  if (G > R + 20 && G > B + 10) detected = 'FRONT'
  else if (B > R + 20 && B > G + 10) detected = 'BACK'
  return { detected, avg }
}

export async function detectFromBlob(blob: Blob): Promise<{ detected: Detected; avg: [number, number, number] }> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(bitmap.width, 320)
  canvas.height = Math.round((canvas.width / bitmap.width) * bitmap.height)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return detectFromCanvas(canvas)
}

export function detectFromVideo(video: HTMLVideoElement): { detected: Detected; avg: [number, number, number]; dataUrl: string } {
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(video.videoWidth || 320, 320)
  canvas.height = Math.round((canvas.width / (video.videoWidth || 320)) * (video.videoHeight || 240))
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
  return { ...detectFromCanvas(canvas), dataUrl: canvas.toDataURL('image/jpeg', 0.7) }
}
