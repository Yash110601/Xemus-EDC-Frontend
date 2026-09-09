"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export default function SectionSkeleton({
  title = "Loading",
  rows = 6,
  className = "",
  variant = "default",
}) {
  const variantMap = {
    default: [
      { span: 2, kind: "id" },
      { span: 3, kind: "text" },
      { span: 2, kind: "short" },
      { span: 3, kind: "text" },
      { span: 2, kind: "badge" },
    ],
    users: [
      { span: 2, kind: "id" },
      { span: 3, kind: "avatarText" },
      { span: 2, kind: "short" },
      { span: 3, kind: "text" },
      { span: 1, kind: "badge" },
      { span: 1, kind: "action" },
    ],
    crcUsers: [
      { span: 2, kind: "id" },
      { span: 3, kind: "short" },
      { span: 2, kind: "short" },
      { span: 2, kind: "text" },
      { span: 2, kind: "avatarText" },
      { span: 1, kind: "action" },
    ],
    permissions: [
      { span: 4, kind: "text" },
      { span: 2, kind: "toggle" },
      { span: 2, kind: "toggle" },
      { span: 2, kind: "toggle" },
      { span: 2, kind: "toggle" },
    ],
    agreements: [
      { span: 1, kind: "id" },
      { span: 3, kind: "short" },
      { span: 3, kind: "text" },
      { span: 2, kind: "short" },
      { span: 2, kind: "date" },
      { span: 1, kind: "action" },
    ],
    visits: [
      { span: 2, kind: "id" },
      { span: 3, kind: "short" },
      { span: 2, kind: "text" },
      { span: 2, kind: "short" },
      { span: 2, kind: "badge" },
      { span: 1, kind: "action" },
    ],
    audit: [
      { span: 1, kind: "id" },
      { span: 2, kind: "date" },
      { span: 2, kind: "short" },
      { span: 3, kind: "text" },
      { span: 2, kind: "badge" },
      { span: 2, kind: "text" },
    ],
    studyReport: [
      { span: 2, kind: "id" },
      { span: 2, kind: "short" },
      { span: 2, kind: "date" },
      { span: 2, kind: "short" },
      { span: 2, kind: "badge" },
      { span: 2, kind: "text" },
    ],
    siteReport: [
      { span: 2, kind: "id" },
      { span: 3, kind: "text" },
      { span: 2, kind: "short" },
      { span: 2, kind: "short" },
      { span: 2, kind: "badge" },
      { span: 1, kind: "action" },
    ],
    userReport: [
      { span: 2, kind: "id" },
      { span: 2, kind: "avatarText" },
      { span: 2, kind: "short" },
      { span: 2, kind: "text" },
      { span: 2, kind: "badge" },
      { span: 2, kind: "date" },
    ],
    patientReport: [
      { span: 2, kind: "id" },
      { span: 2, kind: "avatarText" },
      { span: 2, kind: "date" },
      { span: 2, kind: "short" },
      { span: 2, kind: "badge" },
      { span: 2, kind: "badge" },
      { span: 2, kind: "action" },
    ],
    visitReport: [
      { span: 2, kind: "id" },
      { span: 2, kind: "short" },
      { span: 2, kind: "date" },
      { span: 2, kind: "short" },
      { span: 2, kind: "badge" },
      { span: 2, kind: "action" },
    ],
    agreementReport: [
      { span: 2, kind: "id" },
      { span: 2, kind: "short" },
      { span: 2, kind: "date" },
      { span: 2, kind: "text" },
      { span: 2, kind: "badge" },
      { span: 2, kind: "action" },
    ],
    /** Lab Management — name / description / status / action */
    labSimpleMaster: [
      { span: 2, kind: "text" },
      { span: 3, kind: "text" },
      { span: 2, kind: "badge" },
      { span: 1, kind: "action" },
    ],
    /** Lab tests grid */
    labTestMaster: [
      { span: 2, kind: "short" },
      { span: 2, kind: "text" },
      { span: 2, kind: "text" },
      { span: 1, kind: "badge" },
      { span: 1, kind: "action" },
    ],
    /** Lab facility list */
    labFacility: [
      { span: 2, kind: "text" },
      { span: 1, kind: "short" },
      { span: 1, kind: "short" },
      { span: 1, kind: "short" },
      { span: 1, kind: "badge" },
      { span: 1, kind: "action" },
    ],
    /** Lab range assignment list */
    labRange: [
      { span: 2, kind: "text" },
      { span: 2, kind: "text" },
      { span: 1, kind: "short" },
      { span: 1, kind: "short" },
      { span: 1, kind: "badge" },
      { span: 1, kind: "action" },
    ],
    finance: [
      { span: 2, kind: "id" },
      { span: 2, kind: "avatarText" },
      { span: 2, kind: "short" },
      { span: 2, kind: "date" },
      { span: 2, kind: "badge" },
      { span: 2, kind: "action" },
    ],
  }
  const columns = variantMap[variant] || variantMap.default
  const totalColumns = columns.reduce((sum, cell) => sum + cell.span, 0)
  const gridStyle = {
    gridTemplateColumns: `repeat(${totalColumns}, minmax(0, 1fr))`,
  }
  const renderCell = (kind, key, tone = "body") => {
    const headTone = tone === "head" ? "bg-slate-200/90" : "bg-slate-200/80"
    if (kind === "avatarText") {
      return (
        <div key={key} className="flex items-center gap-2">
          <Skeleton className={`h-7 w-7 rounded-full ${headTone}`} />
          <Skeleton className={`h-3.5 w-[70%] ${headTone}`} />
        </div>
      )
    }
    if (kind === "badge") {
      return <Skeleton key={key} className={`h-6 w-20 rounded-full ${headTone}`} />
    }
    if (kind === "action") {
      return <Skeleton key={key} className={`h-7 w-16 rounded-lg ${headTone}`} />
    }
    if (kind === "toggle") {
      return <Skeleton key={key} className={`h-6 w-10 rounded-full ${headTone}`} />
    }
    if (kind === "id") {
      return <Skeleton key={key} className={`h-3.5 w-[60%] ${headTone}`} />
    }
    if (kind === "short") {
      return <Skeleton key={key} className={`h-3.5 w-[75%] ${headTone}`} />
    }
    if (kind === "date") {
      return <Skeleton key={key} className={`h-3.5 w-[65%] ${headTone}`} />
    }
    return <Skeleton key={key} className={`h-3.5 w-[85%] ${headTone}`} />
  }

  return (
    <div
      className={`px-6 py-6 ${className}`.trim()}
      role="status"
      aria-busy="true"
      aria-label={title}
    >
      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
        {title}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="grid gap-3" style={gridStyle}>
            {columns.map((column, index) => (
              <div
                key={`head-${index}`}
                style={{ gridColumn: `span ${column.span} / span ${column.span}` }}
              >
                {renderCell(column.kind, `head-cell-${index}`, "head")}
              </div>
            ))}
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="grid items-center gap-3 px-4 py-3.5" style={gridStyle}>
              {columns.map((column, innerIndex) => (
                <div
                  key={`row-${index}-${innerIndex}`}
                  style={{ gridColumn: `span ${column.span} / span ${column.span}` }}
                >
                  {renderCell(column.kind, `row-cell-${index}-${innerIndex}`)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Sidebar nav placeholder — same Skeleton tones/heights as {@link SectionSkeleton} body cells. */
export function SidebarNavSkeleton({ collapsed = false, rowsExpanded = 10, rowsCollapsed = 8 }) {
  const bodyTone = "bg-slate-200/70"
  const count = collapsed ? rowsCollapsed : rowsExpanded
  return (
    <div className="space-y-1 px-0.5 py-1" role="status" aria-busy="true" aria-label="Loading navigation">
      {!collapsed && <Skeleton className={cn("mb-2 h-2.5 w-16 rounded-md", bodyTone)} />}
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2", collapsed && "justify-center")}
        >
          <Skeleton className={cn("h-[18px] w-[18px] shrink-0 rounded", bodyTone)} />
          {!collapsed && <Skeleton className={cn("h-3 flex-1 max-w-[9rem] rounded-md", bodyTone)} />}
        </div>
      ))}
    </div>
  )
}
