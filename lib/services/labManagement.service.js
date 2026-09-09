/**
 * Lab Management — units, categories, tests, labs, range assignments.
 * Aligns with Pr.Edc.API Lab* controllers & LabRangeAssignmentsController.
 */

import apiClient from "../api/client"
import { API_CONFIG, STORAGE_KEYS } from "../api/config"
import logger from "../api/logger"
import { unwrapPagedPayload } from "../utils/pagedApi"

const LM = API_CONFIG.ENDPOINTS.LAB_MANAGEMENT

async function downloadCsvGet(pathWithLeadingSlash, queryParams, defaultFileBase) {
  const qs = queryParams.toString()
  const url = `${API_CONFIG.BASE_URL}${pathWithLeadingSlash}${qs ? `?${qs}` : ""}`
  const token = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) : null

  const response = await fetch(url, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!response.ok) {
    let msg = `Export failed (${response.status})`
    try {
      const err = await response.json()
      msg = err.message || err.Message || err.title || msg
    } catch {
      /* binary or text error body */
    }
    return { isSuccess: false, message: msg }
  }

  const blob = await response.blob()
  const cd = response.headers.get("Content-Disposition")
  let filename = `${defaultFileBase}-${new Date().toISOString().slice(0, 10)}.csv`
  if (cd) {
    const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i)
    if (m) filename = decodeURIComponent(m[1].replace(/"/g, "").trim())
  }

  const downloadUrl = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = downloadUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(downloadUrl)
  document.body.removeChild(a)

  return { isSuccess: true, message: "Export started" }
}

/** Labs/DTO endpoints expect PascalCase property names (.NET model binding). */
function toLabFacilityWritePayload(body) {
  if (!body || typeof body !== "object") return body
  const name = body.LabName ?? body.name
  const pinRaw = body.PinCode ?? body.pinCode ?? body.pincode
  const pinStr = pinRaw != null && String(pinRaw).trim() !== "" ? String(pinRaw).trim() : null
  return {
    LabName: typeof name === "string" ? name.trim() : name,
    Description: body.Description ?? body.description ?? null,
    Contact: body.Contact ?? body.contact ?? null,
    Address: body.Address ?? body.address ?? null,
    PinCode: pinStr,
    City: body.City ?? body.city ?? null,
    State: body.State ?? body.state ?? null,
    Country: body.Country ?? body.country ?? null,
  }
}

class LabManagementService {
  // —— Lab units ——
  async getLabUnitsList(pageNumber = 1, pageSize = 10, search = null, isActive = null) {
    try {
      const q = new URLSearchParams({
        pageNumber: String(pageNumber),
        pageSize: String(pageSize),
      })
      if (search) q.append("search", search)
      if (isActive !== null && isActive !== undefined) q.append("isActive", String(isActive))
      const res = await apiClient.get(`${LM.LAB_UNITS.LIST}?${q}`)
      if (res.isSuccess && res.data) {
        const p = unwrapPagedPayload(res.data)
        return { ...res, data: { ...res.data, ...p } }
      }
      return res
    } catch (e) {
      logger.error("getLabUnitsList", e)
      return { isSuccess: false, message: e.message, data: null }
    }
  }

  async getLabUnitById(id) {
    return apiClient.get(LM.LAB_UNITS.BY_ID(id))
  }

  async createLabUnit(body) {
    return apiClient.post(LM.LAB_UNITS.CREATE, body)
  }

  async updateLabUnit(id, body) {
    return apiClient.put(LM.LAB_UNITS.UPDATE(id), body)
  }

  async updateLabUnitStatus(id, isActive) {
    return apiClient.put(LM.LAB_UNITS.UPDATE_STATUS(id), { isActive })
  }

  async getLabUnitsDropdown() {
    return apiClient.get(LM.LAB_UNITS.DROPDOWN)
  }

  async exportLabUnitsCsv(search = null, isActive = null) {
    const q = new URLSearchParams()
    if (search) q.append("search", search)
    if (isActive !== null && isActive !== undefined) q.append("isActive", String(isActive))
    return downloadCsvGet(LM.LAB_UNITS.EXPORT, q, "lab-units")
  }

