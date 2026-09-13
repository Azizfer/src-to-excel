import type { Metadata } from 'next'
import { BadgeCheck, Check, Hourglass } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Free: 5 table conversions per day with no account. Pro with unlimited conversions, batch upload and an API is on the roadmap.',
  alternates: { canonical: '/pricing' },
}

const FREE_FEATURES = [
  '5 conversions per day, no signup',
  'Editable review grid: fix cells, add/remove rows & columns',
  'Merged-cell detection and splitting',
  '.xlsx, .csv and .json export, plus copy-as-TSV',
  'Images processed in memory and deleted immediately',
]

const PRO_FEATURES = [
  'Unlimited conversions and batch upload',
  'Multiple tables detected per image',
  'Higher-resolution inputs',
  'No ads, ever',
  'Developer API (image in → JSON / XLSX out)',
]

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Simple, honest pricing</h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">
          The tool is free while we validate it on real-world screenshots. Pro is planned — we will not bolt payments
          onto the free experience.
        </p>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <Card>
          <CardContent className="p-7">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Free</h2>
              <BadgeCheck className="h-5 w-5 text-brand-600" aria-hidden="true" />
            </div>
            <p className="mt-2 text-4xl font-extrabold text-slate-900">
              $0<span className="text-base font-medium text-slate-500"> / forever</span>
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-slate-600">
              {FREE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" /> {feature}
                </li>
              ))}
            </ul>
            <a
              href="/convert"
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              Start converting
            </a>
          </CardContent>
        </Card>

        <Card className="border-slate-300 bg-slate-50">
          <CardContent className="p-7">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Pro</h2>
              <Hourglass className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-2 text-4xl font-extrabold text-slate-400">
              Soon<span className="text-base font-medium text-slate-400"> · waitlist</span>
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-slate-500">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /> {feature}
                </li>
              ))}
            </ul>
            <a
              href="mailto:hello@example.com?subject=Pro%20waitlist"
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
            >
              Join the waitlist
            </a>
          </CardContent>
        </Card>
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        Rate limits are enforced server-side per IP address. Clearing cookies will not reset them — that is deliberate.
      </p>
    </section>
  )
}
