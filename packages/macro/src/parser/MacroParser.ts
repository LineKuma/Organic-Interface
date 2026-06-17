/**
 * Macro Expression Parser
 *
 * Parses macro expressions from text using the syntax:
 *   {{type:arg1:arg2:...}}
 *
 * Supports escaping via \\{\\{ and \\}\\} to avoid parsing.
 */

import type { MacroExpression, MacroType } from '../types/macro.js';

/** Known macro types */
const VALID_MACRO_TYPES: Set<string> = new Set<MacroType>(['system', 'file', 'env', 'history']);

/** Regex to match macro expressions */
const MACRO_REGEX = /\{\{(\w+)((?::[^}]*)*)\}\}/g;

/** Regex to match escaped macros that should be left alone */
const ESCAPED_REGEX = /\\\{\{/g;

/**
 * Parse a single macro expression from a match
 */
function parseMacroMatch(match: RegExpExecArray, _fullText: string): MacroExpression | null {
  const raw = match[0];
  const type = match[1].toLowerCase() as MacroType;
  const argsStr = match[2]; // e.g., ":arg1:arg2:arg3"

  // Validate type
  if (!VALID_MACRO_TYPES.has(type)) {
    return {
      type,
      raw,
      args: [],
      start: match.index,
      end: match.index + raw.length,
    };
  }

  // Parse arguments (split by :, skip the first empty element)
  const args = argsStr ? argsStr.split(':').filter(a => a !== '') : [];

  return {
    type,
    raw,
    args,
    start: match.index,
    end: match.index + raw.length,
  };
}

/**
 * Parse all macro expressions from a text
 *
 * @param text - The text to parse macros from
 * @returns Array of parsed macro expressions
 */
export function parseMacros(text: string): MacroExpression[] {
  const macros: MacroExpression[] = [];
  const regex = new RegExp(MACRO_REGEX.source, 'g');

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    // Check if this macro is escaped (preceded by \)
    if (match.index > 0 && text[match.index - 1] === '\\') {
      continue; // Skip escaped macros
    }

    const macro = parseMacroMatch(match, text);
    if (macro) {
      macros.push(macro);
    }
  }

  return macros;
}

/**
 * Check if a text contains any macro expressions
 *
 * @param text - The text to check
 * @returns Whether the text contains macros
 */
export function hasMacros(text: string): boolean {
  const macros = parseMacros(text);
  return macros.length > 0;
}

/**
 * Count the number of macro expressions in a text
 *
 * @param text - The text to count macros in
 * @returns Number of macro expressions
 */
export function countMacros(text: string): number {
  return parseMacros(text).length;
}

/**
 * Get the unique macro types used in a text
 *
 * @param text - The text to analyze
 * @returns Array of unique macro types
 */
export function getMacroTypes(text: string): MacroType[] {
  const types = new Set(parseMacros(text).map(m => m.type));
  return Array.from(types) as MacroType[];
}

/**
 * Validate that all macro expressions in a text use known types
 *
 * @param text - The text to validate
 * @returns Array of invalid macro expressions
 */
export function validateMacros(text: string): MacroExpression[] {
  return parseMacros(text).filter(m => !VALID_MACRO_TYPES.has(m.type));
}

/**
 * Escape macro expressions in a text so they are not parsed
 *
 * @param text - The text to escape macros in
 * @returns Text with macros escaped
 */
export function escapeMacros(text: string): string {
  return text.replace(MACRO_REGEX, '\\$&');
}

/**
 * Unescape previously escaped macro expressions
 *
 * @param text - The text to unescape macros in
 * @returns Text with unescaped macros
 */
export function unescapeMacros(text: string): string {
  return text.replace(ESCAPED_REGEX, '{{');
}
