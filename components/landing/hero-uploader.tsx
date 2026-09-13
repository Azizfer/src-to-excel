'use client'

import { useRouter } from 'next/navigation'

import { Dropzone } from '@/components/dropzone'
import { useUpload } from '@/components/upload-context'

/** Landing-page dropzone: hands the file to the /convert workspace via context. */
export function HeroUploader() {
  const { setFile } = useUpload()
  const router = useRouter()
  return (
    <Dropzone
      compact
      onFile={(file) => {
        setFile(file)
        router.push('/convert')
      }}
    />
  )
}
