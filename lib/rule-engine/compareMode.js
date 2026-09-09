/**
 * Build dual-run compare status from parity report.
 */
export function buildCompareModeStatus(parityReport = {}, options = {}) {
  const mismatchCount = Number(parityReport?.mismatchCount || 0)
  const mismatchWarnThreshold = Number(options?.mismatchWarnThreshold || 0)
  const severity =
    mismatchCount === 0
      ? "pass"
      : mismatchWarnThreshold > 0 && mismatchCount <= mismatchWarnThreshold
        ? "warn"
        : "fail"

  return {
    severity,
    mismatchCount,
    mismatchFieldCount: Number(parityReport?.mismatchFieldCount || 0),
    checkedFieldCount: Number(parityReport?.checkedFieldCount || 0),
    message:
      severity === "pass"
        ? "Legacy and runtime patches are aligned."
        : severity === "warn"
          ? "Runtime parity mismatches are within warn threshold."
          : "Runtime parity mismatches exceeded threshold.",
  }
}
