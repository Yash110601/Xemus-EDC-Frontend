"use client"

import { useState, useEffect } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { permissionsService, rolesService, authService } from "@/lib/services"
import { refreshAuthMenuFromRolePermissions } from "@/lib/utils/refreshAuthMenuFromPermissions"
import { getUserRoleGuid } from "@/lib/utils/authMenuFallback"
import { Shield, Save, Loader2, ChevronDown, ChevronRight, CheckSquare, Square, Lock, Eye, Plus, Edit, Trash2, Download, FolderOpen, Folder } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"

// Premium CSS animations and styles
const style = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes fadeInLeft {
    from {
      opacity: 0;
      transform: translateX(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  @keyframes shimmer {
    0% {
      background-position: -1000px 0;
    }
    100% {
      background-position: 1000px 0;
    }
  }
  @keyframes pulse-glow {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4);
    }
    50% {
      box-shadow: 0 0 0 8px rgba(99, 102, 241, 0);
    }
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: linear-gradient(to bottom, #f8fafc, #f1f5f9);
    border-radius: 10px;
    border: 2px solid #e2e8f0;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, #0f766e, #10b981, #14b8a6);
    border-radius: 10px;
    border: 2px solid #f1f5f9;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to bottom, #0d9488, #059669, #0f766e);
  }
  .glass-effect {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.3);
  }
  .permission-toggle {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }
  .permission-toggle input {
    opacity: 0;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    cursor: pointer;
  }
  .permission-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #cbd5e1;
    transition: 0.3s;
    border-radius: 26px;
  }
  .permission-slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  .permission-toggle input:checked + .permission-slider {
    background: linear-gradient(135deg, #0f3d4a 0%, #0a7c55 100%);
  }
  .permission-toggle input:checked + .permission-slider:before {
    transform: translateX(22px);
  }
  .permission-toggle:hover .permission-slider {
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.12);
  }
