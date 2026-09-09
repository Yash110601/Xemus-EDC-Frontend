"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Building2, FileText, Signature } from "lucide-react"

function SectionCard({ icon: Icon, iconClass, title, children }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/80 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl p-6">
      <div className="mb-6 flex items-center gap-3 border-b border-slate-200/80 pb-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <Skeleton className="h-6 w-40 rounded-lg" />
      </div>
      {children}
    </div>
  )
}

export default function AgreementFormShell({ message = "Preparing agreement form..." }) {
  return (
    <div
      className="w-full min-h-[calc(100dvh-var(--topbar-height,4rem))] bg-[#f5f5f7] p-4 sm:p-6 lg:p-8"
      role="status"
      aria-busy="true"
      aria-label={message}
    >
      <div className="w-full space-y-6">
        <div className="rounded-2xl border border-white/60 bg-white/70 px-5 py-4 shadow-sm backdrop-blur-xl">
          <Skeleton className="mb-2 h-7 w-56 rounded-lg" />
          <Skeleton className="h-4 w-72 max-w-full rounded-md" />
        </div>

        <SectionCard icon={Building2} iconClass="bg-gradient-to-br from-blue-500 to-blue-600" title="Company">
          <div className="space-y-5">
            <Skeleton className="h-11 w-full rounded-xl" />
            <div className="flex gap-4">
              <Skeleton className="h-24 w-40 rounded-xl" />
              <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="col-span-full h-24 w-full rounded-xl" />
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={FileText} iconClass="bg-gradient-to-br from-green-500 to-green-600" title="Content">
          <Skeleton className="mb-3 h-4 w-48 rounded-md" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </SectionCard>

        <SectionCard icon={Signature} iconClass="bg-gradient-to-br from-teal-500 to-teal-600" title="Signature">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </SectionCard>

        <div className="flex justify-end gap-3 rounded-2xl border border-white/60 bg-white/80 p-5 backdrop-blur-xl">
          <Skeleton className="h-11 w-28 rounded-xl" />
          <Skeleton className="h-11 w-28 rounded-xl" />
          <Skeleton className="h-11 w-36 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
