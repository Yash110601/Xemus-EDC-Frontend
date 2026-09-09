import { createCanonicalRule, RULE_ACTION_TYPES, RULE_SCOPE_TYPES } from "./contracts"
import { isDateRestrictionRule, normalizeRuleCategory } from "@/components/crf-designer/ruleEvaluator"
import { defaultTierForRuleMode, normalizeRuleTier } from "./tiering"

const FIELD_ID_TOKEN_REGEX = /\bctrl_[A-Za-z0-9_]+\b/g

function mapCategoryToActionType(category) {
  switch (category) {
    case "show":
    case "hide":
      return RULE_ACTION_TYPES.VISIBILITY
    case "enable":
    case "disable":
      return RULE_ACTION_TYPES.READONLY
    case "validation":
      return RULE_ACTION_TYPES.VALIDATION
    case "compute":
      return RULE_ACTION_TYPES.COMPUTE
    case "submit":
    case "retro":
      return RULE_ACTION_TYPES.SUBMIT_GUARD
    case "date_restriction":
      return RULE_ACTION_TYPES.DATE_BOUND
    default:
      return RULE_ACTION_TYPES.SIDE_EFFECT
  }
}

function mapCategoryToMode(category) {
  switch (category) {
    case "show":
    case "hide":
    case "enable":
    case "disable":
    case "validation":
    case "compute":
    case "submit":
    case "retro":
    case "date_restriction":
      return category
    default:
      return "unknown"
  }
}

function parseTargetDescriptor(rawTarget) {
  const value = String(rawTarget || "").trim()
  if (!value) {
    return {
      scope: RULE_SCOPE_TYPES.FIELD,
      fieldId: null,
      tableId: null,
      row: null,
      col: null,
    }
  }

  const tableCellMatch = value.match(/^(.*)_row_(\d+)_col_(\d+)$/)
  if (tableCellMatch) {
    return {
      scope: RULE_SCOPE_TYPES.TABLE_CELL,
      fieldId: value,
      tableId: tableCellMatch[1],
      row: Number(tableCellMatch[2]),
      col: Number(tableCellMatch[3]),
    }
  }

  return {
    scope: RULE_SCOPE_TYPES.FIELD,
    fieldId: value,
    tableId: null,
    row: null,
    col: null,
  }
}

function getRuleTargets(rule) {
  if (Array.isArray(rule?.targetFields) && rule.targetFields.length > 0) {
    return rule.targetFields
      .map((t) => parseTargetDescriptor(t))
      .filter((t) => Boolean(t.fieldId))
  }
  if (rule?.targetField) {
    return String(rule.targetField)
      .split(",")
      .map((v) => parseTargetDescriptor(v))
      .filter((t) => Boolean(t.fieldId))
  }
  return []
}

function extractDependencies(expression) {
  const matches = String(expression || "").match(FIELD_ID_TOKEN_REGEX) || []
  return [...new Set(matches)]
}

/**
 * Compile UI/backend CRF rules into canonical engine objects.
 * This is intentionally non-destructive and backward-compatible:
 * it preserves original expression/action values for phased rollout.
 *
 * @param {Array<Object>} rules
 * @returns {{ rules: Array<Object>, diagnostics: Array<Object> }}
 */
export function compileRulesToCanonicalIR(rules = []) {
  const diagnostics = []
  const compiledRules = []

  rules.forEach((rule, index) => {
    try {
      const normalizedCategory = normalizeRuleCategory(
        rule?.category ?? rule?.ruleCategory ?? rule?.Category
      )
      const category = isDateRestrictionRule(rule) ? "date_restriction" : normalizedCategory
      const expression = String(rule?.expression ?? rule?.ruleExpression ?? "")
      const targets = getRuleTargets(rule)

      if (!expression.trim()) {
        diagnostics.push({
          level: "warn",
          code: "RULE_EMPTY_EXPRESSION",
          ruleId: rule?.id ?? null,
          index,
          message: "Rule expression is empty.",
        })
      }

      const compiled = createCanonicalRule({
        id: rule?.id ?? `rule_${index}`,
        version: 1,
        name: rule?.ruleName || rule?.name || `Rule ${index + 1}`,
        priority: Number(rule?.priority ?? index),
        enabled: rule?.isActive !== false,
        sourceCategory: category || "unknown",
        conditionExpression: expression,
        dependencies: extractDependencies(expression),
        targets,
        action: {
          type: mapCategoryToActionType(category),
          payload: {
            mode: mapCategoryToMode(category),
            category,
            rawCategory: rule?.category ?? rule?.ruleCategory ?? rule?.Category ?? "",
            message: rule?.message || "",
            tier: normalizeRuleTier(
              rule?.tier ?? rule?.ruleTier,
              defaultTierForRuleMode(mapCategoryToMode(category))
            ),
          },
        },
        message: rule?.message || "",
        severity: rule?.severity || "SOFT",
      })
      compiled.__compileOrder = index

      compiledRules.push(compiled)
    } catch (error) {
      diagnostics.push({
        level: "error",
        code: "RULE_COMPILE_FAILED",
        ruleId: rule?.id ?? null,
        index,
        message: error?.message || "Failed to compile rule.",
      })
    }
  })

  return {
    rules: compiledRules,
    diagnostics,
  }
}
