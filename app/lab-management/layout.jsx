import DashboardLayout from "@/components/dashboard-layout"
import { LabManagementPageBackdrop } from "@/components/lab-management/lab-ui"

export default function LabManagementLayout({ children }) {
  return (
    <DashboardLayout>
      <LabManagementPageBackdrop>{children}</LabManagementPageBackdrop>
    </DashboardLayout>
  )
}