  // —— Lab categories ——
  async getLabCategoriesList(pageNumber = 1, pageSize = 10, search = null, isActive = null) {
    try {
      const q = new URLSearchParams({
        pageNumber: String(pageNumber),
        pageSize: String(pageSize),
      })
      if (search) q.append("search", search)
      if (isActive !== null && isActive !== undefined) q.append("isActive", String(isActive))
      const res = await apiClient.get(`${LM.LAB_CATEGORIES.LIST}?${q}`)
      if (res.isSuccess && res.data) {
        const p = unwrapPagedPayload(res.data)
        return { ...res, data: { ...res.data, ...p } }
      }
      return res
    } catch (e) {
      logger.error("getLabCategoriesList", e)
      return { isSuccess: false, message: e.message, data: null }
    }
  }

  async getLabCategoryById(id) {
    return apiClient.get(LM.LAB_CATEGORIES.BY_ID(id))
  }

  async createLabCategory(body) {
    return apiClient.post(LM.LAB_CATEGORIES.CREATE, body)
  }

  async updateLabCategory(id, body) {
    return apiClient.put(LM.LAB_CATEGORIES.UPDATE(id), body)
  }

  async updateLabCategoryStatus(id, isActive) {
    return apiClient.put(LM.LAB_CATEGORIES.UPDATE_STATUS(id), { isActive })
  }

  async getLabCategoriesDropdown() {
    return apiClient.get(LM.LAB_CATEGORIES.DROPDOWN)
  }

  async exportLabCategoriesCsv(search = null, isActive = null) {
    const q = new URLSearchParams()
    if (search) q.append("search", search)
    if (isActive !== null && isActive !== undefined) q.append("isActive", String(isActive))
    return downloadCsvGet(LM.LAB_CATEGORIES.EXPORT, q, "lab-categories")
  }

  // —— Lab tests ——
  async getLabTestsList(
    pageNumber = 1,
    pageSize = 10,
    search = null,
    isActive = null,
    labCategoryId = null
  ) {
    try {
      const q = new URLSearchParams({
        pageNumber: String(pageNumber),
        pageSize: String(pageSize),
      })
      if (search) q.append("search", search)
      if (isActive !== null && isActive !== undefined) q.append("isActive", String(isActive))
      if (labCategoryId !== null && labCategoryId !== undefined && labCategoryId !== "") {
        q.append("labCategoryId", String(labCategoryId))
      }
      const res = await apiClient.get(`${LM.LAB_TESTS.LIST}?${q}`)
      if (res.isSuccess && res.data) {
        const p = unwrapPagedPayload(res.data)
        return { ...res, data: { ...res.data, ...p } }
      }
      return res
    } catch (e) {
      logger.error("getLabTestsList", e)
      return { isSuccess: false, message: e.message, data: null }
    }
  }

  async searchLabTests(search, labCategoryId = null, take = 50) {
    const q = new URLSearchParams({ take: String(take) })
    if (search) q.append("search", search)
    if (labCategoryId) q.append("labCategoryId", String(labCategoryId))
    return apiClient.get(`${LM.LAB_TESTS.SEARCH}?${q}`)
  }

  async getLabTestById(id) {
    return apiClient.get(LM.LAB_TESTS.BY_ID(id))
  }

  async createLabTest(body) {
    return apiClient.post(LM.LAB_TESTS.CREATE, body)
  }

  async updateLabTest(id, body) {
    return apiClient.put(LM.LAB_TESTS.UPDATE(id), body)
  }

  async updateLabTestStatus(id, isActive) {
    return apiClient.put(LM.LAB_TESTS.UPDATE_STATUS(id), { isActive })
  }

  async getLabTestsDropdown(labCategoryId = null) {
    const q = new URLSearchParams()
    if (labCategoryId !== null && labCategoryId !== undefined && labCategoryId !== "") {
      q.append("labCategoryId", String(labCategoryId))
    }
    const suffix = q.toString() ? `?${q}` : ""
    return apiClient.get(`${LM.LAB_TESTS.DROPDOWN}${suffix}`)
  }

