import {
  Activity,
  BookOpen,
  Calendar,
  ClipboardList,
  FileCheck,
  FileText,
  MapPin,
  UserCircle,
  Users,
} from "lucide-react"

/** Lucide icons for dashboard KPI cards (matches hero redesign). */
export const DASHBOARD_METRIC_ICONS = {
  study: BookOpen,
  sites: MapPin,
  visit: Calendar,
  users: Users,
  ecrf: FileText,
  patients: UserCircle,
  active: Activity,
  agreement: FileCheck,
  piPending: ClipboardList,
}

export function getDashboardMetricIcon(metricKey) {
  return DASHBOARD_METRIC_ICONS[metricKey] ?? BookOpen
}
