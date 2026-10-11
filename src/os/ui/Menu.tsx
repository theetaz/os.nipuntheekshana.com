import { forwardRef, useEffect, useImperativeHandle, useId, useRef, useState, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import type { MenuItemSpec } from '../types/apps';
import { nextFocusIndex } from '../lib/focus';
import { isMac } from '../lib/platform';
import { MenuItem, shortcutLabel } from './MenuItem';
import { panelMaterial, reducedMotion, useFloatingPanel, useOverlayHost, useOverlayPresence, type Anchor } from './Overlay';
export interface MenuItemState { disabled?: boolean; checked?: boolean }
export interface MenuProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  items: readonly MenuItemSpec[]; open?: boolean; label: string;
  onCommand: (command: string) => void; onClose: () => void;
  anchorRef?: Anchor; point?: { x: number; y: number }; autoFocus?: boolean;
  getItemState?: (command: string) => MenuItemState;
  /** Resolve the dynamic window-list placeholder without coupling the UI to the store. */
  windowItems?: readonly MenuItemSpec[];
}
interface LevelProps extends MenuProps { nested?: boolean; onBack?: () => void; treeId?: string }
const MenuLevel = forwardRef<HTMLDivElement, LevelProps>(function RenderMenuLevel(
  { items, open = true, label, onCommand, onClose, anchorRef, point, autoFocus = true,
    getItemState, windowItems = [], nested, onBack, treeId, className = '', style, onKeyDown, ...props }, forwarded,
) {
  const id = useId();
  const rootId = treeId ?? id; const host = useOverlayHost();
  const panel = useRef<HTMLDivElement>(null); const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const submenuAnchor = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState(-1); const [submenu, setSubmenu] = useState(-1);
  const [keyboardSubmenu, setKeyboardSubmenu] = useState(false); const [mac, setMac] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const typeahead = useRef({ text: '', at: 0 });
  const expanded = items.flatMap(item => item.kind === 'windows' ? [...windowItems] : [item]);
  const enabled = expanded.map((item, i) => item.kind === 'separator' || item.kind === 'windows'
    || (item.kind === 'item' && getItemState?.(item.command).disabled) ? -1 : i).filter(i => i >= 0);
  const present = useOverlayPresence(open, panel, 0.12, host);
  useImperativeHandle(forwarded, () => panel.current!, [present, host]);
  const position = useFloatingPanel(panel, present, anchorRef, nested ? 'right' : 'bottom', point, nested ? 0 : 4, host);
  const callback = useRef({ onClose, onCommand }); callback.current = { onClose, onCommand };
  useEffect(() => { setMac(isMac()); return () => { clearTimeout(hoverTimer.current); clearTimeout(activationTimer.current); }; }, []);
  useEffect(() => {
    typeahead.current = { text: '', at: 0 };
    if (!open) { clearTimeout(hoverTimer.current); setSubmenu(-1); setActive(-1); return; }
    if (present && autoFocus) {
      const first = buttons.current.findIndex(button => button && !button.disabled);
      setActive(first); if (first >= 0) buttons.current[first]?.focus(); else panel.current?.focus();
    }
  }, [open, present, autoFocus, host]);
  useEffect(() => {
    if (nested || !open || !present || !panel.current) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !(event.target instanceof Element && event.target.closest(`[data-menu-tree="${CSS.escape(rootId)}"]`)) && !anchorRef?.current?.contains(event.target)) callback.current.onClose();
    };
    const blur = () => callback.current.onClose();
    document.addEventListener('pointerdown', outside); window.addEventListener('blur', blur);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('blur', blur); };
  }, [open, present, nested, anchorRef, rootId, host]);
  const focus = (index: number) => { setActive(index); buttons.current[index]?.focus(); };
  const openSubmenu = (index: number, keyboard: boolean) => {
    clearTimeout(hoverTimer.current); submenuAnchor.current = buttons.current[index] ?? null;
    setKeyboardSubmenu(keyboard); setSubmenu(index);
  };
  const activate = (index: number) => {
    const item = expanded[index]; if (!item || !enabled.includes(index)) return;
    if (item.kind === 'submenu') { openSubmenu(index, true); return; }
    if (item.kind !== 'item' || activationTimer.current !== undefined) return;
    const invoke = () => { activationTimer.current = undefined; callback.current.onClose(); callback.current.onCommand(item.command); };
    if (reducedMotion()) invoke();
    else { setActive(-1); activationTimer.current = setTimeout(invoke, 60); }
  };
  if (!present) return null;
  const child = expanded[submenu];
  const content = <div {...props} ref={panel} data-menu-tree={rootId} role="menu" aria-label={label} tabIndex={-1} inert={!open}
    className={`${panelMaterial} p-[5px] ${className}`}
    style={{ ...position, zIndex: 'var(--z-menus)', minWidth: 'min(220px, calc(100vw - 16px))', maxWidth: 'min(320px, calc(100vw - 16px))', maxHeight: 'calc(100dvh - 16px)', overflowY: 'auto', ...style }}
    onKeyDown={event => {
      onKeyDown?.(event); if (event.defaultPrevented) return;
      event.stopPropagation();
      const key = event.key;
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
        event.preventDefault(); clearTimeout(hoverTimer.current); setSubmenu(-1);
        const index = key === 'Home' ? enabled[0] : key === 'End' ? enabled.at(-1)
          : enabled[nextFocusIndex(enabled.indexOf(active), key === 'ArrowUp' ? -1 : 1, enabled.length)];
        if (index !== undefined) focus(index);
      } else if (key === 'ArrowRight') { event.preventDefault(); if (expanded[active]?.kind === 'submenu') openSubmenu(active, true); }
      else if (key === 'ArrowLeft' && nested) { event.preventDefault(); onBack?.(); }
      else if (key === 'Escape') {
        event.preventDefault();
        if (nested) onBack?.(); else { callback.current.onClose(); anchorRef?.current?.focus(); }
      } else if (key === 'Tab') { callback.current.onClose(); anchorRef?.current?.focus(); }
      else if (key === 'Enter' || key === ' ') { event.preventDefault(); activate(active); }
      else if (key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        const now = Date.now();
        const previous = now - typeahead.current.at < 700 ? typeahead.current.text : '';
        const text = previous + key.toLocaleLowerCase(); typeahead.current = { text, at: now };
        const query = Array.from(text).every(letter => letter === text[0]) ? text[0]! : text;
        const ordered = enabled.slice(enabled.indexOf(active) + 1).concat(enabled.slice(0, enabled.indexOf(active) + 1));
        const index = ordered.find(i => { const item = expanded[i]; return item && 'label' in item && item.label.toLocaleLowerCase().startsWith(query); });
        if (index !== undefined) { setSubmenu(-1); focus(index); }
      }
    }}>
    {expanded.map((item, index) => item.kind === 'separator' ? <div key={index} role="separator" className="mx-2.5 my-[5px] h-px bg-line" />
      : item.kind === 'windows' ? null : <MenuItem key={index} ref={node => { buttons.current[index] = node; }}
        kind={item.kind === 'item' ? item.role : 'item'}
        checked={item.kind === 'item' ? getItemState?.(item.command).checked : undefined}
        disabled={item.kind === 'item' && getItemState?.(item.command).disabled}
        highlighted={active === index} tabIndex={active === index || (active < 0 && index === enabled[0]) ? 0 : -1}
        shortcut={item.kind === 'item' && item.shortcut ? shortcutLabel(item.shortcut, mac) : undefined}
        aria-controls={item.kind === 'submenu' && submenu === index ? `${id}-submenu` : undefined}
        submenu={item.kind === 'submenu'} aria-expanded={item.kind === 'submenu' ? submenu === index : undefined}
        onFocus={event => { if (event.target === event.currentTarget) setActive(index); }}
        onPointerEnter={() => {
          if (!enabled.includes(index)) return;
          clearTimeout(hoverTimer.current); setActive(index);
          if (item.kind === 'submenu') hoverTimer.current = setTimeout(() => openSubmenu(index, false), 120);
          else setSubmenu(-1);
        }} onClick={() => activate(index)}>{item.label}</MenuItem>)}
    {child?.kind === 'submenu' && <MenuLevel id={`${id}-submenu`} items={child.items} treeId={rootId} nested label={child.label} anchorRef={submenuAnchor}
      onClose={onClose} onCommand={onCommand} getItemState={getItemState} windowItems={windowItems} autoFocus={keyboardSubmenu}
      onBack={() => { setSubmenu(-1); focus(submenu); }} />}
  </div>;
  return host ? createPortal(content, host) : content;
});
export const Menu = forwardRef<HTMLDivElement, MenuProps>(function Menu(props, ref) { return <MenuLevel {...props} ref={ref} />; });
