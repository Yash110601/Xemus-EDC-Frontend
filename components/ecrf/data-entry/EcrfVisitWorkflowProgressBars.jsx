"use client"

import CrfProgressBar from "@/components/ecrf/CrfProgressBar"
import { hasCrfProgressData, normalizeCrfProgress } from "@/lib/utils/crfProgress"
import { cn } from "@/lib/utils"

/**
 * Visit card: data entry + save + submit workflow progress bars.
 */
export default function EcrfVisitWorkflowProgressBars({
  dataEntryProgress,
  saveProgress,
  submitProgress,
  showDataEntryCounts = false,
  countUnit = "sections",
  className,
}) {
  const dataEntry = normalizeCrfProgress(dataEntryProgress)
  const save = saveProgress ? normalizeCrfProgress(saveProgress) : null
  const submit = submitProgress ? normalizeCrfProgress(submitProgress) : null
  const unit = saveProgress?.unit || submitProgress?.unit || countUnit

  return (
    <div className={cn("space-y-2.5", className)}>
      <CrfProgressBar
        label="Data entry"
        progress={dataEntry}
        showStatus={hasCrfProgressData(dataEntry)}
        showCounts={showDataEntryCounts && dataEntry.requiredFieldCount > 0}
        size="compact"
      />

      {save ? (
        <CrfProgressBar
          label="Save progress"
          progress={save}
          showStatus
          countsText={`${save.completedRequiredFieldCount} / ${save.requiredFieldCount} ${unit} saved`}
          showCounts={save.requiredFieldCount > 0}
          size="compact"
        />
      ) : null}

      {submit ? (
        <CrfProgressBar
          label="Submit progress"
          progress={submit}
          showStatus
          countsText={`${submit.completedRequiredFieldCount} / ${submit.requiredFieldCount} ${unit} submitted`}
          showCounts={submit.requiredFieldCount > 0}
          size="compact"
        />
      ) : null}
    </div>
  )
}
