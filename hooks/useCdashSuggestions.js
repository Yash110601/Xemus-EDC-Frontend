"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { suggestForControl } from "@/lib/cdash/cdashApiSuggest"
import { CDASH_IG_VERSION } from "@/lib/services/cdash.service"

const EMPTY_RESULT = {
  fieldInstanceId: "",
  label: "",
  hasSuggestions: false,
  topSuggestion: null,
  topAvailableSuggestion: null,
  suggestions: [],
}

/** Single-field CDASH suggest — only when user clicks Suggest. */
export function useCdashSuggestions(control, studyId, enabled = true, suggestOptions = {}) {
  const [result, setResult] = useState(EMPTY_RESULT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasFetched, setHasFetched] = useState(false)
  const inFlightRef = useRef(null)

  const controlKey =
    control?.id ??
    control?.properties?.fieldInstanceId ??
    control?.fieldInstanceId ??
    ""

  const numericStudyId = Number(studyId)
  const suggestOptionsKey = JSON.stringify({
    crfDesignId: suggestOptions?.crfDesignId ?? null,
    draftAssignments: suggestOptions?.draftAssignments ?? [],
  })

  useEffect(() => {
    setResult(EMPTY_RESULT)
    setError(null)
    setHasFetched(false)
    inFlightRef.current = null
  }, [controlKey, suggestOptionsKey])

  const fetchSuggestions = useCallback(async () => {
    if (inFlightRef.current) {
      return inFlightRef.current
    }

    if (!enabled || !control || !controlKey || !Number.isFinite(numericStudyId) || numericStudyId <= 0) {
      setError("Study is required for CDASH suggestions")
      return EMPTY_RESULT
    }

    setLoading(true)
    setError(null)

    const request = (async () => {
      try {
        const data = await suggestForControl(control, numericStudyId, CDASH_IG_VERSION, 3, suggestOptions)
        setResult(data)
        setHasFetched(true)
        return data
      } catch (err) {
        setResult(EMPTY_RESULT)
        setHasFetched(true)
        setError(err?.message ?? "Failed to load suggestions")
        return EMPTY_RESULT
      } finally {
        setLoading(false)
        inFlightRef.current = null
      }
    })()

    inFlightRef.current = request
    return request
  }, [control, controlKey, enabled, numericStudyId, suggestOptions, suggestOptionsKey])

  const dismissSuggestions = useCallback(() => {
    setResult(EMPTY_RESULT)
    setHasFetched(false)
    setError(null)
  }, [])

  return {
    ...result,
    topSuggestion: result.topAvailableSuggestion ?? result.topSuggestion ?? result.suggestions[0] ?? null,
    loading,
    error,
    hasFetched,
    fetchSuggestions,
    dismissSuggestions,
  }
}
