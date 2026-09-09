"use client"

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { authService, studyPermissionService } from "@/lib/services"
import { isSuperAdminUser } from "@/lib/utils/createdUserCredentials"
import { loadImageAsBlobUrl } from "@/lib/utils/imageLoader"
import { getUserRoleGuid } from "@/lib/utils/authMenuFallback"
import {
    isReportsMenuFeature,
    refreshAuthMenuFromRolePermissions,
} from "@/lib/utils/refreshAuthMenuFromPermissions"
import { hasMenuViewPermission } from "@/lib/utils/menuRoutePermissions"
import ProfileModal from "./profile-modal"
import { BrandLogo } from "@/components/brand-logo"
import {
  APP_NAV_ACCENT_BAR,
  APP_NAV_CHEVRON,
  APP_NAV_ICON,
  APP_NAV_ICON_ACTIVE,
  APP_NAV_ITEM,
  APP_NAV_ITEM_ACTIVE,
  APP_NAV_PARENT,
  APP_NAV_PARENT_ACTIVE,
  APP_NAV_SUB_ITEM,
  APP_NAV_SUB_ITEM_ACTIVE,
  APP_NAV_SUB_NODE,
  APP_NAV_SUB_NODE_ACTIVE,
  APP_NAV_SUB_WRAP,
  APP_SIDEBAR_BRAND,
  APP_SIDEBAR_CLASS,
  APP_SIDEBAR_COLLAPSED_CLASS,
  APP_SIDEBAR_USER_CARD,
} from "@/lib/ui/appShellClasses"
import { BrandWordmark } from "@/components/brand-logo"
import { APP_BRANDING } from "@/lib/config/appBranding"
import { SidebarNavSkeleton } from "@/components/ui/section-skeleton"
import { cn } from "@/lib/utils"
import { useStudyAgreementEnabled } from "@/hooks/useStudyAgreementEnabled"
import useStudySitePermissions from "@/hooks/useStudySitePermissions"
import useStudyRolePermissionMode from "@/hooks/useStudyRolePermissionMode"
import useWorkspaceStudyId from "@/hooks/useWorkspaceStudyId"
import { readStudySiteFromStorage } from "@/lib/utils/studySiteContext"
import { filterNavItemsByStudyMatrix } from "@/lib/utils/studyNavPermissions"
import { isSidebarNavHiddenSubFeature } from "@/lib/navigation/sidebarNavHiddenCodes"
import { isAgreementMenuItem } from "@/lib/utils/studyAgreementGate"
import { isEConsentMenuItem } from "@/lib/utils/studyEConsentGate"
import { isCdashMenuItem } from "@/lib/utils/studyCdashGate"
import { useStudyCdashEnabled } from "@/hooks/useStudyCdashEnabled"
import { getStudyNavCatalogFallback } from "@/lib/navigation/studyNavCatalogFallback"
import {
  isPatientEnrolmentMenuFeature,
  mergePatientEnrolmentSubFeaturesInMenu,
  PATIENT_ENROLMENT_SUB_NAV,
} from "@/lib/navigation/patientEnrolmentNav"
import { ensurePlatformFeatureInMenu } from "@/lib/navigation/platformNav"

/** v3: separate sidebar items per enterprise module (EPRO, SAFETY, etc.). */
const STUDY_NAV_CATALOG_CACHE_KEY = "studyNavModuleCatalogCache_v3"

function ensureEConsentFeatureInMenu(menu) {
    if (!Array.isArray(menu)) return menu
    const hasTopLevel = menu.some((feature) => {
        const code = String(feature?.code ?? feature?.Code ?? "")
            .trim()
            .toUpperCase()
        return code === "ECONSENT"
    })
    if (hasTopLevel) return menu

    const fromCatalog = getStudyNavCatalogFallback().find((feature) => {
        const code = String(feature?.code ?? feature?.Code ?? "")
            .trim()
            .toUpperCase()
        return code === "ECONSENT"
    })
    if (!fromCatalog) return menu

    return [
        ...menu,
        {
            ...fromCatalog,
            canView: true,
            subFeatures: (fromCatalog.subFeatures ?? []).map((sf) => ({ ...sf, canView: true })),
        },
    ]
}

/** Ensure Remote SDV appears as its own module when login menu was cached before seed. */
function ensureRsdvFeatureInMenu(menu) {
    if (!Array.isArray(menu)) return menu

    const fromCatalog = getStudyNavCatalogFallback().find((feature) => {
        const code = String(feature?.code ?? feature?.Code ?? "")
            .trim()
            .toUpperCase()
        return code === "RSDV_MGMT"
    })
    if (!fromCatalog) return menu

    const catalogSubFeatures = (fromCatalog.subFeatures ?? []).map((sf) => ({ ...sf, canView: true }))

    const existingIndex = menu.findIndex((feature) => {
        const code = String(feature?.code ?? feature?.Code ?? "")
            .trim()
            .toUpperCase()
        return code === "RSDV_MGMT"
    })

    if (existingIndex === -1) {
        return [
            ...menu,
            {
                ...fromCatalog,
                canView: true,
                subFeatures: catalogSubFeatures,
            },
        ]
    }

    const existing = menu[existingIndex]
    const existingSubs = Array.isArray(existing.subFeatures) ? existing.subFeatures : []
    const mergedSubs = [...existingSubs]
    for (const catalogSub of catalogSubFeatures) {
        const code = String(catalogSub?.code ?? catalogSub?.Code ?? "")
            .trim()
            .toUpperCase()
        const found = mergedSubs.some(
            (sf) =>
                String(sf?.code ?? sf?.Code ?? "")
                    .trim()
                    .toUpperCase() === code,
        )
        if (!found) mergedSubs.push(catalogSub)
    }

    if (mergedSubs.length === existingSubs.length) return menu

    const next = [...menu]
    next[existingIndex] = { ...existing, subFeatures: mergedSubs }
    return next
}

function readCachedNavCatalog() {
    if (typeof window === "undefined") return null
    try {
        const raw = sessionStorage.getItem(STUDY_NAV_CATALOG_CACHE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) && parsed.length ? parsed : null
    } catch {
        return null
    }
}

function writeCachedNavCatalog(menu) {
    if (typeof window === "undefined" || !Array.isArray(menu) || !menu.length) return
    try {
        sessionStorage.setItem(STUDY_NAV_CATALOG_CACHE_KEY, JSON.stringify(menu))
    } catch {
        // ignore quota errors
    }
}

