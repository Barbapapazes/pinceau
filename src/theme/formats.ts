import type { Dictionary, Options } from 'style-dictionary-esm'
import StyleDictionary from 'style-dictionary-esm'
import type { Schema } from 'untyped'
import type { ColorSchemeModes, PinceauMediaQueries } from '../types'
import { walkTokens } from '../utils/data'
import { astTypes, printAst } from '../utils/ast'
import { flattenTokens, objectPaths } from '../utils'
import { isSafeConstName } from '../utils/checks'
import { message } from '../utils/logger'
import { resolveThemeRule } from '../utils/css'

/**
 * Stringify utils from object
 */
const stringifyUtils = (value: Record<string, any>, definitions: any) => {
  const entries = Object.entries(value)
  return entries.reduce(
    (acc, [key, value]) => {
      // Check if util has valid key
      if (!isSafeConstName(key)) {
        message('UTIL_NAME_CONFLICT', [key])
        return acc
      }

      // If definitions enabled, use typed version
      if (definitions[`utils.${key}`]?.content) {
        acc += `export const ${key} = ${definitions[`utils.${key}`].content}\n\n`
        return acc
      }

      // Stringify from utils values instead
      if (typeof value === 'function') { acc += `export const ${key} = ${String(value)}\n\n` }
      else { acc += `export const ${key} = ${JSON.stringify(value, null, 4)}\n\n` }
      return acc
    },
    '',
  )
}

/**
 * Enhance tokens paths list
 */
const enhanceTokenPaths = (value = []) => {
  const tokensLiteralNodes = []

  value.forEach(([keyPath]) => {
    tokensLiteralNodes.push(
      astTypes.builders.tsLiteralType(astTypes.builders.stringLiteral(keyPath)),
    )
  })

  const ast = astTypes.builders.tsTypeAliasDeclaration(
    astTypes.builders.identifier('GeneratedPinceauPaths'),
    astTypes.builders.tsUnionType(tokensLiteralNodes),
  )

  return printAst(ast).code
}

/**
 * import theme from '#pinceau/theme'
 * import type { GeneratedPinceauTheme, GeneratedPinceauPaths } from '#pinceau/theme'
 */
export function tsFull(tokensObject: any) {
  // Import config wrapper type
  let result = ''

  // Flatten tokens in full format too
  const flattenedTokens = flattenTokens(tokensObject)

  if (Object.keys(flattenedTokens).length) { result += `export const theme = ${JSON.stringify(flattenedTokens, null, 2)} as const\n\n` }
  else { result += 'export const theme = undefined\n\n' }

  // Theme type
  result += 'export type GeneratedPinceauTheme = typeof theme\n\n'

  // Tokens paths type
  const tokensPaths = objectPaths(tokensObject)
  if (tokensPaths.length) { result += `export ${enhanceTokenPaths(tokensPaths)}\n\n` }
  else { result += 'export type GeneratedPinceauPaths = undefined\n\n' }

  // Default export
  result += 'export default theme'

  return result
}

/**
 * import 'pinceau.css'
 */
export const cssFull = (dictionary: Dictionary, options: Options, responsiveTokens: any, colorSchemeMode: ColorSchemeModes) => {
  const { formattedVariables } = StyleDictionary.formatHelpers

  // Create :root tokens list
  const tokens: any = {
    initial: [],
  }
  walkTokens(
    dictionary.tokens,
    (token) => {
      // Handle responsive tokens
      if (typeof token?.value === 'object' && token?.value?.initial) {
        Object.entries(token.value).forEach(([media, value]) => {
          if (!tokens[media]) { tokens[media] = [] }

          tokens[media].push({
            ...token,
            attributes: {
              ...(token?.attributes || {}),
              media,
            },
            value,
          })
        })

        return token
      }

      // Handle regular tokens
      tokens.initial.push(token)

      return token
    },
  )

  let css = ''

  // Create all responsive tokens rules
  Object.entries(tokens).forEach(
    ([key, value]: [PinceauMediaQueries, string]) => {
      // Resolve tokens content
      const formattedContent = formattedVariables({ format: 'css', dictionary: { ...dictionary, allTokens: value } as any, outputReferences: true, formatting: { lineSeparator: '', indentation: '', prefix: '' } as any })
      css += resolveThemeRule(key, formattedContent, dictionary.tokens, colorSchemeMode)
    },
  )

  return css.replace(/(\n|\s\s)/g, '')
}

/**
 * definitions.ts
 */
export const definitionsFull = (definitions: any) => {
  return `export const definitions = ${JSON.stringify(definitions, null, 2)} as const`
}

/**
 * Nuxt Studio schema support
 */
export function schemaFull(schema: Schema) {
  let result = `export const schema = ${JSON.stringify({ properties: schema?.properties?.tokensConfig || {}, default: (schema?.default as any)?.tokensConfig || {} }, null, 2)} as const\n\n`

  result += 'export const GeneratedPinceauThemeSchema = typeof schema\n\n'

  return result
}

/**
 * import utils from '#pinceau/utils'
 */
export const utilsFull = (utils = {}, utilsImports = [], definitions = {}) => {
  let result = 'import { PinceauTheme, PropertyValue } from \'pinceau\'\n'

  // Add utilsImports from config
  result += utilsImports.filter(Boolean).join('\n')

  // Stringify utils properties
  result += `\n${stringifyUtils(utils, definitions)}`

  result += `export const utils = ${Object.keys(utils).length ? `{ ${Object.keys(utils).join(', ')} }` : 'undefined'}\n\n`

  // Type of utils
  result += 'export type GeneratedPinceauUtils = typeof utils\n\n'

  // Default export
  result += 'export default utils'

  return result
}
