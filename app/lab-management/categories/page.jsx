"use client"

import { useMemo } from "react"
import LabManagementShell from "@/components/lab-management/lab-management-shell"
import { SimpleNameDescEntitySuspense } from "@/components/lab-management/simple-name-desc-entity"
import labManagementService from "@/lib/services/labManagement.service"

export default function LabCategoriesPage() {
  const api = useMemo(
    () => ({
      getList: (p, s, search, active) => labManagementService.getLabCategoriesList(p, s, search, active),
      getById: (id) => labManagementService.getLabCategoryById(id),
      create: (body) => labManagementService.createLabCategory(body),
      update: (id, body) => labManagementService.updateLabCategory(id, body),
      updateStatus: (id, isActive) => labManagementService.updateLabCategoryStatus(id, isActive),
      exportCsv: (search, active) => labManagementService.exportLabCategoriesCsv(search, active),
    }),
    []
  )

  return (
    <div className="w-full">
      <LabManagementShell
        title="Lab categories"
        subtitle="Group lab tests by clinical or administrative category."
      >
        <SimpleNameDescEntitySuspense nameLabel="Category name" sectionTitle="Lab categories" api={api} />
      </LabManagementShell>
    </div>
  )
}