const icons = {
    dashboard: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
        </svg>
    ),
    users: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
    ),
    clipboard: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
        </svg>
    ),
    "graduation-cap": (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
        </svg>
    ),
    flask: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M10 2v5.25l-5.66 9.03A2.25 2.25 0 006.08 19h11.84a2.25 2.25 0 001.74-2.72L14 7.25V2h-4zM12 3.5h1v4.27l.09.14 5.41 8.66a.75.75 0 01-.58 1.18H6.98a.75.75 0 01-.58-1.18l5.41-8.66.09-.14V3.5H12z" />
        </svg>
    ),
    code: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
                fillRule="evenodd"
                d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
                clipRule="evenodd"
            />
        </svg>
    ),
    chart: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
    ),
    database: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
            <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
            <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5z" />
        </svg>
    ),
    chevron: (
        <svg className="w-4 h-4 transition-transform" fill="currentColor" viewBox="0 0 20 20">
            <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
            />
        </svg>
    ),
    user: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"
                clipRule="evenodd"
            />
        </svg>
    ),
    permission: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
                fillRule="evenodd"
                d="M10 2L3 5v4.5c0 4.5 2.813 8.744 7 10.5 4.187-1.756 7-6 7-10.5V5l-7-3zM9 12.586l-2.293-2.293a1 1 0 011.414-1.414L9 10.586l3.293-3.293a1 1 0 011.414 1.414L9 12.586z"
                clipRule="evenodd"
            />
        </svg>
    ),
    "user-plus": (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
        </svg>
    ),
    "user-circle": (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
        </svg>
    ),
    "file-text": (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
    ),
    "clipboard-list": (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
        </svg>
    ),
    "map-pin": (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
        </svg>
    ),
    calendar: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
    ),
    "document-text": (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
    ),
    "file-export": (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
    ),
    "file-search": (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
    ),
    "file-check": (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
        </svg>
    ),
    "alert-circle": (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
    ),
    "bar-chart": (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
    ),
    "trending-up": (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
        </svg>
    ),
    currency: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path d="M10 2a6 6 0 00-6 6c0 2.61 1.67 4.83 4 5.65V15a1 1 0 102 0v-1.02A5.97 5.97 0 0016 8a1 1 0 10-2 0 4 4 0 11-8 0 1 1 0 10-2 0 6 6 0 016-6z" />
            <path d="M8 9.5a1 1 0 112 0 .5.5 0 00.5.5h1a.5.5 0 000-1H9.5A1.5 1.5 0 018 9.5zm4 0a1.5 1.5 0 01-1.5-1.5.5.5 0 00-.5-.5h-1a.5.5 0 000 1h1a1 1 0 110 2 1 1 0 11-2 0 .5.5 0 00-1 0 1.5 1.5 0 001.5 1.5.5.5 0 00.5.5h1a.5.5 0 000-1h-1z" />
        </svg>
    ),
    /** Study Settings — gear (distinct from clipboard-list used for Study configuration) */
    settings: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path
                fillRule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
            />
        </svg>
    ),
    sparkles: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path d="M10 2l1.2 3.6L15 6.8l-3.8 1.2L10 11.6 8.8 8 5 6.8l3.8-1.2L10 2zm6.5 8.5l.8 2.3 2.2.8-2.2.8-.8 2.3-.8-2.3-2.2-.8 2.2-.8.8-2.3zM4.5 11.5l.7 2 1.8.7-1.8.7-.7 2-.7-2-1.8-.7 1.8-.7.7-2z" />
        </svg>
    ),
}

// Map backend feature codes to sidebar icon keys
const FEATURE_ICON_MAP = {
    DASHBOARD: "dashboard",
    MASTERS: "users",
    STUDY_MGMT: "clipboard",
    PATIENT_ENROLMENT: "user-circle",
    ECRF_DATA_ENTRY: "file-text",
    REPORTS: "chart",
    /** Lab Management — match Feature.Code in DB; parent menu icon */
    LAB_MANAGEMENT: "flask",
    LAB_MGMT: "flask",
    ECONSENT: "file-check",
    PLATFORM: "settings",
    SAFETY: "alert-circle",
    RSDV_MGMT: "file-search",
    XEMUS_INTELLIGENCE: "sparkles",
}

// Map backend sub-feature codes to sidebar icon keys
const SUBFEATURE_ICON_MAP = {
    USER_CREATE: "user-plus",
    CONFIGURATION: "permission",
    STUDY_CONFIG: "clipboard-list",
    STUDY_SETTINGS: "settings",
    STUDY_ROLE_PERMISSIONS: "permission",
    DATABASE_LOCK: "settings",
    PI_SIGNOFF: "file-check",
    PAYMENT_RULES: "currency",
    SITE_CONFIG: "map-pin",
    VISIT_CONFIG: "calendar",
    VISIT_CONFIGURATION: "calendar",
    CRF_DESIGNER: "code",
    RULE_DESIGNER: "code",
    AGREEMENT_SETUP: "document-text",
    ROLE_PERMISSION: "permission",
    ROLE_PERM: "permission",
    // Report sub-items
    EXPORT_CRF_DATA: "file-export",
    STUDY_AUDIT_TRAIL_REPORT: "file-search",
    QUERY_MANAGEMENT_REPORT: "clipboard-list",
    QUERY_DASHBOARD: "layout-grid",
    PATIENT_STATUS_REPORT: "user-circle",
    SDV_REPORT: "file-check",
    RSDV_REVIEW: "file-search",
    RSDV_DASHBOARD: "dashboard",
    RSDV_AUDIT_TRAIL: "file-search",
    PI_SIGNOFF_REPORT: "file-check",
    AI_ENTRY_REPORT: "sparkles",
    EMAIL_DELIVERY_REPORT: "mail",
    CDISC_EXPORT: "file-export",
    CDASH_REPORT: "database",
    STUDY_SDTM_MAPPING: "git-branch",
    STUDY_DELEGATION_LOG: "clipboard-list",
    ECONSENT: "file-check",
    ECONSENT_FORMS: "file-check",
    ECONSENT_RULES: "settings",
    ECONSENT_SETUP: "settings",
    ECONSENT_SUBJECTS: "user-circle",
    ECONSENT_AUDIT: "file-search",
    PLATFORM_MODULES: "settings",
    PLATFORM_INTEGRATION: "clipboard-list",
    PLATFORM_SSO: "permission",
    PLATFORM_ROADMAP: "chart",
    SAFETY_REPORTS: "alert-circle",
    SAFETY_REGULATORY: "clock",
    STUDY_DOCUMENTS: "file-text",
    CRF_STUDIO: "sparkles",
    DATABASE_STRUCTURE_REPORT: "database",
    BLANK_ANNOTATED_CRF: "file-text",
    DATA_VALIDATION_REPORT: "file-check",
    ZERO_DISCREPANCY_REPORT: "alert-circle",
    STUDY_DISCREPANCY_REPORT: "alert-circle",
    DYNAMIC_REPORTS: "bar-chart",
    STUDY_CRF_ANALYTICS: "trending-up",
    SUBJECT_CRF_DATA_REPORT: "file-text",
    /** Lab Management sub-features — match SubFeature.Code in DB (routes must be set on each row) */
    LAB_UNITS: "clipboard-list",
    LAB_CATEGORIES: "database",
    LAB_TESTS: "file-text",
    LABS: "map-pin",
    LAB_RANGE_ASSIGNMENTS: "bar-chart",
    PATIENT_ENROLMENT_CREATE: "user-plus",
    PATIENT_ENROLMENT_MANAGE: "users",
}


const toSlug = (value) =>
    (value || "")
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/_+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/--+/g, "-")
        .replace(/^-+|-+$/g, "")

const normalizeNavHref = (href) => String(href ?? "").trim().toLowerCase().replace(/\/$/, "")

/** Shown under Study Management until PAYMENT_RULES exists in login menu from API. */
const STUDY_MGMT_PAYMENT_RULES_NAV = {
    name: "Payment Rules",
    code: "PAYMENT_RULES",
    route: "/study-management/payment-rules",
    displayOrder: 72,
}

/** Until login menu is refreshed, show PI report when SDV report is already visible. */
const REPORTS_PI_SIGNOFF_NAV = {
    name: "PI Sign-off Report",
    code: "PI_SIGNOFF_REPORT",
    route: "/reports/pi-signoff-report",
    displayOrder: 16,
}

/** CDISC regulatory export — ODM / SDTM / define.xml */
const REPORTS_CDISC_EXPORT_NAV = {
    name: "CDISC Export",
    code: "CDISC_EXPORT",
    route: "/reports/cdisc-export",
    displayOrder: 17,
}

const REPORTS_CDASH_NAV = {
    name: "CDASH Report",
    code: "CDASH_REPORT",
    route: "/reports/cdash",
    displayOrder: 20,
}

const REPORTS_AI_ENTRY_NAV = {
    name: "AI Entry Report",
    code: "AI_ENTRY_REPORT",
    route: "/reports/ai-entry-report",
    displayOrder: 18,
}

const REPORTS_EMAIL_DELIVERY_NAV = {
    name: "Email Delivery Report",
    code: "EMAIL_DELIVERY_REPORT",
    route: "/reports/email-delivery-report",
    displayOrder: 19,
}

/** Study SDTM field mapping — separate from CRF Designer */
const STUDY_MGMT_SDTM_MAPPING_NAV = {
    name: "SDTM Field Mapping",
    code: "STUDY_SDTM_MAPPING",
    route: "/study-management/sdtm-mapping",
    displayOrder: 73,
}

