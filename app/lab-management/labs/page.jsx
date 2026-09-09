"use client"

import LabManagementShell from "@/components/lab-management/lab-management-shell"
import LabsSection from "@/components/lab-management/labs-section"

export default function LabsPage() {
  return (
    <div className="w-full">
      <LabManagementShell
        title="Labs"
        subtitle="Lab facility master — contact and location fields align with backend validation limits."
      >
        <LabsSection />
      </LabManagementShell>
    </div>
  )
}
