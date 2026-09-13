import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'How screenshots are handled: processed in server memory, deleted with the request, never stored, never sold, never used for training.',
  alternates: { canonical: '/privacy' },
}

const SECTIONS = [
  {
    heading: 'What we process',
    body: 'When you upload an image, it is read into the memory of a single server process, passed to the extraction engine (AWS Textract when configured, otherwise our bundled on-server OCR engine), and converted into plain table data: cell values, positions, merge spans and confidence scores.',
  },
  {
    heading: 'What we do not do',
    body: 'We never write your image to disk or object storage, never keep thumbnails, never attach it to a user profile (there are no accounts in the free tier), never sell or share it, and never use it to train models. The request handler drops its only reference to the bytes as soon as the response is built.',
  },
  {
    heading: 'What we do keep',
    body: 'An anonymous, salted hash of your IP address (or a random cookie ID on private networks) is counted once per conversion to enforce the free daily limit; it expires at midnight UTC with the counter. We also keep coarse, content-free telemetry — image size, dimensions, format, extraction duration, whether cells were edited — to understand which screenshot types need better handling. Table contents are not logged.',
  },
  {
    heading: 'Where processing happens',
    body: 'With the bundled engine, your image never leaves our server. If AWS Textract is enabled by the operator, the bytes are transmitted to AWS for that single AnalyzeDocument call under AWS’s data-processing terms; enablement is visible on the /api/health endpoint.',
  },
  {
    heading: 'Exports',
    body: '.xlsx, .csv and .json files are generated entirely in your browser from the edited table. The edited table is never sent back to our servers.',
  },
  {
    heading: 'Cookies',
    body: 'One optional cookie stores a random identifier used only as a fallback usage counter on private/localhost networks. The site sets no advertising or cross-site tracking cookies.',
  },
  {
    heading: 'Your rights',
    body: 'Because we do not store images or accounts, there is nothing to export or delete on request — the data simply does not exist after your request completes. Questions: hello@example.com.',
  },
]

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Privacy, in plain words</h1>
      <p className="mt-3 text-slate-600">
        The short version: <strong className="font-semibold text-slate-800">your screenshot is processed in memory and deleted with the request.</strong>{' '}
        The long version follows.
      </p>
      <div className="mt-8 space-y-7">
        {SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-bold text-slate-900">{section.heading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{section.body}</p>
          </section>
        ))}
      </div>
      <p className="mt-10 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-500">
        Operators can verify the live configuration at <code className="font-mono">/api/health</code>, which reports the
        active provider and whether cloud extraction is enabled.
      </p>
    </article>
  )
}
