/**
 * Build structured parity report between runtime patches and legacy effective props.
 */
export function buildParityReport(input = {}) {
  const {
    runtimeFieldPatches = {},
    allControls = [],
    getEvaluatedControl = () => null,
    crfRuleControlOverrides = {},
    inferredDateBoundsByControl = {},
    comparableProps = [],
  } = input

  const mismatchFields = new Set()
  const mismatches = []
  const checkedFields = new Set()

  Object.entries(runtimeFieldPatches).forEach(([fieldId, patch]) => {
    checkedFields.add(fieldId)
    const baseControl = allControls.find((c) => c.id === fieldId)
    const baseEvaluated = getEvaluatedControl(fieldId) || baseControl || {}
    const legacyProps = {
      ...(baseEvaluated?.properties || {}),
      ...(crfRuleControlOverrides?.[fieldId]?.properties || {}),
      ...(inferredDateBoundsByControl?.[fieldId] || {}),
    }

    comparableProps.forEach((prop) => {
      if (!Object.prototype.hasOwnProperty.call(patch, prop)) return
      const runtimeValue = patch[prop]
      const legacyValue = legacyProps[prop]
      if (runtimeValue === legacyValue) return
      mismatchFields.add(fieldId)
      mismatches.push({
        fieldId,
        property: prop,
        runtimeValue,
        legacyValue,
      })
    })
  })

  return {
    checkedFieldCount: checkedFields.size,
    mismatchFieldCount: mismatchFields.size,
    mismatchCount: mismatches.length,
    mismatchFields: [...mismatchFields],
    mismatches,
  }
}
