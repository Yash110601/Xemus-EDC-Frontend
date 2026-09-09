"use client"

import { useMemo } from "react"
import LabManagementShell from "@/components/lab-management/lab-management-shell"
import { SimpleNameDescEntitySuspense } from "@/components/lab-management/simple-name-desc-entity"
import labManagementService from "@/lib/services/labManagement.service"

export default function LabUnitsPage() {
  /**
   * Manage grid → Edit opens the modal, then one row is loaded with:
   * `getById` → `labManagementService.getLabUnitById(id)` → GET `LabUnits/GetLabUnitById/:id` (see `lib/api/config.js`).
   * Save uses `update` → PUT `LabUnits/UpdateLabUnit/:id`.
   */
  const api = useMemo(
    () => ({
      getList: (p, s, search, active) => labManagementService.getLabUnitsList(p, s, search, active),
      getById: (id) => labManagementService.getLabUnitById(id),
      create: (body) => labManagementService.createLabUnit(body),
      update: (id, body) => labManagementService.updateLabUnit(id, body),
      updateStatus: (id, isActive) => labManagementService.updateLabUnitStatus(id, isActive),
      exportCsv: (search, active) => labManagementService.exportLabUnitsCsv(search, active),
    }),
    []
  )

  return (
    <div className="w-full">
      <LabManagementShell
        title="Lab units"
        subtitle="Define measurement units used across lab tests and reference ranges."
      >
        <SimpleNameDescEntitySuspense nameLabel="Unit name" sectionTitle="Lab units" api={api} />
      </LabManagementShell>
    </div>
  )
}
