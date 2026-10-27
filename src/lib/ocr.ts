export interface OcrResult {
  text: string;
  confidence: number;
}

/**
 * Local OCR with Tesseract.js (lazy-loaded). Language data (~10-25 MB per language) is downloaded
 * from the Tesseract CDN on first use and cached by the browser.
 * Handwriting and equations are NOT reliably recognised — results must be reviewed by the user.
 */
export async function ocrBlob(blob: Blob, langs: string, onProgress?: (p: number) => void): Promise<OcrResult> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(langs, 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(blob);
    return { text: data.text.trim(), confidence: Math.round(data.confidence) };
  } finally {
    await worker.terminate();
  }
}

export const LOW_CONFIDENCE = 70;