const STUDY_MGMT_DELEGATION_LOG_NAV = {
    name: "Delegation Log",
    code: "STUDY_DELEGATION_LOG",
    route: "/study-management/delegation-log",
    displayOrder: 74,
}

const STUDY_MGMT_STUDY_DOCUMENTS_NAV = {
    name: "Study documents",
    code: "STUDY_DOCUMENTS",
    route: "/study-management/study-documents",
    displayOrder: 7,
}

const STUDY_MGMT_CRF_STUDIO_NAV = {
    name: "CRF Studio",
    code: "CRF_STUDIO",
    route: "/study-management/crf-studio",
    displayOrder: 8,
}

function buildInjectedPatientEnrolmentSubItem(navDef, rawSubFeature, studyMatrixControlsNav) {
    if (rawSubFeature && canShowMenuNode(rawSubFeature, studyMatrixControlsNav)) {
        return {
            name: rawSubFeature.name ?? rawSubFeature.Name ?? navDef.name,
            icon: getSubFeatureIconKey(rawSubFeature),
            href: rawSubFeature.route ?? rawSubFeature.Route ?? navDef.route,
            navCode: navDef.code,
            subItems: [],
            displayOrder:
                rawSubFeature.displayOrder ??
                rawSubFeature.DisplayOrder ??
                navDef.displayOrder,
        }
    }

    return {
        name: navDef.name,
        icon: getSubFeatureIconKey(navDef),
        href: navDef.route,
        navCode: navDef.code,
        subItems: [],
        displayOrder: navDef.displayOrder,
    }
}

