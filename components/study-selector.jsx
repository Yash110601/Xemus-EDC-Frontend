"use client"

import { useState, useEffect, useRef } from "react"
import { studyService } from "@/lib/services"
import { Skeleton } from "@/components/ui/skeleton"

export default function StudySelector({ currentStudy, onStudySelect, userRole }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("active")
  const [searchQuery, setSearchQuery] = useState("")
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const dropdownRef = useRef(null)

  // Fetch projects when dropdown opens or search changes
  useEffect(() => {
    if (isOpen) {
      const timeoutId = setTimeout(() => {
        fetchProjects()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [isOpen, activeTab, searchQuery])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      // Fetch active studies (isActive = true) or inactive studies (isActive = false)
      const isActive = activeTab === "active"
      const response = await studyService.getStudiesList(1, 1000, searchQuery, isActive)

      if (response && response.isSuccess && response.data) {
        const data = response.data
        const studiesList = Array.isArray(data)
          ? data
          : (data.items || data.Items || [])
        setProjects(studiesList)
      } else {
        setProjects([])
      }
    } catch (error) {
      // Studies API not available
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  const handleStudySelect = (project) => {
    const protocolNumber = project.name || project.projectName || project.code
    setSelectedProject(project)
    if (onStudySelect) {
      onStudySelect(project)
    }
    setIsOpen(false)
    setSearchQuery("")
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Study Number Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors group"
      >
        <span className="text-sm font-semibold text-slate-700 group-hover:text-emerald-600 transition-colors">
          {currentStudy}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown - Opens to the right */}
      {isOpen && (
        <div className="fixed top-16 right-6 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Select Study</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setActiveTab("active")}
                className={`flex-1 px-4 py-2 text-xs font-semibold transition-colors ${activeTab === "active"
                    ? "text-emerald-600 border-b-2 border-emerald-600"
                    : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                ACTIVE STUDY
              </button>
              <button
                onClick={() => setActiveTab("locked")}
                className={`flex-1 px-4 py-2 text-xs font-semibold transition-colors ${activeTab === "locked"
                    ? "text-emerald-600 border-b-2 border-emerald-600"
                    : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                LOCKED STUDY
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-slate-200">
            <input
              type="text"
              placeholder="Search project"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Project List */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3">
                    <Skeleton className="h-4 w-28 bg-slate-200/80" />
                    <Skeleton className="mt-2 h-3 w-40 bg-slate-200/70" />
                  </div>
                ))}
              </div>
            ) : projects.length > 0 ? (
              <div className="space-y-1">
                {projects.map((project, index) => {
                  const projectCode = project.name || project.projectName || project.code || `Project ${index + 1}`
                  const isSelected = selectedProject?.id === project.id || selectedProject?.code === projectCode || currentStudy === projectCode
                  return (
                    <button
                      key={project.id || index}
                      onClick={() => handleStudySelect(project)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${isSelected
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                          : "border-transparent hover:border-slate-200 hover:bg-slate-50 text-slate-700"
                        }`}
                    >
                      <div className="text-sm font-medium">{projectCode}</div>
                      {project.description && (
                        <div className="text-xs text-slate-500 mt-1">{project.description}</div>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">
                {searchQuery ? `No projects found for "${searchQuery}"` : `No ${activeTab === "active" ? "active" : "locked"} projects`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

