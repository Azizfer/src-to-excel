import type { Metadata } from 'next'
import { FileSpreadsheet, Grid3x3, Lock, ScanSearch, ShieldCheck, Upload, Zap } from 'lucide-react'

import { ExamplePair } from '@/components/landing/example-pair'
import { HeroUploader } from '@/components/landing/hero-uploader'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Turn any screenshot into an editable Excel table',
  description:
    'Upload a screenshot or photo of a table and get an editable spreadsheet. Detects rows, columns and merged cells, lets you fix OCR mistakes, and exports .xlsx or .csv — free, no signup.',
  alternates: { canonical: '/' },
}

const STEPS = [
  {
    icon: Upload,
    title: '1 · Upload the screenshot',
    body: 'Drag in a PNG, JPG or WebP of any table — dashboard, grade sheet, invoice, financial report. Paste from your clipboard works too.',
  },
  {
    icon: ScanSearch,
    title: '2 · We read the structure',
    body: 'Rows, columns, merged cells and per-cell confidence are detected server-side. Low-confidence cells get flagged instead of silently guessed.',
  },
  {
    icon: FileSpreadsheet,
    title: '3 · Fix, then export',
    body: 'Correct any mistakes in the editable grid, add or remove rows and columns, then download .xlsx / .csv — generated in your browser.',
  },
]

const FAQ = [
  {
    q: 'Is my screenshot stored anywhere?',
    a: 'No. The image is held in server memory only while the table is being extracted, then discarded immediately. It is never written to disk, never put in a database, and never used for training. The spreadsheet export is generated locally in your browser.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. The free tier gives you 5 conversions per day with no signup — we count usage server-side by IP address so the limit cannot be bypassed by clearing cookies.',
  },
  {
    q: 'What kinds of images work best?',
    a: 'Crisp screenshots with visible grid lines or clear column spacing: web tables, spreadsheets, dashboards, PDF pages saved as images, photos of printed tables. Very small or blurry captures reduce accuracy — the tool warns you when that happens.',
  },
  {
    q: 'What if the OCR misreads a cell?',
    a: 'Every cell is editable before export, and cells with low confidence are highlighted in amber so you know exactly what to double-check. You can also add or remove rows and columns, split merged cells, and paste ranges copied from Excel.',
  },
  {
    q: 'Which file formats can I export?',
    a: '.xlsx (with merged cells preserved and sensible column widths), .csv (UTF-8 with BOM so Excel opens accents correctly), .json (rows plus merge regions and OCR stats, for automation), or copy the table as TSV straight to your clipboard.',
  },
]

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      name: 'Screenshot to Excel',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description:
        'Convert screenshots and photos of tables into editable Excel (.xlsx) or CSV spreadsheets with server-side table extraction and an in-browser review grid.',
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ],
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* Hero ---------------------------------------------------------------- */}
      <section className="grid-paper border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" /> No signup · 5 free conversions a day
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Turn any screenshot into an{' '}
              <span className="text-brand-600">editable Excel table</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600">
              That dashboard has no export button. Your grade sheet is a photo. The report is a PDF someone
              screenshotted. Upload the image — get a spreadsheet you can actually edit.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden="true" /> Deleted instantly, never stored
              </li>
              <li className="flex items-center gap-1.5">
                <Grid3x3 className="h-4 w-4 text-brand-600" aria-hidden="true" /> Merged cells detected
              </li>
              <li className="flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-brand-600" aria-hidden="true" /> .xlsx &amp; .csv export
              </li>
            </ul>
          </div>
          <div className="lg:pl-4">
            <HeroUploader />
            <p className="mt-3 text-center text-xs text-slate-500">
              Free tier: 5 conversions/day · 10 MB max · PNG, JPG, WebP
            </p>
          </div>
        </div>
      </section>

      {/* Before / after ------------------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-labelledby="example-heading">
        <h2 id="example-heading" className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Visible but not exportable? Not anymore.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
          We detect the table structure — not just the text — so columns stay columns and merged headers stay merged.
        </p>
        <div className="mt-10">
          <ExamplePair />
        </div>
      </section>

      {/* How it works -------------------------------------------------------- */}
      <section id="how-it-works" className="border-y border-slate-200 bg-white py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">How it works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <Card key={step.title} className="border-slate-200">
                <CardContent className="p-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200">
                    <step.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy band -------------------------------------------------------- */}
      <section className="bg-slate-900 py-12 text-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 text-center sm:px-6">
          <Lock className="h-7 w-7 text-brand-400" aria-hidden="true" />
          <h2 className="text-2xl font-bold tracking-tight">Your image is processed, then gone.</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
            Uploads live in server memory for the few seconds extraction takes and are discarded with the request — no
            disk, no object storage, no thumbnails, no training data. Exports are generated client-side, so the edited
            table never travels back to us either.
          </p>
          <a href="/privacy" className="text-sm font-semibold text-brand-300 underline underline-offset-4 hover:text-brand-200">
            Read the privacy details
          </a>
        </div>
      </section>

      {/* Pricing teaser ------------------------------------------------------ */}
      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6" aria-labelledby="pricing-heading">
        <h2 id="pricing-heading" className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Free while we validate it
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Free</p>
              <p className="mt-1 text-3xl font-extrabold text-slate-900">
                $0<span className="text-base font-medium text-slate-500"> / forever</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>· 5 conversions per day, no account</li>
                <li>· Editable grid with merge handling</li>
                <li>· .xlsx / .csv / .json export</li>
                <li>· Images never stored</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="border-brand-300 ring-1 ring-brand-200">
            <CardContent className="p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Pro · coming soon</p>
              <p className="mt-1 text-3xl font-extrabold text-slate-900">
                —<span className="text-base font-medium text-slate-500"> / month</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>· Unlimited conversions &amp; batch upload</li>
                <li>· Multiple tables per image</li>
                <li>· Higher-resolution inputs, no ads</li>
                <li>· Developer API access</li>
              </ul>
              <a href="/pricing" className="mt-4 inline-block text-sm font-semibold text-brand-700 underline underline-offset-4">
                Join the waitlist →
              </a>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ ------------------------------------------------------------------ */}
      <section id="faq" className="border-t border-slate-200 bg-white py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Questions, answered
          </h2>
          <div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span className="text-slate-400 transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
