import type { KeyClass } from '../types';

export function classifyKeyEvent(key: string, code: string): KeyClass {
  // Arrow navigation
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(key)) {
    return 'nav_arrow';
  }

  // Backspace & Delete
  if (['Backspace', 'Delete'].includes(key)) {
    return 'backspace_delete';
  }

  // Enter / Return
  if (key === 'Enter') {
    return 'enter';
  }

  // Modifiers
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(key)) {
    return 'modifier';
  }

  // Brackets, Parentheses, Quotes
  if (['(', ')', '[', ']', '{', '}', '"', "'", '`', '<', '>'].includes(key)) {
    return 'bracket_quote';
  }

  // Space & Indents
  if (key === ' ' || code === 'Space') {
    return 'whitespace';
  }

  // Alpha (Letters a-z, A-Z)
  if (/^[a-zA-Z]$/.test(key)) {
    return 'alpha';
  }

  // Numeric (0-9)
  if (/^[0-9]$/.test(key)) {
    return 'numeric';
  }

  // General punctuation & operators (=, +, -, *, /, ;, :, ., etc.)
  return 'punctuation';
}
