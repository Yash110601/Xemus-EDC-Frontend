"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { rolesService } from "@/lib/services"
import { Loader2, UserPlus } from "lucide-react"

const NAME_MAX = 100
const DESC_MAX = 500

const fieldClass =
  "rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm outline-none transition focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400/25"

/**
 * @param {{ open: boolean, onOpenChange: (open: boolean) => void, onCreated?: (role: object) => void }} props
 */
export default function CreateRoleDialog({ open, onOpenChange, onCreated }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) {
      setName("")
      setDescription("")
      setError("")
      setSaving(false)
    }
  }, [open])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Role name is required.")
      return
    }
    if (trimmedName.length > NAME_MAX) {
      setError(`Role name must be at most ${NAME_MAX} characters.`)
      return
    }
    if (description.trim().length > DESC_MAX) {
      setError(`Description must be at most ${DESC_MAX} characters.`)
      return
    }

    setSaving(true)
    setError("")
    try {
      const res = await rolesService.createRole({
        name: trimmedName,
        description: description.trim(),
      })

      if (res?.isSuccess && res.data) {
        onCreated?.(res.data)
        onOpenChange(false)
        return
      }

      setError(res?.message || "Could not create role.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[250] bg-slate-900/75 backdrop-blur-md"
        className="z-[250] max-w-md rounded-2xl border border-slate-200 bg-white sm:max-w-md shadow-2xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-emerald-600" />
            Add role
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            New roles are created only from this screen. The role is saved on the server and appears as a new
            column when a study is selected.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-role-name">Role name</Label>
            <Input
              id="create-role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Data Manager"
              maxLength={NAME_MAX}
              disabled={saving}
              className={fieldClass}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-role-description">Description (optional)</Label>
            <textarea
              id="create-role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description for admins"
              maxLength={DESC_MAX}
              disabled={saving}
              rows={3}
              className={`${fieldClass} flex min-h-[88px] w-full resize-y py-2.5`}
            />
          </div>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Create role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
