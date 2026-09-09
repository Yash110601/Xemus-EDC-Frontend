/**
 * Convert runtime field patches into control-override map expected by UI layer.
 * Keeps adapter small and deterministic for rollout.
 */
export function buildPilotControlOverrides(runtimeFieldPatches = {}, comparableProps = []) {
  const overrides = {}
  Object.entries(runtimeFieldPatches).forEach(([fieldId, patch]) => {
    const properties = {}
    comparableProps.forEach((prop) => {
      if (Object.prototype.hasOwnProperty.call(patch, prop)) {
        properties[prop] = patch[prop]
      }
    })
    if (Object.keys(properties).length > 0) {
      overrides[fieldId] = { properties }
    }
  })
  return overrides
}

/**
 * Apply runtime value patches to form slice.
 */
export function applyValuePatchesToFormSlice(prevSlice = {}, runtimeFieldPatches = {}) {
  const nextSlice = { ...(prevSlice || {}) }
  let changed = false
  Object.entries(runtimeFieldPatches).forEach(([fieldId, patch]) => {
    if (!Object.prototype.hasOwnProperty.call(patch, "value")) return
    const nextValue = patch.value
    if (nextSlice[fieldId] !== nextValue) {
      nextSlice[fieldId] = nextValue
      changed = true
    }
  })
  return {
    changed,
    nextSlice,
  }
}