function injectPatientEnrolmentSubNav(subItems, rawSubFeatures, studyMatrixControlsNav = false) {
    let items = [...(subItems ?? [])]

    for (const navDef of PATIENT_ENROLMENT_SUB_NAV) {
        const route = normalizeNavHref(navDef.route)
        if (items.some((item) => normalizeNavHref(item.href) === route)) continue

        const rawSubFeature = (rawSubFeatures ?? []).find(
            (sf) =>
                String(sf.code ?? sf.Code ?? "")
                    .trim()
                    .toUpperCase() === navDef.code,
        )

        items.push(buildInjectedPatientEnrolmentSubItem(navDef, rawSubFeature, studyMatrixControlsNav))
    }

    return items.sort(
        (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.name.localeCompare(b.name),
    )
}

const isStudyMgmtFeature = (feature) =>
    feature?.code === "STUDY_MGMT" || String(feature?.name ?? "").trim().toUpperCase() === "STUDY MANAGEMENT"

const getFeatureIconKey = (feature) =>
    FEATURE_ICON_MAP[feature.code] || feature.icon || "permission"

const getSubFeatureIconKey = (subFeature) => {
    // Try code-based mapping first
    if (subFeature.code && SUBFEATURE_ICON_MAP[subFeature.code]) {
        return SUBFEATURE_ICON_MAP[subFeature.code]
    }
    // Try name-based mapping as fallback
    const nameUpper = (subFeature.name || "").toUpperCase().replace(/\s+/g, "_")
    if (SUBFEATURE_ICON_MAP[nameUpper]) {
        return SUBFEATURE_ICON_MAP[nameUpper]
    }
    // Use icon from API if provided
    if (subFeature.icon) {
        return subFeature.icon
    }
    // Default fallback
    return "permission"
}

function canShowMenuNode(node, studyMatrixControlsNav) {
    if (studyMatrixControlsNav) return true
    return hasMenuViewPermission(node)
}

/** Hide expandable parents with no visible children when using global role permissions. */
function shouldHideEmptyNavParent(item, studyMatrixControlsNav) {
    if (studyMatrixControlsNav) return false
    const subs = item?.subItems
    if (!Array.isArray(subs) || subs.length > 0) return false
    const code = String(item?.navCode ?? "").trim().toUpperCase()
    if (isReportsMenuFeature({ code })) return true
    if (code === "STUDY_MGMT" || code === "STUDY MANAGEMENT") return true
    if (isPatientEnrolmentMenuFeature({ code })) return true
    return false
}

function injectStudyMgmtPaymentRulesNav(subItems, rawSubFeatures, studyMatrixControlsNav = false) {
    const hasPaymentRules = subItems.some((item) =>
        normalizeNavHref(item.href).includes("/study-management/payment-rules"),
    )
    if (hasPaymentRules) return subItems

    const rawPayment = (rawSubFeatures ?? []).find(
        (sf) =>
            String(sf.code ?? sf.Code ?? "")
                .trim()
                .toUpperCase() === STUDY_MGMT_PAYMENT_RULES_NAV.code,
    )
    if (!rawPayment || !canShowMenuNode(rawPayment, studyMatrixControlsNav)) {
        if (studyMatrixControlsNav) return subItems

        const hasStudySettings = subItems.some((item) =>
            normalizeNavHref(item.href).includes("/study-management/study-settings"),
        )
        if (!hasStudySettings) return subItems

        return [...subItems, {
            name: STUDY_MGMT_PAYMENT_RULES_NAV.name,
            icon: getSubFeatureIconKey(STUDY_MGMT_PAYMENT_RULES_NAV),
            href: STUDY_MGMT_PAYMENT_RULES_NAV.route,
            navCode: STUDY_MGMT_PAYMENT_RULES_NAV.code,
            subItems: [],
            displayOrder: STUDY_MGMT_PAYMENT_RULES_NAV.displayOrder,
        }].sort(
            (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.name.localeCompare(b.name),
        )
    }

    const injected = {
        name: rawPayment.name ?? STUDY_MGMT_PAYMENT_RULES_NAV.name,
        icon: getSubFeatureIconKey(rawPayment),
        href: rawPayment.route ?? STUDY_MGMT_PAYMENT_RULES_NAV.route,
        navCode: STUDY_MGMT_PAYMENT_RULES_NAV.code,
        subItems: [],
        displayOrder: rawPayment.displayOrder ?? rawPayment.DisplayOrder ?? STUDY_MGMT_PAYMENT_RULES_NAV.displayOrder,
    }

    return [...subItems, injected].sort(
        (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.name.localeCompare(b.name),
    )
}

function injectReportsPiSignoffNav(subItems, rawSubFeatures, studyMatrixControlsNav = false) {
    const piRoute = normalizeNavHref(REPORTS_PI_SIGNOFF_NAV.route)
    if (subItems.some((item) => normalizeNavHref(item.href) === piRoute)) return subItems

    const rawPi = (rawSubFeatures ?? []).find(
        (sf) =>
            String(sf.code ?? sf.Code ?? "")
                .trim()
                .toUpperCase() === REPORTS_PI_SIGNOFF_NAV.code,
    )
    if (rawPi && canShowMenuNode(rawPi, studyMatrixControlsNav)) {
        return [...subItems, {
            name: rawPi.name ?? REPORTS_PI_SIGNOFF_NAV.name,
            icon: getSubFeatureIconKey(rawPi),
            href: rawPi.route ?? REPORTS_PI_SIGNOFF_NAV.route,
            navCode: REPORTS_PI_SIGNOFF_NAV.code,
            subItems: [],
            displayOrder: rawPi.displayOrder ?? rawPi.DisplayOrder ?? REPORTS_PI_SIGNOFF_NAV.displayOrder,
        }].sort(
            (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.name.localeCompare(b.name),
        )
    }

    const hasSdv = subItems.some((item) => normalizeNavHref(item.href).includes("/reports/sdv-report"))
    if (studyMatrixControlsNav) return subItems
    if (!hasSdv) return subItems

    // Do not inject report nav without explicit View on the sub-feature (global role permissions).
    return subItems
}

function injectReportsSubFeatureNav(subItems, rawSubFeatures, navDef, studyMatrixControlsNav = false) {
    const route = normalizeNavHref(navDef.route)
    if (subItems.some((item) => normalizeNavHref(item.href) === route)) return subItems

    const raw = (rawSubFeatures ?? []).find(
        (sf) =>
            String(sf.code ?? sf.Code ?? "")
                .trim()
                .toUpperCase() === navDef.code,
    )
    if (raw && canShowMenuNode(raw, studyMatrixControlsNav)) {
        return [...subItems, {
            name: raw.name ?? navDef.name,
            icon: getSubFeatureIconKey(raw),
            href: raw.route ?? navDef.route,
            navCode: navDef.code,
            subItems: [],
            displayOrder: raw.displayOrder ?? raw.DisplayOrder ?? navDef.displayOrder,
        }].sort(
            (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.name.localeCompare(b.name),
        )
    }

    const hasReportsAnchor = subItems.some((item) => {
        const href = normalizeNavHref(item.href)
        return href.includes("/reports/sdv-report")
            || href.includes("/reports/export-ecrf-details")
            || href.includes("/reports/cdisc-export")
    })
    if (studyMatrixControlsNav) return subItems
    if (!hasReportsAnchor) return subItems

    return [...subItems, {
        name: navDef.name,
        icon: getSubFeatureIconKey(navDef),
        href: navDef.route,
        navCode: navDef.code,
        subItems: [],
        displayOrder: navDef.displayOrder,
    }].sort(
        (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.name.localeCompare(b.name),
    )
}

function injectReportsAiEntryNav(subItems, rawSubFeatures, studyMatrixControlsNav = false) {
    return injectReportsSubFeatureNav(subItems, rawSubFeatures, REPORTS_AI_ENTRY_NAV, studyMatrixControlsNav)
}

function injectReportsEmailDeliveryNav(subItems, rawSubFeatures, studyMatrixControlsNav = false) {
    return injectReportsSubFeatureNav(subItems, rawSubFeatures, REPORTS_EMAIL_DELIVERY_NAV, studyMatrixControlsNav)
}

function injectReportsCdashNav(subItems, rawSubFeatures, studyMatrixControlsNav = false) {
    return injectReportsSubFeatureNav(subItems, rawSubFeatures, REPORTS_CDASH_NAV, studyMatrixControlsNav)
}

function injectReportsCdiscExportNav(subItems, rawSubFeatures, studyMatrixControlsNav = false) {
    const cdiscRoute = normalizeNavHref(REPORTS_CDISC_EXPORT_NAV.route)
    if (subItems.some((item) => normalizeNavHref(item.href) === cdiscRoute)) return subItems

    const rawCdisc = (rawSubFeatures ?? []).find(
        (sf) =>
            String(sf.code ?? sf.Code ?? "")
                .trim()
                .toUpperCase() === REPORTS_CDISC_EXPORT_NAV.code,
    )
    if (rawCdisc && canShowMenuNode(rawCdisc, studyMatrixControlsNav)) {
        return [...subItems, {
            name: rawCdisc.name ?? REPORTS_CDISC_EXPORT_NAV.name,
            icon: getSubFeatureIconKey(rawCdisc),
            href: rawCdisc.route ?? REPORTS_CDISC_EXPORT_NAV.route,
            navCode: REPORTS_CDISC_EXPORT_NAV.code,
            subItems: [],
            displayOrder: rawCdisc.displayOrder ?? rawCdisc.DisplayOrder ?? REPORTS_CDISC_EXPORT_NAV.displayOrder,
        }].sort(
            (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.name.localeCompare(b.name),
        )
    }

    const hasSdv = subItems.some((item) => normalizeNavHref(item.href).includes("/reports/sdv-report"))
    const hasEcrfExport = subItems.some((item) =>
        normalizeNavHref(item.href).includes("/reports/export-ecrf-details"),
    )
    if (studyMatrixControlsNav) return subItems
    if (!hasSdv && !hasEcrfExport) return subItems

    // Do not inject report nav without explicit View on the sub-feature (global role permissions).
    return subItems
}

function injectStudyMgmtSdtmMappingNav(subItems, rawSubFeatures, studyMatrixControlsNav = false) {
    const sdtmRoute = normalizeNavHref(STUDY_MGMT_SDTM_MAPPING_NAV.route)
    if (subItems.some((item) => normalizeNavHref(item.href) === sdtmRoute)) return subItems

    const rawSdtm = (rawSubFeatures ?? []).find(
        (sf) =>
            String(sf.code ?? sf.Code ?? "")
                .trim()
                .toUpperCase() === STUDY_MGMT_SDTM_MAPPING_NAV.code,
    )
    if (rawSdtm && canShowMenuNode(rawSdtm, studyMatrixControlsNav)) {
        return [...subItems, {
            name: rawSdtm.name ?? STUDY_MGMT_SDTM_MAPPING_NAV.name,
            icon: getSubFeatureIconKey(rawSdtm),
            href: rawSdtm.route ?? STUDY_MGMT_SDTM_MAPPING_NAV.route,
            navCode: STUDY_MGMT_SDTM_MAPPING_NAV.code,
            subItems: [],
            displayOrder: rawSdtm.displayOrder ?? rawSdtm.DisplayOrder ?? STUDY_MGMT_SDTM_MAPPING_NAV.displayOrder,
        }].sort(
            (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.name.localeCompare(b.name),
        )
    }

    const rawCdisc = (rawSubFeatures ?? []).find(
        (sf) =>
            String(sf.code ?? sf.Code ?? "")
                .trim()
                .toUpperCase() === REPORTS_CDISC_EXPORT_NAV.code,
    )
    if (rawCdisc && canShowMenuNode(rawCdisc, studyMatrixControlsNav)) {
        return [...subItems, {
            name: STUDY_MGMT_SDTM_MAPPING_NAV.name,
            icon: getSubFeatureIconKey(STUDY_MGMT_SDTM_MAPPING_NAV),
            href: STUDY_MGMT_SDTM_MAPPING_NAV.route,
            navCode: STUDY_MGMT_SDTM_MAPPING_NAV.code,
            subItems: [],
            displayOrder: STUDY_MGMT_SDTM_MAPPING_NAV.displayOrder,
        }].sort(
            (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.name.localeCompare(b.name),
        )
    }

    const hasStudySettings = subItems.some((item) =>
        normalizeNavHref(item.href).includes("/study-management/study-settings"),
    )
    if (studyMatrixControlsNav || !hasStudySettings) return subItems

    return [...subItems, {
        name: STUDY_MGMT_SDTM_MAPPING_NAV.name,
        icon: getSubFeatureIconKey(STUDY_MGMT_SDTM_MAPPING_NAV),
        href: STUDY_MGMT_SDTM_MAPPING_NAV.route,
        navCode: STUDY_MGMT_SDTM_MAPPING_NAV.code,
        subItems: [],
        displayOrder: STUDY_MGMT_SDTM_MAPPING_NAV.displayOrder,
    }].sort(
        (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.name.localeCompare(b.name),
    )
}

function injectStudyMgmtDelegationLogNav(subItems, studyMatrixControlsNav = false) {
    const route = normalizeNavHref(STUDY_MGMT_DELEGATION_LOG_NAV.route)
    if (subItems.some((item) => normalizeNavHref(item.href) === route)) return subItems

    const hasStudySettings = subItems.some((item) =>
        normalizeNavHref(item.href).includes("/study-management/study-settings"),
    )
    if (studyMatrixControlsNav || !hasStudySettings) return subItems

    return [...subItems, {
        name: STUDY_MGMT_DELEGATION_LOG_NAV.name,
        icon: getSubFeatureIconKey(STUDY_MGMT_DELEGATION_LOG_NAV),
        href: STUDY_MGMT_DELEGATION_LOG_NAV.route,
        navCode: STUDY_MGMT_DELEGATION_LOG_NAV.code,
        subItems: [],
        displayOrder: STUDY_MGMT_DELEGATION_LOG_NAV.displayOrder,
    }].sort(
        (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.name.localeCompare(b.name),
    )
}

function injectStudyMgmtStudyDocumentsNav(subItems, rawSubFeatures, studyMatrixControlsNav = false) {
    const route = normalizeNavHref(STUDY_MGMT_STUDY_DOCUMENTS_NAV.route)
    if (subItems.some((item) => normalizeNavHref(item.href) === route)) return subItems

    const rawStudyDocuments = (rawSubFeatures ?? []).find(
        (sf) =>
            String(sf.code ?? sf.Code ?? "")
                .trim()
                .toUpperCase() === STUDY_MGMT_STUDY_DOCUMENTS_NAV.code,
    )
    if (rawStudyDocuments && canShowMenuNode(rawStudyDocuments, studyMatrixControlsNav)) {
        return [...subItems, {
            name: rawStudyDocuments.name ?? rawStudyDocuments.Name ?? STUDY_MGMT_STUDY_DOCUMENTS_NAV.name,
            icon: getSubFeatureIconKey(rawStudyDocuments),
            href: rawStudyDocuments.route ?? rawStudyDocuments.Route ?? STUDY_MGMT_STUDY_DOCUMENTS_NAV.route,
            navCode: STUDY_MGMT_STUDY_DOCUMENTS_NAV.code,
            subItems: [],
            displayOrder:
                rawStudyDocuments.displayOrder ??
                rawStudyDocuments.DisplayOrder ??
                STUDY_MGMT_STUDY_DOCUMENTS_NAV.displayOrder,
        }].sort(
            (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.name.localeCompare(b.name),
        )
    }

    const hasStudySettings = subItems.some((item) =>
        normalizeNavHref(item.href).includes("/study-management/study-settings"),
    )
    if (!hasStudySettings) return subItems

    return [...subItems, {
        name: STUDY_MGMT_STUDY_DOCUMENTS_NAV.name,
        icon: getSubFeatureIconKey(STUDY_MGMT_STUDY_DOCUMENTS_NAV),
        href: STUDY_MGMT_STUDY_DOCUMENTS_NAV.route,
        navCode: STUDY_MGMT_STUDY_DOCUMENTS_NAV.code,
        subItems: [],
        displayOrder: STUDY_MGMT_STUDY_DOCUMENTS_NAV.displayOrder,
    }].sort(
        (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.name.localeCompare(b.name),
    )
}

function injectStudyMgmtCrfStudioNav(subItems, rawSubFeatures, studyMatrixControlsNav = false) {
    if (!isSuperAdminUser(authService.getUser())) return subItems

    const route = normalizeNavHref(STUDY_MGMT_CRF_STUDIO_NAV.route)
    if (subItems.some((item) => normalizeNavHref(item.href) === route)) return subItems

    const rawCrfStudio = (rawSubFeatures ?? []).find(
        (sf) =>
            String(sf.code ?? sf.Code ?? "")
                .trim()
                .toUpperCase() === STUDY_MGMT_CRF_STUDIO_NAV.code,
    )
    if (rawCrfStudio && canShowMenuNode(rawCrfStudio, studyMatrixControlsNav)) {
        return [...subItems, {
            name: rawCrfStudio.name ?? rawCrfStudio.Name ?? STUDY_MGMT_CRF_STUDIO_NAV.name,
            icon: getSubFeatureIconKey(rawCrfStudio),
            href: rawCrfStudio.route ?? rawCrfStudio.Route ?? STUDY_MGMT_CRF_STUDIO_NAV.route,
            navCode: STUDY_MGMT_CRF_STUDIO_NAV.code,
            subItems: [],
            displayOrder:
                rawCrfStudio.displayOrder ??
                rawCrfStudio.DisplayOrder ??
                STUDY_MGMT_CRF_STUDIO_NAV.displayOrder,
        }].sort(
            (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.name.localeCompare(b.name),
        )
    }

    const hasStudySettings = subItems.some((item) =>
        normalizeNavHref(item.href).includes("/study-management/study-settings"),
    )
    if (!hasStudySettings) return subItems

    return [...subItems, {
        name: STUDY_MGMT_CRF_STUDIO_NAV.name,
        icon: getSubFeatureIconKey(STUDY_MGMT_CRF_STUDIO_NAV),
        href: STUDY_MGMT_CRF_STUDIO_NAV.route,
        navCode: STUDY_MGMT_CRF_STUDIO_NAV.code,
        subItems: [],
        displayOrder: STUDY_MGMT_CRF_STUDIO_NAV.displayOrder,
    }].sort(
        (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.name.localeCompare(b.name),
    )
}

export default function Sidebar({
  isCollapsed,
  setIsCollapsed,
  userName,
  roleName,
  enableLayoutTransitions = false,
  isMobileViewport = false,
  mobileNavOpen = false,
  onMobileNavClose,
}) {
    const pathname = usePathname()
    const router = useRouter()
    /** Avoid SSR/client nav mismatch — only swap off skeleton after mount. */
    const [hasMounted, setHasMounted] = useState(false)
    const [menuRevision, setMenuRevision] = useState(0)
    const [fallbackMenu, setFallbackMenu] = useState(null)
    const [loadingMenuFallback, setLoadingMenuFallback] = useState(false)
    const [studyNavCatalogMenu, setStudyNavCatalogMenu] = useState(null)
    const [loadingStudyNavCatalog, setLoadingStudyNavCatalog] = useState(false)
    const [expandedItems, setExpandedItems] = useState([]) // No items expanded by default
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [showProfileModal, setShowProfileModal] = useState(false)
    const [profileImageUrl, setProfileImageUrl] = useState(null) // Blob URL for sidebar avatar
    const userMenuRef = useRef(null)
    const { studyId: headerStudyId, isAgreementEnabled } = useStudyAgreementEnabled()
    const { isCdashEnabled: headerCdashEnabled, loading: cdashSettingsLoading } = useStudyCdashEnabled()
    const workspaceStudyId = useWorkspaceStudyId()
    const resolvedStudyId = workspaceStudyId ?? headerStudyId
    const { loading: studyModeLoading } = useStudyRolePermissionMode(resolvedStudyId)
    const [workspaceSiteId, setWorkspaceSiteId] = useState(null)
    const {
        can: studyMatrixCan,
        matrixLoadedFromApi,
        studyUsesRolePermissionMatrix,
        permissions: studyMatrixPermissions,
        loading: studyPermissionsLoading,
    } = useStudySitePermissions(resolvedStudyId, workspaceSiteId)
    const drawerExpanded = isMobileViewport ? true : !isCollapsed
    const navCollapsed = !drawerExpanded

    const handleNavNavigate = () => {
        if (isMobileViewport) onMobileNavClose?.()
    }

    const handleLogout = async () => {
        await authService.logout()
        router.push("/login")
    }

    const hideAgreementNav = resolvedStudyId != null && isAgreementEnabled === false
    // Always show eCONSENT nav when present in menu — study flag gates enroll/CRF workflows, not discovery.
    const hideEConsentNav = false
    const hideCdashNav =
        resolvedStudyId != null &&
        !cdashSettingsLoading &&
        headerCdashEnabled === false
    const studyMatrixNavActive = Boolean(studyUsesRolePermissionMatrix && matrixLoadedFromApi)
    const studyMatrixShellActive = Boolean(
        resolvedStudyId &&
            studyUsesRolePermissionMatrix &&
            (studyModeLoading || studyPermissionsLoading) &&
            !matrixLoadedFromApi,
    )
    const navPermissionsRefreshing = Boolean(
        resolvedStudyId &&
            studyUsesRolePermissionMatrix &&
            studyPermissionsLoading &&
            matrixLoadedFromApi,
    )

    useEffect(() => {
        if (!studyUsesRolePermissionMatrix || !resolvedStudyId) {
            setStudyNavCatalogMenu(null)
            setLoadingStudyNavCatalog(false)
            return undefined
        }

        const cached = readCachedNavCatalog()
        if (cached?.length) {
            setStudyNavCatalogMenu(cached)
        }

        let cancelled = false
        setLoadingStudyNavCatalog(true)

        void (async () => {
            const res = await studyPermissionService.getNavModuleCatalog()
            if (cancelled) return
            if (res?.isSuccess && Array.isArray(res.data) && res.data.length) {
                setStudyNavCatalogMenu(res.data)
                writeCachedNavCatalog(res.data)
            } else {
                const fallback = getStudyNavCatalogFallback()
                if (fallback.length) {
                    setStudyNavCatalogMenu(fallback)
                    writeCachedNavCatalog(fallback)
                } else if (!cached?.length) {
                    setStudyNavCatalogMenu(null)
                }
            }
            setLoadingStudyNavCatalog(false)
        })()

        return () => {
            cancelled = true
        }
    }, [studyUsesRolePermissionMatrix, resolvedStudyId, menuRevision])

    const menuItems = useMemo(() => {
        try {
            const loginMenu = authService.getMenu() ?? fallbackMenu
            const catalogMenu =
                studyNavCatalogMenu?.length
                    ? studyNavCatalogMenu
                    : readCachedNavCatalog()?.length
                      ? readCachedNavCatalog()
                      : studyUsesRolePermissionMatrix && resolvedStudyId
                        ? getStudyNavCatalogFallback()
                        : null
            const matrixMenuContext = Boolean(studyUsesRolePermissionMatrix && resolvedStudyId)
            const rawMenu = matrixMenuContext
                ? catalogMenu?.length
                    ? catalogMenu
                    : Array.isArray(loginMenu) && loginMenu.length
                      ? loginMenu
                      : []
                : Array.isArray(loginMenu)
                  ? loginMenu
                  : []
            const menu = ensurePlatformFeatureInMenu(
                ensureRsdvFeatureInMenu(
                    ensureEConsentFeatureInMenu(mergePatientEnrolmentSubFeaturesInMenu(rawMenu)),
                ),
            )
            if (!Array.isArray(menu)) return []

            const features = menu
                .filter((feature) => {
                    if (!canShowMenuNode(feature, studyMatrixNavActive)) return false
                    if (hideAgreementNav && isAgreementMenuItem(feature)) return false
                    // Hide only when study flag is explicitly off (not while settings are still loading).
                    if (hideEConsentNav && isEConsentMenuItem(feature)) return false
                    if (hideCdashNav && isCdashMenuItem(feature)) return false
                    return true
                })
                .slice()
                .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name))

            return features.map((feature) => {
                const featureIconKey = feature.icon || getFeatureIconKey(feature)
                const featureHref = feature.route || `/${toSlug(feature.code || feature.name || `feature-${feature.id}`)}`

                const subFeatures = feature.subFeatures ?? feature.SubFeatures

                const subItems =
                    subFeatures
                        ?.filter((sf) => {
                            if (!canShowMenuNode(sf, studyMatrixNavActive)) return false
                            if (hideAgreementNav && isAgreementMenuItem(sf)) return false
                            if (hideEConsentNav && isEConsentMenuItem(sf)) return false
                            if (hideCdashNav && isCdashMenuItem(sf)) return false
                            if (isSidebarNavHiddenSubFeature(sf)) return false
                            if (feature.code === "STUDY_MGMT" || feature.name?.toUpperCase() === "STUDY MANAGEMENT") {
                                const sfNameUpper = (sf.name || "").toUpperCase()
                                const sfCodeUpper = (sf.code || "").toUpperCase()
                                if (
                                    sfNameUpper.includes("CRF") && (sfNameUpper.includes("DESIGNER") || sfNameUpper.includes("FORM")) ||
                                    sfCodeUpper === "CRF_DESIGNER" || sfCodeUpper === "CRF_FORM_DESIGNER"
                                ) {
                                    return false
                                }
                            }
                            return true
                        })
                        ?.slice()
                        .sort(
                            (a, b) =>
                                (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name),
                        )
                        .map((sf) => {
                            const subIconKey = sf.icon || getSubFeatureIconKey(sf)
                            const subHref = sf.route || `${featureHref}/${toSlug(sf.code || sf.name || `subfeature-${sf.id}`)}`
                            const subCode = sf.code ?? sf.Code ?? ""
                            return {
                                name: sf.name,
                                icon: subIconKey,
                                href: subHref,
                                navCode: subCode,
                                subItems: [],
                                displayOrder: sf.displayOrder ?? sf.DisplayOrder,
                            }
                        }) || []

                const resolvedSubItems = isStudyMgmtFeature(feature)
                    ? injectStudyMgmtDelegationLogNav(
                          injectStudyMgmtSdtmMappingNav(
                              injectStudyMgmtPaymentRulesNav(
                                  injectStudyMgmtCrfStudioNav(
                                      injectStudyMgmtStudyDocumentsNav(subItems, subFeatures, studyMatrixNavActive),
                                      subFeatures,
                                      studyMatrixNavActive,
                                  ),
                                  subFeatures,
                                  studyMatrixNavActive,
                              ),
                              subFeatures,
                              studyMatrixNavActive,
                          ),
                          studyMatrixNavActive,
                      )
                    : isReportsMenuFeature(feature)
                      ? injectReportsCdashNav(
                            injectReportsEmailDeliveryNav(
                                injectReportsAiEntryNav(
                                    injectReportsCdiscExportNav(
                                        injectReportsPiSignoffNav(subItems, subFeatures, studyMatrixNavActive),
                                        subFeatures,
                                        studyMatrixNavActive,
                                    ),
                                    subFeatures,
                                    studyMatrixNavActive,
                                ),
                                subFeatures,
                                studyMatrixNavActive,
                            ),
                            subFeatures,
                            studyMatrixNavActive,
                        )
                      : isPatientEnrolmentMenuFeature(feature)
                        ? injectPatientEnrolmentSubNav(subItems, subFeatures, studyMatrixNavActive)
                        : subItems

                return {
                    name: feature.name ?? feature.Name,
                    icon: featureIconKey,
                    href: featureHref,
                    navCode: feature.code ?? feature.Code ?? "",
                    subItems: hideCdashNav
                        ? resolvedSubItems.filter((item) => !isCdashMenuItem(item))
                        : resolvedSubItems,
                }
            })
            .filter((item) => !shouldHideEmptyNavParent(item, studyMatrixNavActive))
        } catch {
            return []
        }
    }, [hideAgreementNav, hideEConsentNav, hideCdashNav, menuRevision, fallbackMenu, studyUsesRolePermissionMatrix, resolvedStudyId, studyNavCatalogMenu])

    const visibleMenuItems = useMemo(() => {
        return filterNavItemsByStudyMatrix(menuItems, studyMatrixCan, {
            matrixActive: studyMatrixNavActive,
            permissions: studyMatrixPermissions,
        })
    }, [
        menuItems,
        studyMatrixNavActive,
        studyMatrixCan,
        studyMatrixPermissions,
    ])

    useEffect(() => {
        const syncWorkspaceSite = () => {
            setWorkspaceSiteId(readStudySiteFromStorage().siteId)
        }
        syncWorkspaceSite()
        window.addEventListener("studySiteChanged", syncWorkspaceSite)
        window.addEventListener("storage", syncWorkspaceSite)
        return () => {
            window.removeEventListener("studySiteChanged", syncWorkspaceSite)
            window.removeEventListener("storage", syncWorkspaceSite)
        }
    }, [])

    useLayoutEffect(() => {
        setHasMounted(true)
    }, [])

    useEffect(() => {
        if (!hasMounted) return

        const stored = authService.getMenu()
        const user = authService.getUser()
        const roleGuid = getUserRoleGuid(user)

        const tryRefreshFromRolePermissions = () => {
            if (!roleGuid) return Promise.resolve(null)
            return refreshAuthMenuFromRolePermissions().then((menu) => {
                if (!menu?.length) return null
                setFallbackMenu(menu)
                setMenuRevision((n) => n + 1)
                return menu
            })
        }

        if (!Array.isArray(stored) || stored.length === 0) {
            let cancelled = false
            setLoadingMenuFallback(true)
            tryRefreshFromRolePermissions()
                .catch(() => {})
                .finally(() => {
                    if (!cancelled) setLoadingMenuFallback(false)
                })
            return () => {
                cancelled = true
            }
        }

        let cancelled = false
        tryRefreshFromRolePermissions().catch(() => {})

        return () => {
            cancelled = true
        }
    }, [hasMounted])

    useEffect(() => {
        if (!hasMounted) return
        const stored = authService.getMenu()
        if (Array.isArray(stored) && stored.length > 0) {
            setFallbackMenu(null)
        }
    }, [hasMounted, menuRevision])

    useEffect(() => {
        const bumpMenu = () => {
            setFallbackMenu(null)
            setMenuRevision((n) => n + 1)
        }
        window.addEventListener("authMenuUpdated", bumpMenu)
        window.addEventListener("storage", bumpMenu)
        return () => {
            window.removeEventListener("authMenuUpdated", bumpMenu)
            window.removeEventListener("storage", bumpMenu)
        }
    }, [])

    // Load profile photo for sidebar avatar (same as dashboard banner)
    const loadProfileImage = async () => {
        const currentUser = authService.getUser()
        if (!currentUser) return
        const photoUrl = currentUser.profilePhotoUrl || currentUser.profileImage || currentUser.profileImageUrl || null
        if (!photoUrl) {
            setProfileImageUrl(null)
            return
        }
        const { blobUrl, error } = await loadImageAsBlobUrl(photoUrl)
        if (error || !blobUrl) {
            setProfileImageUrl(null)
            return
        }
        setProfileImageUrl(blobUrl)
    }

    useEffect(() => {
        loadProfileImage()
        const handleProfileUpdated = () => loadProfileImage()
        window.addEventListener("profileUpdated", handleProfileUpdated)
        return () => {
            window.removeEventListener("profileUpdated", handleProfileUpdated)
        }
    }, [])

    useEffect(() => {
        return () => {
            if (profileImageUrl) {
                window.URL.revokeObjectURL(profileImageUrl)
            }
        }
    }, [profileImageUrl])

    // Close user menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setShowUserMenu(false)
            }
        }

        if (showUserMenu) {
            document.addEventListener("mousedown", handleClickOutside)
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [showUserMenu])

    const toggleExpand = (itemName) => {
        setExpandedItems((prev) =>
            prev.includes(itemName) ? prev.filter((name) => name !== itemName) : [...prev, itemName],
        )
    }

    // Helper function to check if any sub-item is active
    const hasActiveSubItem = (item) => {
        if (!item.subItems || item.subItems.length === 0) return false
        return item.subItems.some(subItem => {
            if (subItem.href) {
                return pathname === subItem.href || (subItem.href !== "/dashboard" && pathname.startsWith(subItem.href + "/"))
            }
            // Recursively check nested sub-items
            return hasActiveSubItem(subItem)
        })
    }

    // Auto-expand parent items when sub-items are active
    useEffect(() => {
        if (visibleMenuItems.length === 0) return
        
        const autoExpandParents = (items) => {
            const itemsToExpand = new Set()
            
            const checkItems = (items) => {
                items.forEach(item => {
                    if (item.subItems && item.subItems.length > 0) {
                        const hasActive = item.subItems.some(subItem => {
                            if (subItem.href) {
                                return pathname === subItem.href || (subItem.href !== "/dashboard" && pathname.startsWith(subItem.href + "/"))
                            }
                            return false
                        })
                        if (hasActive) {
                            itemsToExpand.add(item.name)
                        }
                        checkItems(item.subItems)
                    }
                })
            }
            
            checkItems(visibleMenuItems)
            
            if (itemsToExpand.size > 0) {
                setExpandedItems(prev => {
                    const newSet = new Set([...prev, ...itemsToExpand])
                    return Array.from(newSet)
                })
            }
        }
        
        autoExpandParents(visibleMenuItems)
    }, [pathname, visibleMenuItems])

    const renderNavIcon = (iconKey, active) => (
        <span className={active ? APP_NAV_ICON_ACTIVE : APP_NAV_ICON}>
            {icons[iconKey] || icons.permission}
        </span>
    )

    const renderMenuItem = (item, level = 0, index = 0, parentName = null) => {
        // Check if current path matches or is a child of this item
        const isActive = item.href ? (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"))) : false
        const hasSubItems = item.subItems && item.subItems.length > 0
        const hasActiveChild = hasActiveSubItem(item)
        // Keep expanded if it has active sub-item or is manually expanded
        const isExpanded = expandedItems.includes(item.name) || hasActiveChild

        const isTopLevel = level === 0
        const isSubLevel = level > 0
        const parentHighlighted = isActive || hasActiveChild
        const rowActive = isSubLevel
            ? isActive
                ? APP_NAV_SUB_ITEM_ACTIVE
                : APP_NAV_SUB_ITEM
            : isActive
              ? APP_NAV_ITEM_ACTIVE
              : APP_NAV_ITEM

        return (
            <div key={`${parentName ?? "root"}-${item.name}`} className={isTopLevel ? "mb-0.5" : ""}>
                {hasSubItems ? (
                    <button
                        type="button"
                        onClick={() => {
                            if (!isExpanded) {
                                setExpandedItems((prev) => [...prev, item.name])
                            } else if (!hasActiveChild) {
                                toggleExpand(item.name)
                            }
                        }}
                        className={cn(
                            isTopLevel
                                ? parentHighlighted
                                    ? APP_NAV_PARENT_ACTIVE
                                    : isExpanded
                                      ? APP_NAV_PARENT_ACTIVE
                                      : APP_NAV_PARENT
                                : rowActive,
                            navCollapsed && isTopLevel && "justify-center px-2"
                        )}
                        title={navCollapsed && isTopLevel ? item.name : undefined}
                        aria-expanded={isExpanded}
                    >
                        {(parentHighlighted && isTopLevel) ? <span className={APP_NAV_ACCENT_BAR} aria-hidden /> : null}
                        <span className={cn("flex min-w-0 flex-1 items-center gap-2.5", navCollapsed && isTopLevel && "justify-center")}>
                            {renderNavIcon(item.icon, parentHighlighted)}
                            {(!navCollapsed || isSubLevel) && (
                                <span className="truncate">{item.name}</span>
                            )}
                        </span>
                        {(!navCollapsed || isSubLevel) && (
                            <span className={cn(APP_NAV_CHEVRON, isExpanded && "rotate-90")}>
                                {icons.chevron}
                            </span>
                        )}
                    </button>
                ) : item.href ? (
                    <Link
                        href={item.href}
                        onClick={(e) => {
                            if (pathname === item.href) {
                                e.preventDefault()
                                return
                            }
                            if (item.href === "/ecrf-form-designer/manage" || item.name?.toLowerCase().includes("manage ecrf")) {
                                if (pathname === "/ecrf-form-designer/manage") {
                                    e.preventDefault()
                                    window.dispatchEvent(new CustomEvent("ecrfFormDesignerManageReset"))
                                    router.push(item.href)
                                    router.refresh()
                                }
                            }
                            handleNavNavigate()
                        }}
                        className={cn(
                            rowActive,
                            navCollapsed && isTopLevel && "justify-center px-2"
                        )}
                        title={navCollapsed && isTopLevel ? item.name : undefined}
                        aria-current={isActive ? "page" : undefined}
                    >
                        {isSubLevel ? (
                            <span
                                className={cn(APP_NAV_SUB_NODE, isActive && APP_NAV_SUB_NODE_ACTIVE)}
                                aria-hidden
                            />
                        ) : (
                            <>
                                {isActive ? <span className={APP_NAV_ACCENT_BAR} aria-hidden /> : null}
                                {renderNavIcon(item.icon, isActive)}
                            </>
                        )}
                        {(!navCollapsed || isSubLevel) && <span className="truncate">{item.name}</span>}
                    </Link>
                ) : (
                    <div
                        className={cn(
                            rowActive,
                            "cursor-not-allowed opacity-45",
                            navCollapsed && isTopLevel && "justify-center px-2"
                        )}
                        title={navCollapsed && isTopLevel ? item.name : undefined}
                    >
                        {isSubLevel ? (
                            <span className={APP_NAV_SUB_NODE} aria-hidden />
                        ) : (
                            renderNavIcon(item.icon, false)
                        )}
                        {(!navCollapsed || isSubLevel) && <span className="truncate">{item.name}</span>}
                    </div>
                )}

                {hasSubItems && (!navCollapsed || isSubLevel) && (
                    <div
                        className={cn(
                            isTopLevel && APP_NAV_SUB_WRAP,
                            "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                            isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                        )}
                        aria-hidden={!isExpanded}
                    >
                        <div className="min-h-0 overflow-hidden">
                            {item.subItems.map((subItem, subIndex) =>
                                renderMenuItem(subItem, level + 1, subIndex, item.name)
                            )}
                        </div>
                    </div>
                )}
            </div>
        )
    }
    return (
       <aside
            style={{ width: navCollapsed ? "4.875rem" : "17rem" }}
            className={cn(
                APP_SIDEBAR_CLASS,
                navCollapsed ? "w-[4.875rem]" : "w-[17rem]",
                isMobileViewport && "w-[min(17rem,88vw)] max-w-[88vw]",
                "fixed left-0 top-0 z-50 isolate",
                isMobileViewport
                  ? cn(
                      "transition-transform duration-300 ease-out lg:transition-none",
                      mobileNavOpen ? "translate-x-0" : "-translate-x-full",
                      "lg:translate-x-0"
                    )
                  : enableLayoutTransitions
                    ? "transition-[width] duration-300 ease-out"
                    : "transition-none"
            )}
            aria-hidden={isMobileViewport ? !mobileNavOpen : false}
        >
            <div className={APP_SIDEBAR_BRAND}>
                {isMobileViewport ? (
                    <>
                        <div className="min-w-0 flex-1 pl-0.5">
                            <BrandWordmark className="gap-0 [&>span]:text-[21px] [&>span]:font-extrabold [&>span]:tracking-[-0.02em] [&>span>span:first-child]:text-[#101B2D] [&>span>span:last-child]:bg-none [&>span>span:last-child]:text-[#10A269]" />
                            <p className="mt-0.5 truncate text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#8A98A8]">
                                {APP_BRANDING.badgeLabel}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onMobileNavClose?.()}
                            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-[#E9EDF2] bg-white text-[#7C8A9B] transition-colors hover:border-[#DBE2E9] hover:bg-[#F8FAFB] hover:text-[#46566B]"
                            title="Close menu"
                            aria-label="Close menu"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </>
                ) : isCollapsed ? (
                    <button
                        type="button"
                        onClick={() => setIsCollapsed()}
                        className="mx-auto flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[#E9EDF2] bg-white text-[#7C8A9B] transition-colors hover:border-[#DBE2E9] hover:bg-[#F2F5F8] hover:text-[#46566B]"
                        title="Expand sidebar"
                        aria-label="Expand sidebar"
                    >
                        <BrandLogo size="xs" className="h-6 object-contain" />
                    </button>
                ) : (
                    <>
                        <div className="min-w-0 flex-1 pl-0.5">
                            <BrandWordmark className="gap-0 [&>span]:text-[21px] [&>span]:font-extrabold [&>span]:tracking-[-0.02em] [&>span>span:first-child]:text-[#101B2D] [&>span>span:last-child]:bg-none [&>span>span:last-child]:text-[#10A269]" />
                            <p className="mt-0.5 truncate text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#8A98A8]">
                                {APP_BRANDING.badgeLabel}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsCollapsed()}
                            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-[#E9EDF2] bg-white text-[#7C8A9B] transition-colors hover:border-[#DBE2E9] hover:bg-[#F2F5F8] hover:text-[#46566B]"
                            title="Collapse sidebar"
                            aria-label="Collapse sidebar"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            </svg>
                        </button>
                    </>
                )}
            </div>

            <nav
                className={cn(
                    "novera-sidebar-nav custom-scrollbar-light flex-1 overflow-y-auto px-3 py-3.5 transition-opacity duration-200",
                    navPermissionsRefreshing && "opacity-80",
                )}
                aria-busy={!hasMounted || navPermissionsRefreshing}
                aria-label={hasMounted && menuItems.length > 0 ? "Main navigation" : "Loading navigation"}
                suppressHydrationWarning
            >
                {!hasMounted || loadingMenuFallback || studyMatrixShellActive || (studyMatrixNavActive && loadingStudyNavCatalog && !studyNavCatalogMenu?.length) ? (
                    <SidebarNavSkeleton collapsed={navCollapsed} />
                ) : menuItems.length === 0 || visibleMenuItems.length === 0 ? (
                    <div
                        className={cn(
                            "rounded-xl border border-[#E9EDF2] bg-[#F8FAFB] px-3 py-4 text-center",
                            navCollapsed && "px-2 py-3"
                        )}
                        role="status"
                    >
                        {!navCollapsed ? (
                            <>
                                <p className="text-xs font-semibold text-[#46566B]">No navigation</p>
                                <p className="mt-1.5 text-[11px] leading-relaxed text-[#8A98A8]">
                                    {studyMatrixNavActive
                                        ? "This study’s role permission matrix has no modules visible for your assignment. Ask a Super Admin to enable Module visibility (View) for your role under Study Role Permissions."
                                        : roleName
                                          ? `No menu permissions are configured for the ${roleName} role. Ask a Super Admin to enable View access in Masters → Role Permissions, then log out and sign in again.`
                                          : "No menu was returned for this account. Confirm the user has an active role, then ask a Super Admin to configure Role Permissions."}
                                </p>
                                <Link
                                    href="/dashboard"
                                    className="mt-3 inline-flex text-[11px] font-semibold text-[#0C7E52] hover:text-[#10A269]"
                                >
                                    Open dashboard →
                                </Link>
                            </>
                        ) : (
                            <span className="sr-only">No navigation items</span>
                        )}
                    </div>
                ) : (
                    <>
                        {!navCollapsed && (
                            <p className="mb-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A98A8]">
                                Navigation
                            </p>
                        )}
                        {visibleMenuItems.map((item, index) => renderMenuItem(item, 0, index))}
                    </>
                )}
            </nav>

            <div className="relative z-[1] shrink-0 border-t border-[#E9EDF2] p-2.5">
                <div className="relative" ref={userMenuRef}>
                    <button
                        type="button"
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className={cn(APP_SIDEBAR_USER_CARD, navCollapsed && "justify-center px-1.5")}
                        aria-expanded={showUserMenu}
                        aria-haspopup="menu"
                    >
                        <div className="relative shrink-0">
                            <div className="flex h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-[11px] bg-gradient-to-br from-[#10A269] to-[#0E8A5B] text-white">
                                {profileImageUrl ? (
                                    <img
                                        src={profileImageUrl}
                                        alt=""
                                        className="h-full w-full object-cover"
                                        onError={() => setProfileImageUrl(null)}
                                    />
                                ) : (
                                    <svg className="h-4 w-4 text-white/90" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                        </div>
                        {!navCollapsed && (
                            <>
                                <div className="min-w-0 flex-1 text-left">
                                    <div className="truncate text-[13.5px] font-semibold text-[#101B2D]">{userName || "User"}</div>
                                    <div className="truncate text-[11.5px] text-[#8A98A8]">{roleName || "Role"}</div>
                                </div>
                                <svg className="h-3.5 w-3.5 shrink-0 text-[#8A98A8] transition-transform group-hover:text-[#46566B]" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </>
                        )}
                    </button>

                    {showUserMenu && (
                        <div className={cn(
                            "z-[60] overflow-hidden rounded-xl border border-slate-200/80 bg-white py-1.5 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.35)]",
                            isMobileViewport
                                ? "fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] w-auto"
                                : cn(
                                    "absolute bottom-full z-50 mb-2 w-56",
                                    navCollapsed ? "left-full ml-2" : "left-0",
                                ),
                        )}>
                            <div className="px-4 py-3 border-b border-slate-200/50">
                                <div className="text-sm font-semibold text-slate-900">{userName || "User"}</div>
                                <div className="text-xs text-slate-500">{roleName || "Role"}</div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowUserMenu(false)
                                    setShowProfileModal(true)
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-emerald-50"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                    />
                                </svg>
                                Profile
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-emerald-50"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                    />
                                </svg>
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Profile Modal */}
            <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
        </aside>
    )
}