`

export default function RolePermissionPage() {
  const [selectedRoleGuid, setSelectedRoleGuid] = useState("")
  const [availableRoles, setAvailableRoles] = useState([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [features, setFeatures] = useState([])
  const [loadingFeatures, setLoadingFeatures] = useState(false)
  const [expandedFeatures, setExpandedFeatures] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState("")

  // Get current user's role
  useEffect(() => {
    const user = authService.getUser()
    if (user) {
      const roleName = user.roleName || user.role || ""
      setCurrentUserRole(roleName.toLowerCase())
    }
  }, [])

  // Fetch available roles
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setLoadingRoles(true)
        const response = await rolesService.getRolesForDropdown()
        // Handle both isSuccess (from client) and success (from API) fields
        const isSuccess = response.isSuccess !== undefined ? response.isSuccess : (response.success === true)
        if (isSuccess && response.data) {
          // Map the response to match expected structure
          // API returns: { guid, name }
          let mappedRoles = response.data.map(role => ({
            roleGuid: role.guid || role.roleGuid,
            roleName: role.name || role.roleName
          }))
          
          // Filter out roles based on current user's role
          if (currentUserRole.includes("admin")) {
            if (currentUserRole.includes("super")) {
              // Super admin: filter out "superadmin" role but can see "admin" role
              mappedRoles = mappedRoles.filter(role => {
                const roleNameLower = (role.roleName || "").toLowerCase()
                return !roleNameLower.includes("superadmin") && !roleNameLower.includes("super admin")
              })
            } else {
              // Regular admin: filter out "admin" role
              mappedRoles = mappedRoles.filter(role => {
                const roleNameLower = (role.roleName || "").toLowerCase()
                return !roleNameLower.includes("admin")
              })
            }
          }
          
          setAvailableRoles(mappedRoles)
        }
      } catch (err) {
        console.error("Error fetching roles:", err)
        toast({
          title: "Failed to load roles",
          description: "Please try again.",
          variant: "destructive",
          duration: 2000,
        })
      } finally {
        setLoadingRoles(false)
      }
    }
    fetchRoles()
  }, [currentUserRole])

  // Fetch features and sub-features
  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        setLoadingFeatures(true)
        const response = await permissionsService.getAllFeaturesAndSubFeatures()
        if (response.isSuccess && response.data) {
          setFeatures(response.data)
          // Don't auto-expand - user will click to expand
          setExpandedFeatures(new Set())
        }
      } catch (err) {
        console.error("Error fetching features:", err)
        toast({
          title: "Failed to load features",
          description: "Could not load features and sub-features.",
          variant: "destructive",
          duration: 2000,
        })
      } finally {
        setLoadingFeatures(false)
      }
    }
    fetchFeatures()
  }, [])

  // Fetch role permissions when role is selected
  useEffect(() => {
    if (selectedRoleGuid) {
      const fetchRolePermissions = async () => {
        try {
          setLoadingFeatures(true)
          const response = await permissionsService.getRolePermissions(selectedRoleGuid)
          if (response.isSuccess && response.data) {
            setFeatures(response.data)
            // Don't auto-expand - user will click to expand
            setExpandedFeatures(new Set())
          }
        } catch (err) {
          console.error("Error fetching role permissions:", err)
          toast({
            title: "Failed to load role permissions",
            variant: "destructive",
            duration: 2000,
          })
        } finally {
          setLoadingFeatures(false)
        }
      }
      fetchRolePermissions()
    } else {
      // Reset to all features when no role is selected
      const fetchFeatures = async () => {
        try {
          setLoadingFeatures(true)
          const response = await permissionsService.getAllFeaturesAndSubFeatures()
          if (response.isSuccess && response.data) {
            setFeatures(response.data)
            // Don't auto-expand - user will click to expand
            setExpandedFeatures(new Set())
          }
        } catch (err) {
          console.error("Error fetching features:", err)
        } finally {
          setLoadingFeatures(false)
        }
      }
      fetchFeatures()
    }
  }, [selectedRoleGuid])

  const toggleFeature = (featureId) => {
    setExpandedFeatures(prev => {
      const newSet = new Set()
      // If the clicked feature is already expanded, collapse it
      // Otherwise, expand only the clicked feature (accordion behavior)
      if (!prev.has(featureId)) {
        newSet.add(featureId)
      }
      return newSet
    })
  }

  const handlePermissionChange = (featureId, subFeatureId, permissionType, value) => {
    setFeatures(prevFeatures => {
      return prevFeatures.map(feature => {
        if (feature.id === featureId) {
          if (subFeatureId) {
            // Update sub-feature permission
            return {
              ...feature,
              subFeatures: feature.subFeatures.map(sf => {
                if (sf.id === subFeatureId) {
                  return {
                    ...sf,
                    [permissionType]: value
                  }
                }
                return sf
              })
            }
          } else {
            // Update feature permission
            return {
              ...feature,
              [permissionType]: value
            }
          }
        }
        return feature
      })
    })
  }

  const handleSave = async () => {
    if (!selectedRoleGuid) {
      toast({
        title: "Please select a role first",
        variant: "destructive",
        duration: 2000,
      })
      return
    }

    try {
      setLoading(true)

      // Prepare data according to backend structure
      const requestData = {
        roleGuid: selectedRoleGuid,
        features: features.map(feature => ({
          featureId: feature.id,
          isView: feature.isView || false,
          isAdd: feature.isAdd || false,
          isEdit: feature.isEdit || false,
          isDelete: feature.isDelete || false,
          isExport: feature.isExport || false,
          subFeatures: feature.subFeatures.map(subFeature => ({
            subFeatureId: subFeature.id,
            isView: subFeature.isView || false,
            isAdd: subFeature.isAdd || false,
            isEdit: subFeature.isEdit || false,
            isDelete: subFeature.isDelete || false,
            isExport: subFeature.isExport || false
          }))
        }))
      }

      const response = await permissionsService.saveRolePermissions(requestData)
      
      if (response.isSuccess) {
        const callerRoleGuid = getUserRoleGuid(authService.getUser())
        if (callerRoleGuid && String(callerRoleGuid).toLowerCase() === String(selectedRoleGuid).toLowerCase()) {
          await refreshAuthMenuFromRolePermissions()
        }
        window.dispatchEvent(new CustomEvent("authMenuUpdated"))
        toast({
          title: "Role permissions saved successfully!",
          description:
            callerRoleGuid && String(callerRoleGuid).toLowerCase() === String(selectedRoleGuid).toLowerCase()
              ? "Your menu has been refreshed."
              : "Users with this role should log out and sign in again to refresh the sidebar.",
          variant: "success",
          duration: 3000,
        })
        // Refresh the permissions
        const refreshResponse = await permissionsService.getRolePermissions(selectedRoleGuid)
        if (refreshResponse.isSuccess && refreshResponse.data) {
          setFeatures(refreshResponse.data)
        }
      } else {
        const msg = response.message || "Failed to save role permissions"
        toast({
          title: "Save failed",
          description: msg,
          variant: "destructive",
          duration: 2000,
        })
      }
    } catch (err) {
      console.error("Error saving permissions:", err)
      const msg = "An error occurred while saving permissions"
      toast({
        title: "Save failed",
        description: msg,
        variant: "destructive",
        duration: 2000,
      })
    } finally {
      setLoading(false)
    }
  }

  const PermissionToggle = ({ checked, onChange, label, icon: Icon, color = "indigo" }) => {
    const colorClasses = {
      indigo: {
        checked: "bg-gradient-to-r from-emerald-500 to-emerald-600",
        icon: checked ? "text-emerald-600" : "text-slate-400",
        text: checked ? "text-emerald-700 font-semibold" : "text-slate-500"
      }
    }
    const colors = colorClasses[color]

    return (
      <div className="flex flex-col items-center gap-1.5 group">
        <label
          className="permission-toggle cursor-pointer"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          />
          <span className="permission-slider"></span>
        </label>
        {Icon && (
          <div className={`p-2 rounded-lg transition-all ${
            checked 
              ? "bg-emerald-100 shadow-sm" 
              : "bg-slate-100 group-hover:bg-emerald-50"
          }`}>
            <Icon className={`w-4 h-4 ${colors.icon} transition-colors`} />
          </div>
        )}
        <span className={`text-[10px] font-medium transition-colors ${colors.text} group-hover:text-emerald-600`}>
          {label}
        </span>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <style>{style}</style>
      <div className="w-full relative" style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(139, 92, 246, 0.03) 50%, rgba(168, 85, 247, 0.03) 100%)'
      }}>
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-200/20 to-teal-200/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-teal-200/20 to-pink-200/20 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-300/20 border border-white/50 overflow-hidden" style={{
          boxShadow: '0 20px 60px -12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5)'
        }}>
          {/* Premium Header with glassmorphism */}
          <div className="relative bg-gradient-to-r btn-brand-gradient px-6 py-5 overflow-hidden">
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                backgroundSize: '40px 40px'
              }}></div>
            </div>
            <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white mb-0.5">Role based permission</h1>
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={loading || !selectedRoleGuid}
                className="group flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 rounded-xl hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 relative overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></span>
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                    <span className="relative z-10">Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 relative z-10" />
                    <span className="relative z-10">Save permissions</span>
                  </>
                )}
              </button>
            </div>
            </div>
          </div>

          <div className="p-10">
            {/* Premium Role Selection */}
            <div className="mb-10">
              <div className="relative max-w-md">
                <Select
                  value={selectedRoleGuid ? selectedRoleGuid : "none"}
                  onValueChange={(value) => setSelectedRoleGuid(value === "none" ? "" : value)}
                  disabled={loadingRoles}
                >
                  {/* Keep same visual size as previous native <select> */}
                  <SelectTrigger className="w-full h-auto px-6 py-4 border-2 border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed bg-white text-slate-900 font-semibold shadow-lg hover:shadow-xl hover:border-emerald-400 transition-all cursor-pointer text-base">
                    <SelectValue placeholder={loadingRoles ? "Loading roles..." : "Select Role"} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-2 border-slate-200 rounded-2xl shadow-lg">
                    <SelectItem
                      value="none"
                      className="px-4 py-2 data-[highlighted]:bg-emerald-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors"
                    >
                      -- Select a Role --
                    </SelectItem>
                    {availableRoles.map((role, index) => (
                      <SelectItem
                        key={role.roleGuid || `role-${index}`}
                        value={(role.roleGuid || "").toString() || `role-${index}`}
                        className="px-4 py-2 data-[highlighted]:bg-emerald-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors"
                      >
                        {role.roleName || "Unknown Role"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Premium Permissions Tree */}
            {loadingFeatures ? (
              <SectionSkeleton title="Loading permissions..." rows={6} variant="permissions" />
            ) : features.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                  <Lock className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-600 font-semibold text-base mb-2">
                  {selectedRoleGuid ? "No permissions found" : "Select a role to begin"}
                </p>
                <p className="text-slate-400 text-xs">
                  {selectedRoleGuid ? "This role doesn't have any permissions configured yet" : "Choose a role from the dropdown above to view and manage permissions"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {features.map((feature, featureIndex) => {
                  const isExpanded = expandedFeatures.has(feature.id)
                  const hasSubFeatures = feature.subFeatures && feature.subFeatures.length > 0
                  return (
                    <div
                      key={feature.id}
                      className="group border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 bg-white"
                    >
                      {/* Feature header (collapsed/expanded row) */}
                      <div
                        className={`relative flex items-center justify-between px-5 py-3.5 transition-all duration-200 ${
                          hasSubFeatures ? "cursor-pointer hover:bg-emerald-50/40" : ""
                        } ${isExpanded ? "border-b border-slate-200 bg-slate-50/80" : ""}`}
                        onClick={hasSubFeatures ? () => toggleFeature(feature.id) : undefined}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                            {isExpanded ? (
                              <FolderOpen className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <Folder className="w-5 h-5 text-emerald-600" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {hasSubFeatures && (
                              <div className="transition-transform duration-200">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-emerald-600" />
                                )}
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-sm text-slate-900">{feature.name}</span>
                              <span className="ml-2 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                {feature.code}
                              </span>
                              {hasSubFeatures && (
                                <span className="ml-2 text-[11px] text-slate-500 font-medium">
                                  {feature.subFeatures.length} sub-feature
                                  {feature.subFeatures.length !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200/70">
                          <PermissionToggle
                            checked={feature.isView || false}
                            onChange={(value) => handlePermissionChange(feature.id, null, "isView", value)}
                            label="View"
                          />
                          <PermissionToggle
                            checked={feature.isAdd || false}
                            onChange={(value) => handlePermissionChange(feature.id, null, "isAdd", value)}
                            label="Add"
                          />
                          <PermissionToggle
                            checked={feature.isEdit || false}
                            onChange={(value) => handlePermissionChange(feature.id, null, "isEdit", value)}
                            label="Edit"
                          />
                          <PermissionToggle
                            checked={feature.isDelete || false}
                            onChange={(value) => handlePermissionChange(feature.id, null, "isDelete", value)}
                            label="Delete"
                          />
                          <PermissionToggle
                            checked={feature.isExport || false}
                            onChange={(value) => handlePermissionChange(feature.id, null, "isExport", value)}
                            label="Export"
                          />
                        </div>
                      </div>

                      {/* Sub-features list */}
                      {isExpanded && hasSubFeatures && (
                        <div className="bg-white divide-y divide-slate-100">
                          {feature.subFeatures.map((subFeature) => {
                            return (
                              <div
                                key={subFeature.id}
                                className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                              >
                                <div className="flex items-start gap-3 flex-1">
                                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-medium text-sm text-slate-800">
                                        {subFeature.name}
                                      </span>
                                      <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                        {subFeature.code}
                                      </span>
                                    </div>
                                    {subFeature.description && (
                                      <p className="text-xs text-slate-500 leading-relaxed">
                                        {subFeature.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
                                  <PermissionToggle
                                    checked={subFeature.isView || false}
                                    onChange={(value) =>
                                      handlePermissionChange(feature.id, subFeature.id, "isView", value)
                                    }
                                    label="View"
                                  />
                                  <PermissionToggle
                                    checked={subFeature.isAdd || false}
                                    onChange={(value) =>
                                      handlePermissionChange(feature.id, subFeature.id, "isAdd", value)
                                    }
                                    label="Add"
                                  />
                                  <PermissionToggle
                                    checked={subFeature.isEdit || false}
                                    onChange={(value) =>
                                      handlePermissionChange(feature.id, subFeature.id, "isEdit", value)
                                    }
                                    label="Edit"
                                  />
                                  <PermissionToggle
                                    checked={subFeature.isDelete || false}
                                    onChange={(value) =>
                                      handlePermissionChange(feature.id, subFeature.id, "isDelete", value)
                                    }
                                    label="Delete"
                                  />
                                  <PermissionToggle
                                    checked={subFeature.isExport || false}
                                    onChange={(value) =>
                                      handlePermissionChange(feature.id, subFeature.id, "isExport", value)
                                    }
                                    label="Export"
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

