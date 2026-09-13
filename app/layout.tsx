import type { Metadata, Viewport } from 'next'

import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { UploadProvider } from '@/components/upload-context'

import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Screenshot to Excel — turn any table screenshot into an editable spreadsheet',
    template: '%s · Screenshot to Excel',
  },
  description:
    'Upload a screenshot or photo of a table and get an editable Excel (.xlsx) or CSV file. Server-side table extraction, in-browser review grid, no signup, images never stored.',
  keywords: [
    'screenshot to excel',
    'image to spreadsheet',
    'table extraction',
    'OCR table',
    'png to xlsx',
    'photo to csv',
    'convert table screenshot',
  ],
  applicationName: 'Screenshot to Excel',
  openGraph: {
    type: 'website',
    siteName: 'Screenshot to Excel',
    url: SITE_URL,
    title: 'Turn any screenshot into an editable Excel table',
    description:
      'Upload a screenshot of a table, fix any OCR mistakes in an editable grid, and download .xlsx or .csv. Free, no signup, images never stored.',
    images: [{ url: '/og-cover.png', width: 1200, height: 630, alt: 'A table screenshot becoming an editable spreadsheet' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Turn any screenshot into an editable Excel table',
    description: 'Upload a table screenshot → edit the detected grid → download .xlsx / .csv. Free, no signup.',
    images: ['/og-cover.png'],
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col font-sans">
        <UploadProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </UploadProvider>
      </body>
    </html>
  )
}
