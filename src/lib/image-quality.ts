/**
 * Client-side blur detection using the variance of the Laplacian of the grayscale image.
 * Returns a number — higher = sharper. Typical thresholds: < 60 = blurry, > 100 = OK.
 */
export async function estimateBlurScore(file: File | Blob): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    // Downscale for speed
    const maxDim = 480;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(64, Math.round(img.width * scale));
    const h = Math.max(64, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    // Convert to grayscale
    const gray = new Float32Array(w * h);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // Laplacian (3x3): center = 4*p - up - down - left - right
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap =
          4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
        sum += lap;
        sumSq += lap * lap;
        count++;
      }
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    return variance;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/**
 * Estimates the decoded size of a base64 data URL in bytes.
 */
export function dataUrlSizeBytes(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

/**
 * Compress/downscale an image to a JPEG data URL and keep shrinking it
 * until it fits under the target byte size.
 */
export async function compressImageToDataUrl(
  source: File | Blob | string,
  options?: {
    maxDim?: number;
    quality?: number;
    maxBytes?: number;
    minDim?: number;
    minQuality?: number;
  },
): Promise<string> {
  const {
    maxDim = 960,
    quality = 0.72,
    maxBytes = 180 * 1024,
    minDim = 640,
    minQuality = 0.42,
  } = options ?? {};

  const objectUrl = typeof source === "string" ? null : URL.createObjectURL(source);
  const src = typeof source === "string" ? source : objectUrl!;

  try {
    const img = await loadImage(src);
    let currentDim = Math.min(maxDim, Math.max(img.width, img.height));
    let currentQuality = quality;

    for (let attempt = 0; attempt < 8; attempt++) {
      const scale = Math.min(1, currentDim / Math.max(img.width, img.height));
      const w = Math.max(320, Math.round(img.width * scale));
      const h = Math.max(320, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL("image/jpeg", currentQuality);
      if (dataUrlSizeBytes(dataUrl) <= maxBytes) return dataUrl;

      if (currentQuality > minQuality) {
        currentQuality = Math.max(minQuality, currentQuality - 0.08);
      } else if (currentDim > minDim) {
        currentDim = Math.max(minDim, Math.round(currentDim * 0.82));
      } else {
        return dataUrl;
      }
    }

    const fallbackCanvas = document.createElement("canvas");
    const fallbackScale = Math.min(1, minDim / Math.max(img.width, img.height));
    fallbackCanvas.width = Math.max(320, Math.round(img.width * fallbackScale));
    fallbackCanvas.height = Math.max(320, Math.round(img.height * fallbackScale));
    const fallbackCtx = fallbackCanvas.getContext("2d")!;
    fallbackCtx.drawImage(img, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
    return fallbackCanvas.toDataURL("image/jpeg", minQuality);
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
