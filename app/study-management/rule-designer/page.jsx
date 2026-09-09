"use client"

import { useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { TestTube } from "lucide-react"
import RuleCreator from "@/components/rule-designer/RuleCreator"
import RuleList from "@/components/rule-designer/RuleList"

export default function RuleDesignerPage() {
  const [activeTab, setActiveTab] = useState("create") // "create" or "manage"

  return (
    <DashboardLayout>
      <div className="flex min-h-[calc(100dvh-var(--topbar-height,4.5625rem)-1.5rem)] w-full flex-col">
        {/* Content */}
        <div className="flex-1 overflow-hidden px-3 pb-4 sm:px-6 sm:pb-6">
          <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden h-full flex flex-col">
            {/* Tabs */}
            <div className="flex border-b-2 border-slate-200 bg-slate-50/50">
              <button
                onClick={() => setActiveTab("create")}
                className={`relative px-8 py-4 text-base font-bold transition-all ${activeTab === "create"
                    ? "text-emerald-600 bg-white"
                    : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
                  }`}
              >
                Create Rule
                {activeTab === "create" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r btn-brand-gradient" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("manage")}
                className={`relative px-8 py-4 text-base font-bold transition-all ${activeTab === "manage"
                    ? "text-emerald-600 bg-white"
                    : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
                  }`}
              >
                Manage Rules
                {activeTab === "manage" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r btn-brand-gradient" />
                )}
              </button>
            </div>

            {/* Tab Content */}
            <div className="relative flex-1 overflow-hidden min-h-[400px]">
              {/* Create Tab */}
              <div
                key="create-tab"
                className={`absolute inset-0 transition-opacity duration-200 ease-in-out ${
                  activeTab === "create" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                }`}
              >
                {activeTab === "create" && <RuleCreator />}
              </div>

              {/* Manage Tab */}
              <div
                key="manage-tab"
                className={`absolute inset-0 transition-opacity duration-200 ease-in-out ${
                  activeTab === "manage" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                }`}
              >
                {activeTab === "manage" && <RuleList />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

