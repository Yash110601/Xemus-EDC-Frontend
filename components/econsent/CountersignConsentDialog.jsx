"use client"

import { useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import eConsentService from "@/lib/services/eConsent.service"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

function MiniSignaturePad({ onChange }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    ctx.strokeStyle = "#0f172a"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
  }, [])

  const pos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const start = (e) => {
    drawing.current = true
    const ctx = canvasRef.current.getContext("2d")
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  const move = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext("2d")
    const p = pos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  const end = () => {
    drawing.current = false
    onChange?.(canvasRef.current.toDataURL("image/png"))
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange?.("")
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={420}
        height={120}
        className="w-full max-w-full rounded-md border border-slate-200 bg-white touch-none"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <button type="button" className="mt-2 text-xs text-slate-600 hover:underline" onClick={clear}>
        Clear signature
      </button>
    </div>
  )
}

export default function CountersignConsentDialog({ open, onOpenChange, subjectConsentId, onDone }) {
  const [signerName, setSignerName] = useState("")
  const [acknowledged, setAcknowledged] = useState(false)
  const [signatureData, setSignatureData] = useState("")
  const [signatureMeaning, setSignatureMeaning] = useState(
    "I have reviewed this informed consent packet and countersign as investigator.",
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setSignerName("")
      setAcknowledged(false)
      setSignatureData("")
      setSignatureMeaning("I have reviewed this informed consent packet and countersign as investigator.")
    }
  }, [open])

  const handleSubmit = async () => {
    if (!acknowledged || !signerName.trim()) {
      toast.error("Name and acknowledgment are required")
      return
    }
    setSaving(true)
    try {
      const res = await eConsentService.countersign(subjectConsentId, {
        signerName: signerName.trim(),
        signatureData: signatureData || null,
        signatureMeaning: signatureMeaning || null,
        acknowledged: true,
      })
      if (res?.isSuccess) {
        toast.success("Investigator countersignature recorded")
        onOpenChange(false)
        await onDone?.()
      } else toast.error(res?.message || "Countersign failed")
    } catch {
      toast.error("Countersign failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-black/70 backdrop-blur-md"
        className="max-w-md rounded-2xl border-slate-200 bg-white opacity-100 sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="text-slate-900">Investigator countersign</DialogTitle>
          <DialogDescription className="text-slate-600">
            Confirm you have reviewed the signed consent packet for this subject.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex items-start gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="mt-1"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <span>I have reviewed this consent and countersign as investigator.</span>
          </label>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Full legal name
            </label>
            <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Investigator name" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Signature meaning (intent)
            </label>
            <textarea
              className="min-h-[64px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              value={signatureMeaning}
              onChange={(e) => setSignatureMeaning(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Signature
            </label>
            <MiniSignaturePad onChange={setSignatureData} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-800"
            disabled={saving || !acknowledged || !signerName.trim()}
            onClick={handleSubmit}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Countersign
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
