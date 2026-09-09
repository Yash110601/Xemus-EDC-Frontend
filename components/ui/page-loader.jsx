"use client"

import MacSkeletonList from "@/components/ui/mac-skeleton-list"

export default function PageLoader({ message = "Loading..." }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
        {message}
      </div>
      <MacSkeletonList rows={5} variant="generic" label={message} />
    </div>
  )
}

