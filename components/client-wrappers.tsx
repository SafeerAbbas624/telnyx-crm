"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import type { ReactNode } from "react"

export function SearchParamsProvider({
  children,
  onParamsChange,
}: {
  children: ReactNode
  onParamsChange: (params: URLSearchParams) => void
}) {
  const searchParams = useSearchParams()

  // Call the callback with the search params
  onParamsChange(searchParams)

  return <>{children}</>
}

export default function ClientWrapper({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return <>{children}</>
}
