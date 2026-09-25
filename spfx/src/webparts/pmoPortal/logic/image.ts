/** Размер снимка после сжатия: длинная сторона не больше max, пропорции сохраняются. */
export function fitSize(w: number, h: number, max: number): { w: number; h: number } {
  if (w <= max && h <= max) return { w, h };
  const k = max / Math.max(w, h);
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

/** Сжимает изображение в браузере до 1920 px по длинной стороне (JPEG); маленькие файлы оставляет как есть. */
export async function shrinkImage(file: Blob, max = 1920): Promise<Blob> {
  if (file.size < 400 * 1024) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
    const { w, h } = fitSize(img.naturalWidth, img.naturalHeight, max);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); if (!g) return file;
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
    const out = await new Promise<Blob | null>(resolve => c.toBlob(resolve, 'image/jpeg', 0.85));
    return out && out.size < file.size ? out : file;
  } catch { return file; } finally { URL.revokeObjectURL(url); }
}
