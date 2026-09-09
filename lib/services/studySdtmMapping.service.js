import { API_CONFIG } from "../api/config"
import apiClient from "../api/client"
import logger from "../api/logger"
import { buildFieldMappingKey } from "../cdisc/sdtmDomains"

export function normalizeStudySdtmMappingResponse(response) {
  const data = response?.data ?? response?.Data ?? {}
  const catalog = data.catalog ?? data.Catalog ?? []
  const mappings = data.mappings ?? data.Mappings ?? []
  return {
    studyId: Number(data.studyId ?? data.StudyId ?? 0) || 0,
    catalog: Array.isArray(catalog) ? catalog : [],
    mappings: Array.isArray(mappings) ? mappings : [],
  }
}

export function indexMappingsByField(mappings = []) {
  const map = new Map()
  for (const row of mappings) {
    const key = buildFieldMappingKey(
      row.crfDesignId ?? row.CrfDesignId,
      row.sectionKey ?? row.SectionKey,
      row.fieldKey ?? row.FieldKey,
    )
    map.set(key, {
      crfDesignId: row.crfDesignId ?? row.CrfDesignId,
      sectionKey: row.sectionKey ?? row.SectionKey ?? "",
      fieldKey: row.fieldKey ?? row.FieldKey ?? "",
      sdtmDomain: row.sdtmDomain ?? row.SdtmDomain ?? "",
      sdtmVariable: row.sdtmVariable ?? row.SdtmVariable ?? "",
      cdashVariable: row.cdashVariable ?? row.CdashVariable ?? "",
      codelist: row.codelist ?? row.Codelist ?? "",
    })
  }
  return map
}

class StudySdtmMappingService {
  async getMappings(studyId, crfDesignId = null) {
    try {
      const params = new URLSearchParams({ studyId: String(studyId) })
      if (crfDesignId) params.set("crfDesignId", String(crfDesignId))
      const endpoint = `${API_CONFIG.ENDPOINTS.STUDY_SDTM_MAPPING.BASE}?${params.toString()}`
      const response = await apiClient.get(endpoint)
      if (response?.isSuccess) {
        return { ...response, normalized: normalizeStudySdtmMappingResponse(response) }
      }
      throw new Error(response?.message || "Failed to load SDTM mappings")
    } catch (error) {
      logger.error("getMappings failed", error)
      throw error
    }
  }

  async saveMappings(studyId, mappings, { replaceAll = true } = {}) {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.STUDY_SDTM_MAPPING.BASE
      const response = await apiClient.post(endpoint, {
        studyId,
        replaceAll,
        mappings,
      })
      if (response?.isSuccess) return response
      throw new Error(response?.message || "Failed to save SDTM mappings")
    } catch (error) {
      logger.error("saveMappings failed", error)
      throw error
    }
  }

  async listTemplates() {
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.STUDY_SDTM_MAPPING.TEMPLATES)
      if (response?.isSuccess) {
        const list = response.data ?? response.Data ?? []
        return Array.isArray(list) ? list : []
      }
      throw new Error(response?.message || "Failed to load templates")
    } catch (error) {
      logger.error("listTemplates failed", error)
      throw error
    }
  }

  async applyTemplate({ studyId, templateId, crfDesignId = null, replaceAll = true }) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.STUDY_SDTM_MAPPING.APPLY_TEMPLATE, {
        studyId,
        templateId,
        crfDesignId,
        replaceAll,
      })
      if (response?.isSuccess) return response
      throw new Error(response?.message || "Failed to apply template")
    } catch (error) {
      logger.error("applyTemplate failed", error)
      throw error
    }
  }
}

export default new StudySdtmMappingService()
