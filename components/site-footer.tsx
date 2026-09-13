import Link from 'next/link'

import { Logo } from '@/components/logo'

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="text-sm font-bold text-slate-900">
              Screenshot<span className="text-brand-600">→</span>Excel
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Turn screenshots of tables into editable .xlsx and .csv files. Images are processed in
            memory and discarded — never stored, never sold.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
          <Link className="text-slate-600 hover:text-slate-900" href="/convert">
            Convert
          </Link>
          <Link className="text-slate-600 hover:text-slate-900" href="/pricing">
            Pricing
          </Link>
          <Link className="text-slate-600 hover:text-slate-900" href="/privacy">
            Privacy
          </Link>
          <Link className="text-slate-600 hover:text-slate-900" href="/#faq">
            FAQ
          </Link>
        </nav>
      </div>
      <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Screenshot→Excel. Free tier: 5 conversions per day, no account needed.
      </div>
    </footer>
  )
}
