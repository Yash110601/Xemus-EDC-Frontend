"use client"

import LabManagementShell from "@/components/lab-management/lab-management-shell"
import LabTestsSection from "@/components/lab-management/lab-tests-section"

export default function LabTestsPage() {
  return (
    <div className="w-full">
      <LabManagementShell
        title="Lab tests"
        subtitle="Tests belong to a category; filters and exports respect the same rules as the API."
      >
        <LabTestsSection />
      </LabManagementShell>
    </div>
  )
}
