"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Search, UserPlus, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { userService, studyUserService } from "@/lib/services"
import { cn } from "@/lib/utils"

function pickUserId(user) {
  return user?.id ?? user?.userId ?? user?.UserId ?? user?.userID ?? null
}

function pickUserLabel(user) {
  const name = [user?.firstName ?? user?.FirstName, user?.lastName ?? user?.LastName]
    .filter(Boolean)
    .join(" ")
    .trim()
  return name || (user?.userName ?? user?.UserName ?? user?.email ?? user?.Email ?? `User ${pickUserId(user)}`)
}

function pickUserRole(user) {
  return String(user?.roleName ?? user?.RoleName ?? user?.role ?? "").trim()
}

/**
 * §3.2 — After creating a site, assign existing users to study + new site.
 */
export default function SiteAssignUsersModal({
  open,
  onClose,
  studyId,
  siteId,
  siteLabel = "",
  studyLabel = "",
  onAssigned,
}) {
  const [search, setSearch] = useState("")
  const [users, setUsers] = useState([])
  const [siteUsers, setSiteUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingSiteUsers, setLoadingSiteUsers] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState(() => new Set())
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState("")
  const [resultSummary, setResultSummary] = useState("")

  const numericStudyId = Number.parseInt(String(studyId ?? ""), 10)
  const numericSiteId = Number.parseInt(String(siteId ?? ""), 10)

  const loadSiteUsers = useCallback(async () => {
    if (!Number.isFinite(numericSiteId) || numericSiteId <= 0) {
      setSiteUsers([])
      return
    }
    setLoadingSiteUsers(true)
    try {
      const response = await studyUserService.getStudyUsersBySite(numericSiteId)
      const list = response?.data ?? []
      setSiteUsers(Array.isArray(list) ? list : [])
    } finally {
      setLoadingSiteUsers(false)
    }
  }, [numericSiteId])

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    setError("")
    try {
      const response = await userService.getAllUsers(1, 200, search.trim())
      const list = response?.data?.items ?? response?.data ?? []
      setUsers(Array.isArray(list) ? list : [])
    } catch {
      setUsers([])
      setError("Failed to load users.")
    } finally {
      setLoadingUsers(false)
    }
  }, [search])

  useEffect(() => {
    if (!open) return undefined
    void loadSiteUsers()
    const timer = window.setTimeout(() => {
      void loadUsers()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [open, loadSiteUsers, loadUsers])

  useEffect(() => {
    if (!open) {
      setSearch("")
      setSelectedUserIds(new Set())
      setError("")
      setResultSummary("")
    }
  }, [open])

  const siteUserIdSet = useMemo(() => {
    const ids = new Set()
    for (const row of siteUsers) {
      const id = pickUserId(row)
      if (id) ids.add(String(id))
    }
    return ids
  }, [siteUsers])

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((user) => {
      const userId = String(pickUserId(user) ?? "")
      if (siteUserIdSet.has(userId)) return false
      if (!q) return true
      const label = pickUserLabel(user).toLowerCase()
      const role = pickUserRole(user).toLowerCase()
      const email = String(user?.email ?? user?.Email ?? "").toLowerCase()
      return label.includes(q) || role.includes(q) || email.includes(q)
    })
  }, [users, search, siteUserIdSet])

  const toggleUser = (userId) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      const key = String(userId)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleAssign = async () => {
    if (!Number.isFinite(numericStudyId) || numericStudyId <= 0) {
      setError("Study is required.")
      return
    }
    if (!Number.isFinite(numericSiteId) || numericSiteId <= 0) {
      setError("Site is required.")
      return
    }
    if (selectedUserIds.size === 0) {
      setError("Select at least one user.")
      return
    }

    setAssigning(true)
    setError("")
    setResultSummary("")

    let successCount = 0
    const failures = []

    for (const userIdStr of selectedUserIds) {
      const userId = Number.parseInt(String(userIdStr), 10)
      if (!Number.isFinite(userId) || userId <= 0) continue

      const response = await studyUserService.assignStudyAndSites(userId, numericStudyId, [numericSiteId])
      if (response?.isSuccess || response?.success) {
        successCount += 1
      } else {
        failures.push(response?.message || `User ${userIdStr} could not be assigned.`)
      }
    }

    setAssigning(false)

    if (successCount > 0) {
      setResultSummary(`Assigned ${successCount} user(s) to ${siteLabel || "the new site"}.`)
      await loadSiteUsers()
      setSelectedUserIds(new Set())
      onAssigned?.({ successCount, failures })
    }
    if (failures.length > 0) {
      setError(failures.slice(0, 3).join(" "))
    }
    if (successCount > 0 && failures.length === 0) {
      onClose?.()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-assign-users-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 px-5 py-4">
          <div>
            <h2 id="site-assign-users-title" className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <UserPlus className="h-4 w-4 text-emerald-600" />
              Assign users to new site
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {studyLabel ? `${studyLabel} · ` : ""}
              {siteLabel || "New site"} — select existing users to grant site access.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {siteUsers.length > 0 || loadingSiteUsers ? (
          <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              <Users className="h-3.5 w-3.5" />
              Already assigned to this site
            </p>
            {loadingSiteUsers ? (
              <Skeleton className="h-8 w-full rounded-lg bg-slate-200/60" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {siteUsers.slice(0, 12).map((row) => {
                  const id = pickUserId(row)
                  return (
                    <span
                      key={id ?? pickUserLabel(row)}
                      className="rounded-full border border-slate-200/80 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
                    >
                      {pickUserLabel(row)}
                      {pickUserRole(row) ? ` · ${pickUserRole(row)}` : ""}
                    </span>
                  )
                })}
                {siteUsers.length > 12 ? (
                  <span className="text-[11px] text-slate-500">+{siteUsers.length - 12} more</span>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        <div className="border-b border-slate-100 px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search users by name, email, or role…"
              className="rounded-xl border-slate-200 pl-9"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 custom-scrollbar" role="status" aria-busy={loadingUsers}>
          {loadingUsers ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {users.length > 0 ? "All matching users are already on this site." : "No users found."}
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredUsers.map((user) => {
                const userId = pickUserId(user)
                if (!userId) return null
                const checked = selectedUserIds.has(String(userId))
                const role = pickUserRole(user)
                return (
                  <li key={userId}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition",
                        checked
                          ? "border-emerald-300 bg-emerald-50/70 ring-1 ring-emerald-200/60"
                          : "border-slate-200/80 bg-slate-50/50 hover:bg-white",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUser(userId)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-violet-500/30"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">{pickUserLabel(user)}</span>
                        {role ? <span className="block text-[11px] text-slate-500">{role}</span> : null}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {(error || resultSummary) && (
          <div className="px-5 pb-1">
            {resultSummary ? <p className="text-xs font-medium text-emerald-700">{resultSummary}</p> : null}
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200/70 px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={assigning}>
            {resultSummary ? "Close" : "Skip for now"}
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-violet-600 hover:bg-violet-700"
            disabled={assigning || selectedUserIds.size === 0}
            onClick={handleAssign}
          >
            {assigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning…
              </>
            ) : (
              `Assign ${selectedUserIds.size || ""} user${selectedUserIds.size === 1 ? "" : "s"}`
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
