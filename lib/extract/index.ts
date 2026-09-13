import type { AppConfig } from '../env'
import { resolveAutoProvider } from '../env'
import type { ExtractedTable, ProviderId } from '../types'
import { extractWithLocalOcr } from './local'
import { extractWithTextract } from './textract'
import { InputError } from './validate'

export class NoTableError extends Error {
  constructor() {
    super('No table found in this image.')
    this.name = 'NoTableError'
  }
}

export class ProviderError extends Error {
  code: 'provider_unavailable' | 'provider_error'
  hint?: string
  constructor(code: 'provider_unavailable' | 'provider_error', message: string, hint?: string) {
    super(message)
    this.name = 'ProviderError'
    this.code = code
    this.hint = hint
  }
}

export interface ExtractionOutput {
  provider: ProviderId
  tables: ExtractedTable[]
  warnings: string[]
  /** When `auto` had to fall back from Textract to the local engine. */
  fellBackFrom?: 'textract'
}

/**
 * Picks a provider and runs it. In `auto` mode a Textract failure degrades to
 * the bundled engine instead of failing the user's upload — with a warning so
 * nobody is quietly served worse results.
 */
export async function extractTables(
  buffer: Buffer,
  mime: string,
  config: AppConfig,
): Promise<ExtractionOutput> {
  const chosen = resolveAutoProvider(config)

  if (chosen === 'textract') {
    if (!config.aws.configured) {
      throw new ProviderError(
        'provider_unavailable',
        'AWS Textract is selected but no credentials are configured.',
        'Set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (and AWS_REGION), or set EXTRACTION_PROVIDER=local.',
      )
    }
    try {
      const result = await extractWithTextract(buffer, { region: config.aws.region })
      if (!result.tables.length) throw new NoTableError()
      return { provider: 'textract', tables: result.tables, warnings: result.warnings }
    } catch (error) {
      if (error instanceof NoTableError) throw error
      if (config.provider !== 'auto') {
        throw new ProviderError('provider_error', `AWS Textract failed: ${describe(error)}`, hintFor(error))
      }
      console.error('[extract] Textract failed, falling back to local OCR:', describe(error))
      const local = await extractWithLocalOcr(buffer, mime, config)
      if (!local.tables.length) throw new NoTableError()
      return {
        provider: 'local',
        tables: local.tables,
        warnings: [
          `AWS Textract was unavailable (${describe(error)}), so the on-server engine processed this image instead.`,
          ...local.warnings,
        ],
        fellBackFrom: 'textract',
      }
    }
  }

  const local = await extractWithLocalOcr(buffer, mime, config)
  if (!local.tables.length) throw new NoTableError()
  return { provider: 'local', tables: local.tables, warnings: local.warnings }
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message.split('\n')[0]
  return String(error)
}

function hintFor(error: unknown): string | undefined {
  const message = describe(error)
  if (/credential|access.?key|token/i.test(message)) {
    return 'Check your AWS credentials and that the IAM principal has textract:AnalyzeDocument.'
  }
  if (/region/i.test(message)) {
    return 'Confirm AWS_REGION points at a region where Textract is available.'
  }
  if (/size|limit|exceed/i.test(message)) {
    return 'Textract accepts images up to 10 MB and 15,000×15,000 px.'
  }
  return undefined
}

export { InputError }
export { sniffMime, readDimensions, describeUnsupported } from './validate'
