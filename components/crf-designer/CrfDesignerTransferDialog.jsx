"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

export default function CrfDesignerTransferDialog({
  open,
  onOpenChange,
  mode = "export",
  includeRules = true,
  onIncludeRulesChange,
  ruleCount = 0,
  importMethod = "api",
  onImportMethodChange,
  canImportToStudy = false,
  onConfirm,
  loading = false,
}) {
  const isExport = mode === "export"
  const title = isExport ? "Export CRF bundle" : "Import CRF bundle"
  const description = isExport
    ? "Download a portable bundle (CRF structure + optional rules) for UAT → PROD or backup."
    : "Restore a CRF bundle into this environment. Prefer direct import to the selected study."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="crf-transfer-include-rules"
              checked={includeRules}
              onCheckedChange={(checked) => onIncludeRulesChange?.(checked === true)}
              disabled={!isExport && ruleCount === 0}
            />
            <div className="space-y-1">
              <Label htmlFor="crf-transfer-include-rules" className="text-sm font-medium leading-none cursor-pointer">
                {isExport ? "Include rules in bundle" : "Import rules from bundle"}
              </Label>
              <p className="text-xs text-slate-500">
                {ruleCount > 0
                  ? `${ruleCount} rule${ruleCount === 1 ? "" : "s"} ${isExport ? "will be included" : "in file"}.`
                  : isExport
                    ? "No rules detected on this CRF yet."
                    : "This bundle has no rules."}
              </p>
            </div>
          </div>

          {!isExport ? (
            <div className="space-y-2 pt-1 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-700">Import destination</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="crf-import-method"
                  className="mt-0.5"
                  checked={importMethod === "api"}
                  onChange={() => onImportMethodChange?.("api")}
                  disabled={!canImportToStudy}
                />
                <span className="text-xs text-slate-600">
                  <span className="font-medium text-slate-800">Import to selected study (recommended)</span>
                  <br />
                  Creates CRF + rules on the server in one step.
                  {!canImportToStudy ? " Select a study first." : null}
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="crf-import-method"
                  className="mt-0.5"
                  checked={importMethod === "designer"}
                  onChange={() => onImportMethodChange?.("designer")}
                />
                <span className="text-xs text-slate-600">
                  <span className="font-medium text-slate-800">Load in designer only</span>
                  <br />
                  Review or edit before saving manually.
                </span>
              </label>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={loading || (!isExport && importMethod === "api" && !canImportToStudy)}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isExport ? "Exporting…" : "Importing…"}
              </>
            ) : isExport ? (
              "Download bundle"
            ) : importMethod === "api" ? (
              "Import to study"
            ) : (
              "Load in designer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
