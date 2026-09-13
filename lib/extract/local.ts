import fs from 'node:fs'
import path from 'node:path'
import { createWorker, type Worker as TesseractWorker } from 'tesseract.js'

import { MIN_RECOMMENDED_DIMENSION } from '../constants'
import type { AppConfig } from '../env'
import type { ExtractedTable } from '../types'
import { buildTableFromOcr, type OcrLine, type OcrPage } from './structure'
import { readDimensions } from './validate'

/**
 * Self-hosted fallback engine: tesseract.js running inside the Node process.
 * No image ever leaves the server — this is what makes the product usable
 * with zero cloud credentials and keeps the "processed and discarded" promise.
 *
 * The English model ships as the `@tesseract.js-data/eng` npm dependency, so
 * this works on air-gapped hosts too.
 */

let workerPromise: Promise<TesseractWorker> | null = null

function resolveBundledLangPath(langs: string[], override: string | null): string | null {
  const candidates: string[] = []
  if (override) candidates.push(override)
  if (langs.length === 1) {
    candidates.push(path.join(process.cwd(), 'node_modules', '@tesseract.js-data', langs[0], '4.0.0'))
  }
  for (const dir of candidates) {
    if (langs.every((lang) => fs.existsSync(path.join(dir, `${lang}.traineddata.gz`)))) return dir
  }
  return null
}

async function getWorker(config: AppConfig): Promise<TesseractWorker> {
  if (!workerPromise) {
    const langs = config.localOcr.langs
    const langPath = resolveBundledLangPath(langs, config.localOcr.langPath)
    workerPromise = createWorker(langs.join('+'), 1, {
      // `langPath` null -> tesseract's default (CDN). With the bundled package we
      // stay offline, which matters on serverless cold starts.
      ...(langPath ? { langPath, gzip: true, cacheMethod: 'none' as const } : {}),
      errorHandler: (error) => {
        console.error('[ocr] worker error:', error)
      },
    }).catch((error) => {
      workerPromise = null
      throw error
    })
  }
  return workerPromise
}

export interface LocalExtraction {
  tables: ExtractedTable[]
  warnings: string[]
}

export async function extractWithLocalOcr(
  buffer: Buffer,
  mime: string,
  config: AppConfig,
): Promise<LocalExtraction> {
  const worker = await getWorker(config)
  // tesseract.js v7 only fills `blocks` when explicitly requested — we need
  // word/line geometry, not just text.
  const result = await worker.recognize(buffer, {}, { blocks: true, text: false })

  const lines: OcrLine[] = []
  for (const block of result.data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        const words = (line.words ?? [])
          .filter((word) => word.text && word.text.trim().length > 0)
          .map((word) => ({
            text: word.text.trim(),
            confidence: word.confidence ?? 0,
            bbox: { x0: word.bbox.x0, y0: word.bbox.y0, x1: word.bbox.x1, y1: word.bbox.y1 },
          }))
        if (!words.length) continue
        lines.push({
          text: line.text ?? words.map((word) => word.text).join(' '),
          bbox: { x0: line.bbox.x0, y0: line.bbox.y0, x1: line.bbox.x1, y1: line.bbox.y1 },
          words,
        })
      }
    }
  }

  const dims = readDimensions(buffer, mime)
  const width =
    dims.width ?? lines.reduce((max, line) => Math.max(max, line.bbox.x1), 0) ?? 0
  const height =
    dims.height ?? lines.reduce((max, line) => Math.max(max, line.bbox.y1), 0) ?? 0

  const page: OcrPage = { width, height, lines }
  const table = buildTableFromOcr(page, { name: 'Detected table', provider: 'local' })

  const warnings: string[] = []
  if (width && Math.max(width, height) < MIN_RECOMMENDED_DIMENSION) {
    warnings.push(
      `This image is small (${Math.round(width)}×${Math.round(height)}px). Low-resolution screenshots reduce OCR accuracy — try a sharper capture if cells look wrong.`,
    )
  }
  if (table && typeof table.averageConfidence === 'number' && table.averageConfidence < 0.7) {
    warnings.push('Overall text confidence is low. Yellow-highlighted cells are the ones to double-check.')
  }

  return { tables: table ? [table] : [], warnings }
}

/** Used by /api/health so operators can see whether the offline engine is armed. */
export function localEngineStatus(config: AppConfig): { ready: boolean; langs: string[]; bundled: boolean } {
  const langPath = resolveBundledLangPath(config.localOcr.langs, config.localOcr.langPath)
  return { ready: true, langs: config.localOcr.langs, bundled: Boolean(langPath) }
}
