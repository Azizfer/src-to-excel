import type { Metadata } from 'next'

import { ConversionWorkspace } from '@/components/conversion-workspace'

export const metadata: Metadata = {
  title: 'Convert a screenshot',
  description:
    'Upload a screenshot of a table and edit the detected grid before exporting .xlsx or .csv. Rows, columns and merged cells included.',
  alternates: { canonical: '/convert' },
}

export default function ConvertPage() {
  return <ConversionWorkspace />
}
