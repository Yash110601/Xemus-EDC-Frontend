"use client"

import LabManagementShell from "@/components/lab-management/lab-management-shell"
import LabRangeAssignmentsSection from "@/components/lab-management/lab-range-assignments-section"

export default function LabRangeAssignmentsPage() {
  return (
    <div className="w-full">
      <LabManagementShell
        title="Lab range assignment"
        subtitle="Batch-create ranges per lab; category and test must stay consistent. Export honors lab scope and filters."
      >
        <LabRangeAssignmentsSection />
      </LabManagementShell>
    </div>
  )
}
