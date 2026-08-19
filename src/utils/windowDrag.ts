import { getCurrentWindow } from '@tauri-apps/api/window';

const INTERACTIVE_TAGS = new Set([
  'BUTTON',
  'INPUT',
  'SELECT',
  'TEXTAREA',
  'CANVAS',
  'A',
  'OPTION',
  'LABEL',
]);

function getWindow() {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

export function isInteractiveTarget(target: EventTarget | null): boolean {
  let el = target as HTMLElement | null;
  while (el) {
    if (el.dataset?.noDrag === 'true') return true;
    if (INTERACTIVE_TAGS.has(el.tagName)) return true;
    if (el.isContentEditable) return true;
    el = el.parentElement;
  }
  return false;
}

export function startWindowDrag(e: React.MouseEvent): void {
  if (isInteractiveTarget(e.target)) return;
  e.preventDefault();
  getWindow()?.startDragging();
}
