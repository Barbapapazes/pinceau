import { kebabCase } from 'scule'
import type { ComputedRef } from 'vue'
import { onScopeDispose, unref, watch } from 'vue'
import type { PinceauRuntimeIds } from '../../types'
import type { PinceauRuntimeSheet } from './stylesheet'

export function usePinceauComputedStyles(
  ids: ComputedRef<PinceauRuntimeIds>,
  computedStyles: { [key: string]: ComputedRef },
  sheet: PinceauRuntimeSheet,
  loc: any,
) {
  let rule: CSSRule = sheet.hydratableRules?.[ids.value.uid]?.c

  watch(
    () => computedStyles,
    (newComputedStyles) => {
      newComputedStyles = computedStylesToDeclaration(ids.value, newComputedStyles)
      rule = sheet.pushDeclaration(
        ids.value.uid,
        'c',
        newComputedStyles,
        rule,
        { ...loc, type: 'c' },
      )
    },
    {
      immediate: !(rule),
      deep: true,
    },
  )

  onScopeDispose(() => rule && sheet.deleteRule(rule))
}

/**
 * Transform computed styles and props to a stringifiable object.
 */
export function computedStylesToDeclaration(
  ids: PinceauRuntimeIds,
  computedStyles: { [id: string]: any },
) {
  const declaration = {}

  const targetId = `.${ids.uniqueClassName}${ids.componentId}`

  // Iterate through computed styles
  if (computedStyles && Object.keys(computedStyles).length) {
    declaration[targetId] = declaration[targetId] || {}

    // Iterate on each computed styles
    for (const [varName, _value] of Object.entries(computedStyles)) {
      const value = unref(_value)

      // Handle CSS Prop
      if (varName === 'css') {
        declaration[targetId] = Object.assign(declaration[targetId], value)
        continue
      }

      // Prop value is an object, iterate through each `@mq`
      if (typeof value === 'object') {
        for (const [mqId, mqPropValue] of Object.entries(value)) {
          const _value = unref(mqPropValue) as string

          if (!_value) { continue }

          if (mqId === 'initial') {
            if (!declaration[targetId]) { declaration[targetId] = {} }
            if (!declaration[targetId]) { declaration[targetId] = {} }
            declaration[targetId][`--${varName}`] = _value
          }

          const mediaId = `@${mqId}`

          if (!declaration[mediaId]) { declaration[mediaId] = {} }
          if (!declaration[mediaId][targetId]) { declaration[mediaId][targetId] = {} }

          declaration[mediaId][targetId][`--${kebabCase(varName)}`] = _value
        }
      }
      else {
        const _value = unref(value)
        if (_value) {
          declaration[targetId][`--${kebabCase(varName)}`] = _value
        }
      }
    }
  }

  return declaration
}
