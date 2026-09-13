'use client'

import * as React from 'react'

interface UploadContextValue {
  file: File | null
  previewUrl: string | null
  setFile: (file: File | null) => void
}

const UploadContext = React.createContext<UploadContextValue | null>(null)

/**
 * Holds the picked file across client-side navigation so the landing page
 * dropzone can hand the upload straight to the /convert workspace.
 */
export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<{ file: File | null; previewUrl: string | null }>({
    file: null,
    previewUrl: null,
  })

  const setFile = React.useCallback((next: File | null) => {
    setState((current) => {
      if (current.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return { file: next, previewUrl: next ? URL.createObjectURL(next) : null }
    })
  }, [])

  const value = React.useMemo(
    () => ({ file: state.file, previewUrl: state.previewUrl, setFile }),
    [state, setFile],
  )
  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
}

export function useUpload(): UploadContextValue {
  const context = React.useContext(UploadContext)
  if (!context) throw new Error('useUpload must be used inside <UploadProvider>')
  return context
}
