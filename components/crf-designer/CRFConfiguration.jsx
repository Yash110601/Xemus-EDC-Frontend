"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const CRFConfiguration = ({ config, onChange, isOpen, onToggle, actionButtons }) => {
  const handleChange = (field, value) => {
    onChange({ ...config, [field]: value })
  }

  // Check if name is filled
  const isNameFilled = config.name && config.name.trim() !== ""

  return (
    <div className="border-b border-slate-200">
      <div className="w-full flex items-center justify-between p-3 gap-2 min-w-0 relative overflow-hidden rounded-t-lg">
        {/* Glassy background effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/80 via-blue-50/80 to-teal-50/80 backdrop-blur-sm border-b-2 border-emerald-200/60" />
        <div className="absolute inset-0 bg-white/40 backdrop-blur-sm" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-transparent" />
        
        {/* Content */}
        <div className="relative z-10 flex items-center justify-between w-full gap-2">
        <button
          onClick={onToggle}
            className="flex items-center gap-2 hover:bg-white/50 px-3 py-1.5 rounded-lg transition-all flex-shrink-0 border border-white/60 shadow-sm hover:shadow-md"
        >
            <h3 className="font-bold text-emerald-900 text-base whitespace-nowrap drop-shadow-sm">
              CRF Configuration
            </h3>
          {isOpen ? (
              <ChevronUp className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
              <ChevronDown className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          )}
        </button>
        {actionButtons && (
          <div className="flex items-center flex-shrink-0 overflow-x-auto">
            {actionButtons}
          </div>
        )}
        </div>
      </div>

      {isOpen && (
        <div className="p-4 bg-slate-50 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* CRF Name */}
            <div>
              <Label htmlFor="crf_name" className="text-sm font-medium mb-1 block">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="crf_name"
                value={config.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder=""
                maxLength={200}
                className="w-full"
              />
            </div>

            {/* Is Available for final CRF print */}
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Is Available for final CRF print?
              </Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="isFinalPrint"
                    value="Y"
                    checked={config.isFinalPrint === "Y"}
                    onChange={(e) => handleChange("isFinalPrint", e.target.value)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className="text-sm">Yes</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="isFinalPrint"
                    value="N"
                    checked={config.isFinalPrint === "N"}
                    onChange={(e) => handleChange("isFinalPrint", e.target.value)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className="text-sm">No</span>
                </label>
              </div>
            </div>

            {/* Show Screen Failed popup */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isScreenFailedCrf"
                checked={config.isScreenFailedCrf === true}
                onChange={(e) => handleChange("isScreenFailedCrf", e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300"
              />
              <Label htmlFor="isScreenFailedCrf" className="text-sm font-medium cursor-pointer">
                Show Screen Failed popup
              </Label>
            </div>

            {/* Show Randomized/Enrolled */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isRandomizedEnrolledCrf"
                checked={config.isRandomizedEnrolledCrf === true}
                onChange={(e) => handleChange("isRandomizedEnrolledCrf", e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300"
              />
              <Label htmlFor="isRandomizedEnrolledCrf" className="text-sm font-medium cursor-pointer">
                Show Randomized/Enrolled
              </Label>
            </div>

            {/* Enterprise IWRS stratification sync */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isStratificationCrf"
                checked={config.isStratificationCrf === true}
                onChange={(e) => handleChange("isStratificationCrf", e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300"
              />
              <Label htmlFor="isStratificationCrf" className="text-sm font-medium cursor-pointer">
                Sync stratification to Enterprise IWRS on submit
              </Label>
            </div>
          </div>

          {/* Description and Remarks */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="crf_desc" className="text-sm font-medium mb-1 block">
                Description
              </Label>
              <Textarea
                id="crf_desc"
                value={config.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Enter description"
                maxLength={500}
                rows={3}
                className="w-full"
              />
            </div>
            <div>
              <Label htmlFor="crf_rem" className="text-sm font-medium mb-1 block">
                Remarks
              </Label>
              <Textarea
                id="crf_rem"
                value={config.remarks}
                onChange={(e) => handleChange("remarks", e.target.value)}
                placeholder="Enter remarks"
                maxLength={500}
                rows={3}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CRFConfiguration

