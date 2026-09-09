"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { LOGIN_FORM_INNER_CLASS } from "@/lib/login/loginUi"

function LoginFormSkeleton() {
  const tone = "bg-[#E1DFDD]/80"
  const sk = (className) => <Skeleton className={cn(className, tone)} />

  return (
    <div className={LOGIN_FORM_INNER_CLASS} role="status" aria-busy="true" aria-label="Loading sign-in form">
      <div className="mb-8 lg:hidden">{sk("h-10 w-40 rounded-[4px]")}</div>
      <div className="mb-7 space-y-2">
        {sk("h-8 w-32 rounded-[4px]")}
        {sk("h-4 w-64 rounded-[4px]")}
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          {sk("h-4 w-28 rounded-[4px]")}
          {sk("h-12 w-full rounded-[4px]")}
        </div>
        <div className="space-y-1.5">
          {sk("h-4 w-20 rounded-[4px]")}
          {sk("h-12 w-full rounded-[4px]")}
        </div>
        <div className="space-y-1.5">
          {sk("h-4 w-16 rounded-[4px]")}
          <div className="flex gap-2">
            {sk("h-12 flex-1 rounded-[4px]")}
            {sk("h-12 w-24 shrink-0 rounded-[4px]")}
          </div>
        </div>
        {sk("h-4 w-52 rounded-[4px]")}
        {sk("h-12 w-full rounded-[4px]")}
      </div>
    </div>
  )
}

const LoginForm = dynamic(() => import("@/components/login-form"), {
  ssr: false,
  loading: () => <LoginFormSkeleton />,
})

export default function LoginFormShell() {
  return (
    <Suspense fallback={<LoginFormSkeleton />}>
      <LoginForm />
    </Suspense>
  )
}