  async exportLabTestsCsv(search = null, isActive = null, labCategoryId = null) {
    const q = new URLSearchParams()
    if (search) q.append("search", search)
    if (isActive !== null && isActive !== undefined) q.append("isActive", String(isActive))
    if (labCategoryId !== null && labCategoryId !== undefined && labCategoryId !== "") {
      q.append("labCategoryId", String(labCategoryId))
    }
    return downloadCsvGet(LM.LAB_TESTS.EXPORT, q, "lab-tests")
  }

  // —— Labs (facilities) ——
  async getLabsList(pageNumber = 1, pageSize = 10, search = null, isActive = null) {
    try {
      const q = new URLSearchParams({
        pageNumber: String(pageNumber),
        pageSize: String(pageSize),
      })
      if (search) q.append("search", search)
      if (isActive !== null && isActive !== undefined) q.append("isActive", String(isActive))
      const res = await apiClient.get(`${LM.LABS.LIST}?${q}`)
      if (res.isSuccess && res.data) {
        const p = unwrapPagedPayload(res.data)
        return { ...res, data: { ...res.data, ...p } }
      }
      return res
    } catch (e) {
      logger.error("getLabsList", e)
      return { isSuccess: false, message: e.message, data: null }
    }
  }

  async getLabById(id) {
    return apiClient.get(LM.LABS.BY_ID(id))
  }

  async createLab(body) {
    return apiClient.post(LM.LABS.CREATE, toLabFacilityWritePayload(body))
  }

  async updateLab(id, body) {
    return apiClient.put(LM.LABS.UPDATE(id), toLabFacilityWritePayload(body))
  }

  async updateLabStatus(id, isActive) {
    return apiClient.put(LM.LABS.UPDATE_STATUS(id), { isActive })
  }

  async getLabsDropdown() {
    return apiClient.get(LM.LABS.DROPDOWN)
  }

  async exportLabsCsv(search = null, isActive = null) {
    const q = new URLSearchParams()
    if (search) q.append("search", search)
    if (isActive !== null && isActive !== undefined) q.append("isActive", String(isActive))
    return downloadCsvGet(LM.LABS.EXPORT, q, "labs")
  }

  // —— Lab range assignments ——
  async getLabRangeAssignmentsList(
    pageNumber = 1,
    pageSize = 10,
    labId = null,
    search = null,
    isActive = null
  ) {
    try {
      const q = new URLSearchParams({
        pageNumber: String(pageNumber),
        pageSize: String(pageSize),
      })
      if (labId !== null && labId !== undefined && labId !== "") q.append("labId", String(labId))
      if (search) q.append("search", search)
      if (isActive !== null && isActive !== undefined) q.append("isActive", String(isActive))
      const res = await apiClient.get(`${LM.LAB_RANGE_ASSIGNMENTS.LIST}?${q}`)
      if (res.isSuccess && res.data) {
        const p = unwrapPagedPayload(res.data)
        return { ...res, data: { ...res.data, ...p } }
      }
      return res
    } catch (e) {
      logger.error("getLabRangeAssignmentsList", e)
      return { isSuccess: false, message: e.message, data: null }
    }
  }

  async getLabRangeAssignmentById(id) {
    return apiClient.get(LM.LAB_RANGE_ASSIGNMENTS.BY_ID(id))
  }

  async createLabRangeAssignmentsBatch(body) {
    return apiClient.post(LM.LAB_RANGE_ASSIGNMENTS.CREATE_BATCH, body)
  }

  async updateLabRangeAssignment(id, body) {
    return apiClient.put(LM.LAB_RANGE_ASSIGNMENTS.UPDATE(id), body)
  }

  async updateLabRangeAssignmentStatus(id, isActive) {
    return apiClient.put(LM.LAB_RANGE_ASSIGNMENTS.UPDATE_STATUS(id), { isActive })
  }

  async exportLabRangeAssignmentsCsv(labId = null, search = null, isActive = null) {
    const q = new URLSearchParams()
    if (labId !== null && labId !== undefined && labId !== "") q.append("labId", String(labId))
    if (search) q.append("search", search)
    if (isActive !== null && isActive !== undefined) q.append("isActive", String(isActive))
    return downloadCsvGet(LM.LAB_RANGE_ASSIGNMENTS.EXPORT, q, "lab-range-assignments")
  }
}

const labManagementService = new LabManagementService()
export default labManagementService
