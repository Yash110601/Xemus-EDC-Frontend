import { NextResponse } from "next/server"
import { compileRulesToCanonicalIR } from "@/lib/rule-engine/compiler"
import { RuleRuntime } from "@/lib/rule-engine/runtime"

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed")
}

/**
 * GET /api/rule-engine/parity-self-test
 * Lightweight regression checks for the canonical runtime + reducer (runs in Next bundler).
 */
export async function GET() {
  try {
    const { rules: compiledHide } = compileRulesToCanonicalIR([
      {
        id: "r_hide_1",
        category: "hide",
        ruleExpression: "true",
        targetField: "ctrl_a",
      },
    ])
    const rtHide = new RuleRuntime({ rules: compiledHide })
    const outHide = rtHide.evaluateFullScan({
      formValues: { ctrl_a: "" },
      trigger: "change",
      controlTypesById: new Map([["ctrl_a", "text"]]),
      evaluateExpression: () => true,
      evaluateCompute: () => null,
    })
    assert(outHide.fieldPatches.ctrl_a?.hidden === true, "hide patch")

    const { rules: compiledEn } = compileRulesToCanonicalIR([
      {
        id: "r_en_1",
        category: "enable",
        ruleExpression: "ctrl_x",
        targetField: "ctrl_y",
      },
    ])
    const rtEn = new RuleRuntime({ rules: compiledEn })
    const outEn = rtEn.evaluateFullScan({
      formValues: { ctrl_x: 1, ctrl_y: "" },
      trigger: "change",
      controlTypesById: new Map([
        ["ctrl_x", "text"],
        ["ctrl_y", "text"],
      ]),
      evaluateExpression: (rule, vals) => Boolean(vals?.ctrl_x),
      evaluateCompute: () => null,
    })
    assert(outEn.fieldPatches.ctrl_y?.readonly === false, "enable patch")

    return NextResponse.json({ ok: true, checks: ["hide", "enable"] })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    )
  }
}
