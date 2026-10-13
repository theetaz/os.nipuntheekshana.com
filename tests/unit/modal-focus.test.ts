import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firstFocusableWithin } from '../../src/os/lib/modal-focus';

const element = (options: { disabled?: boolean; hidden?: boolean; tabIndex?: number; visibility?: string } = {}) => ({
  tabIndex: options.tabIndex ?? 0,
  matches: () => !!options.disabled,
  closest: () => options.hidden ? {} : null,
  getClientRects: vi.fn(() => [{}]),
  visibility: options.visibility ?? 'visible',
}) as unknown as HTMLElement & { getClientRects: ReturnType<typeof vi.fn> };
const container = (elements: HTMLElement[]) => ({ querySelectorAll: () => elements }) as unknown as HTMLElement;
beforeEach(() => vi.stubGlobal('getComputedStyle', (node: { visibility: string }) => ({ visibility: node.visibility })));
afterEach(() => vi.unstubAllGlobals());

describe('bounded modal focus restoration', () => {
  it('returns the first eligible target without measuring the distant document', () => {
    const disabled = element({ disabled: true }), hidden = element({ hidden: true }), negative = element({ tabIndex: -1 });
    const first = element(), distant = element();
    distant.getClientRects.mockImplementation(() => { throw new Error('Unnecessary distant layout'); });
    expect(firstFocusableWithin(container([disabled, hidden, negative, first, ...Array.from({ length: 1000 }, () => distant)]))).toBe(first);
    for (const skipped of [disabled, hidden, negative, distant]) expect(skipped.getClientRects).not.toHaveBeenCalled();
  });
  it('applies preference filtering before measuring layout', () => {
    const skipped = element(), preferred = element();
    expect(firstFocusableWithin(container([skipped, preferred]), undefined, node => node === preferred)).toBe(preferred);
    expect(skipped.getClientRects).not.toHaveBeenCalled();
  });
  it('skips visibility-hidden targets and retains an empty fallback', () => {
    const hidden = element({ visibility: 'hidden' }), visible = element();
    expect(firstFocusableWithin(container([hidden, visible]))).toBe(visible);
    expect(firstFocusableWithin(container([hidden]))).toBeUndefined();
  });
});
