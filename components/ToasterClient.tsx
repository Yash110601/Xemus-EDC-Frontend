'use client'

import dynamic from 'next/dynamic'

const ShadToaster = dynamic(
  () => import('@/components/ui/toaster').then((m) => m.Toaster),
  { ssr: false }
)

const SonnerToaster = dynamic(
  () => import('@/components/ui/sonner').then((m) => m.Toaster),
  { ssr: false }
)

export function ToasterClient() {
  return (
    <>
      <ShadToaster />
      <SonnerToaster
        position="top-right"
        richColors
        closeButton
        offset={{ top: '4.5rem' }}
        expand={false}
        visibleToasts={3}
        gap={10}
      />
    </>
  )
}
