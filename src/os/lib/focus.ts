/** Pure wraparound calculation shared with roving controls. */
export function nextFocusIndex(index: number, direction: 1 | -1, length: number): number {
  if (length <= 0) return -1;
  if (index < 0) return direction === 1 ? 0 : length - 1;
  return ((index + direction) % length + length) % length;
}
export function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"], summary',
  )).filter(element => element.tabIndex >= 0 && !element.matches(':disabled')
    && !element.closest('[inert], [hidden], [aria-hidden="true"]')
    && element.getClientRects().length > 0
    && getComputedStyle(element).visibility !== 'hidden');
}
export function trapTab(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>, container: HTMLElement): void {
  if (event.key !== 'Tab') return;
  const items = focusableWithin(container);
  const active = container.ownerDocument.activeElement;
  const index = items.findIndex(item => item === active);
  if (!items.length) { event.preventDefault(); container.focus(); return; }
  if (index === -1 || (event.shiftKey ? index === 0 : index === items.length - 1)) {
    event.preventDefault(); items[event.shiftKey ? items.length - 1 : 0]?.focus();
  }
}
