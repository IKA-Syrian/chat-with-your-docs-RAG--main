'use client';

import { useEffect } from 'react';

export interface Shortcut {
  /** A single key (e.g. "n"), a single character ("?"), or a code-style key like "ArrowRight" */
  key: string;
  /** Require ctrl/cmd modifier */
  ctrl?: boolean;
  /** Require shift modifier */
  shift?: boolean;
  /** Require alt modifier */
  alt?: boolean;
  /** Run handler even when an input/textarea is focused. Default: false */
  allowInInput?: boolean;
  /** Human-readable description (used by the shortcut overlay) */
  description: string;
  /** Handler */
  handler: (event: KeyboardEvent) => void;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
};

const matchKey = (event: KeyboardEvent, shortcut: Shortcut): boolean => {
  if (!!shortcut.ctrl !== (event.ctrlKey || event.metaKey)) return false;
  if (!!shortcut.shift !== event.shiftKey) return false;
  if (!!shortcut.alt !== event.altKey) return false;

  const k = shortcut.key;
  // Exact match on event.key (case-insensitive for letters, exact for special keys like "ArrowRight")
  if (k.length === 1) return event.key.toLowerCase() === k.toLowerCase();
  return event.key === k;
};

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const editable = isEditableTarget(event.target);
      for (const sc of shortcuts) {
        if (editable && !sc.allowInInput) continue;
        if (matchKey(event, sc)) {
          event.preventDefault();
          sc.handler(event);
          return;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcuts, enabled]);
}

/** Tiny helper: format a shortcut for display in a help overlay. */
export function formatShortcut(sc: Shortcut): string {
  const parts: string[] = [];
  if (sc.ctrl) parts.push(navigator.platform?.toLowerCase().includes('mac') ? '⌘' : 'Ctrl');
  if (sc.shift) parts.push('Shift');
  if (sc.alt) parts.push('Alt');
  parts.push(sc.key === ' ' ? 'Space' : sc.key.length === 1 ? sc.key.toUpperCase() : sc.key);
  return parts.join(' + ');
}
