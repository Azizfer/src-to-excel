import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1, lastModified },
    { url: `${SITE_URL}/convert`, changeFrequency: 'weekly', priority: 0.9, lastModified },
    { url: `${SITE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.6, lastModified },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3, lastModified },
  ]
  return entries
}
