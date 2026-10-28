"use client"

import { Fragment, useMemo } from "react"
import { buildNavModuleActionKey } from "@/lib/permissions/studyNavModuleKeys"
import {
  formatNavModuleActionLegend,
  getNavModuleActionDefs,
} from "@/lib/permissions/navModuleApplicableActions"
import { STUDY_NAV_MODULE_GROUP_META, STUDY_PERMISSION_GROUPS } from "@/lib/permissions/studyPermissionKeys"
import { cn } from "@/lib/utils"

function PermissionToggle({ checked, disabled, onChange, label, compact = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40",
        compact ? "h-5 w-8" : "mx-auto h-6 w-10",
        checked ? "bg-emerald-600" : "bg-slate-300",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform",
          compact ? "h-4 w-4" : "h-5 w-5",
          checked && (compact ? "translate-x-3" : "translate-x-4"),
        )}
      />
    </button>
  )
}

function groupModulePermissions(permissions = []) {
  const map = new Map()
  for (const perm of permissions) {
    const menuCode = perm?.menuCode
    if (!menuCode) continue
    if (!map.has(menuCode)) {
      const actionIds = perm.applicableActions?.length
        ? perm.applicableActions
        : [...new Set(permissions.filter((p) => p.menuCode === menuCode).map((p) => p.action).filter(Boolean))]
      const actions = getNavModuleActionDefs(actionIds).map((action) => ({
        ...action,
        key: buildNavModuleActionKey(menuCode, action.id),
      }))
      map.set(menuCode, {
        menuCode,
        label: perm.label,
        actions,
        actionLegend: formatNavModuleActionLegend(actionIds),
      })
    }
  }
  return [...map.values()]
}

function ModuleActionsCell({ item, roleGuid, matrix, readOnly, onChange, roleName }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-0.5">
      <div className="flex flex-wrap justify-center gap-1">
        {item.actions.map((action) => {
          const checked = Boolean(matrix?.[roleGuid]?.[action.key])
          return (
            <div key={action.key} className="flex flex-col items-center gap-0.5">
              <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">
                {action.label.slice(0, 1)}
              </span>
              <PermissionToggle
                compact
                checked={checked}
                disabled={readOnly}
                label={`${roleName}: ${item.label} — ${action.label}`}
                onChange={(next) => onChange?.(roleGuid, action.key, next)}
              />
            </div>
          )
        })}
      </div>
      {item.actionLegend ? (
        <p className="text-[8px] text-slate-400">{item.actionLegend}</p>
      ) : null}
    </div>
  )
}

function ModuleGroupSection({
  group,
  roles,
  matrix,
  readOnly,
  highlightKey,
  onChange,
  showSectionDescription = false,
}) {
  const menuItems = useMemo(() => groupModulePermissions(group.permissions), [group.permissions])

  return (
    <Fragment key={group.id}>
      <tr className="bg-sky-50/70">
        <td
          colSpan={roles.length + 1}
          className="sticky left-0 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-sky-900"
        >
          {group.label}
          {showSectionDescription && group.description ? (
            <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal text-slate-500">
              {group.description}
            </span>
          ) : null}
        </td>
      </tr>
      <tr className="border-b border-sky-100/80 bg-sky-50/30">
        <td className="sticky left-0 z-[1] bg-sky-50/40 px-4 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          Module
        </td>
        {roles.map((role) => (
          <td key={`${group.id}-legend-${role.roleGuid}`} className="px-2 py-2 text-center">
            <p className="text-[8px] font-medium text-slate-500">Applicable actions</p>
          </td>
        ))}
      </tr>
      {menuItems.map((item) => (
        <tr key={`${group.id}-${item.menuCode}`} className="border-b border-slate-100/90 hover:bg-slate-50/50">
          <td className="sticky left-0 z-[1] bg-white/95 px-4 py-2.5 font-medium text-slate-700">
            {item.label}
            <span className="mt-0.5 block text-[9px] font-normal text-slate-400">{item.menuCode}</span>
          </td>
          {roles.map((role) => {
            const roleGuid = role.roleGuid
            const isHighlighted =
              highlightKey &&
              String(roleGuid ?? "")
                .trim()
                .toLowerCase() === highlightKey
            return (
              <td
                key={`${roleGuid}-${item.menuCode}`}
                className={cn("px-2 py-2 text-center", isHighlighted && "bg-emerald-50/80")}
              >
                <ModuleActionsCell
                  item={item}
                  roleGuid={roleGuid}
                  matrix={matrix}
                  readOnly={readOnly}
                  onChange={onChange}
                  roleName={role.roleName}
                />
              </td>
            )
          })}
        </tr>
      ))}
    </Fragment>
  )
}

