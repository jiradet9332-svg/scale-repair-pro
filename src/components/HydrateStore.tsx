'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { hydrate } from '@/lib/store'

/**
 * Invisible component — mounted once at the app layout level.
 * Reads localStorage → hydrates the in-memory store → triggers a refresh
 * so every page sees the persisted data on first load.
 */
export default function HydrateStore() {
  const router = useRouter()

  useEffect(() => {
    const hadData = hydrate()
    // If we loaded saved data, do a soft refresh so server-rendered
    // initial props get replaced by the hydrated values.
    if (hadData) {
      router.refresh()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