function FunctionalGroupSection({ group, roles, matrix, readOnly, highlightKey, onChange }) {
  return (
    <Fragment key={group.id}>
      <tr className="bg-emerald-50/40">
        <td
          colSpan={roles.length + 1}
          className="sticky left-0 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-800"
        >
          {group.label}
          {group.description ? (
            <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal text-slate-500">
              {group.description}
            </span>
          ) : null}
        </td>
      </tr>
      {group.permissions.map((permission) => (
        <tr key={permission.key} className="border-b border-slate-100/90 hover:bg-slate-50/50">
          <td className="sticky left-0 z-[1] bg-white/95 px-4 py-2.5 font-medium text-slate-700">
            {permission.label}
            <span className="mt-0.5 block text-[9px] font-normal text-slate-400">{permission.key}</span>
          </td>
          {roles.map((role) => {
            const roleGuid = role.roleGuid
            const isHighlighted =
              highlightKey &&
              String(roleGuid ?? "")
                .trim()
                .toLowerCase() === highlightKey
            const checked = Boolean(matrix?.[roleGuid]?.[permission.key])
            return (
              <td
                key={`${roleGuid}-${permission.key}`}
                className={cn("px-3 py-2.5 text-center", isHighlighted && "bg-emerald-50/80")}
              >
                <PermissionToggle
                  checked={checked}
                  disabled={readOnly}
                  label={`${role.roleName}: ${permission.label}`}
                  onChange={(next) => onChange?.(roleGuid, permission.key, next)}
                />
              </td>
            )
          })}
        </tr>
      ))}
    </Fragment>
  )
}

/**
 * Role × permission matrix editor (preview / admin).
 */
export default function StudyRolePermissionMatrix({
  roles = [],
  matrix = {},
  navModuleGroups = [],
  onChange,
  readOnly = false,
  highlightRoleGuid = "",
  className,
}) {
  const highlightKey = String(highlightRoleGuid ?? "").trim().toLowerCase()

  if (!roles.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
        No roles on the server. Use Add role to create one.
      </p>
    )
  }

  const moduleSections = (navModuleGroups ?? []).filter((group) => group?.permissions?.length)

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/75 bg-white/95 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.18)]",
        className,
      )}
    >
      <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/95">
              <th className="sticky left-0 z-10 min-w-[10rem] bg-slate-50/95 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Permission
              </th>
              {roles.map((role) => {
                const isHighlighted =
                  highlightKey &&
                  String(role.roleGuid ?? "")
                    .trim()
                    .toLowerCase() === highlightKey
                return (
                  <th
                    key={role.roleGuid}
                    className={cn(
                      "min-w-[8.5rem] px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600",
                      isHighlighted && "bg-emerald-100/90 text-emerald-900 ring-2 ring-inset ring-emerald-400/60",
                    )}
                  >
                    <span className="line-clamp-2">{role.roleName}</span>
                    {isHighlighted ? (
                      <span className="mt-1 block text-[9px] font-normal normal-case tracking-normal text-emerald-700">
                        New
                      </span>
                    ) : null}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-sky-100/50">
              <td colSpan={roles.length + 1} className="px-4 py-2.5 text-xs text-sky-950">
                <p className="font-semibold">{STUDY_NAV_MODULE_GROUP_META.label}</p>
                <p className="mt-0.5 text-[11px] font-normal text-slate-600">
                  {STUDY_NAV_MODULE_GROUP_META.description}
                </p>
              </td>
            </tr>
            {moduleSections.length ? (
              moduleSections.map((group, index) => (
                <ModuleGroupSection
                  key={group.id}
                  group={{
                    ...group,
                    description:
                      index === 0
                        ? "Only actions that exist on each screen are shown (e.g. Dashboard: View only; reports: View + Export)."
                        : undefined,
                  }}
                  roles={roles}
                  matrix={matrix}
                  readOnly={readOnly}
                  highlightKey={highlightKey}
                  onChange={onChange}
                  showSectionDescription={index === 0}
                />
              ))
            ) : (
              <tr className="bg-sky-50/50">
                <td colSpan={roles.length + 1} className="px-4 py-3 text-xs text-slate-500">
                  Loading menu modules…
                </td>
              </tr>
            )}
            <tr className="bg-emerald-100/40">
              <td colSpan={roles.length + 1} className="px-4 py-2.5 text-xs text-emerald-950">
                <p className="font-semibold">Study runtime actions (eCRF, queries, SDV, reports)</p>
                <p className="mt-0.5 text-[11px] font-normal text-slate-600">
                  These apply inside eCRF and related workflows — separate from per-menu View/Edit above.
                </p>
              </td>
            </tr>
            {STUDY_PERMISSION_GROUPS.map((group) => (
              <FunctionalGroupSection
                key={group.id}
                group={group}
                roles={roles}
                matrix={matrix}
                readOnly={readOnly}
                highlightKey={highlightKey}
                onChange={onChange}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
