import { useRef } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { contextMenuAtom, desktopAtom, menuStateAtom, mochiPrefsAtom } from '../state/atoms';
import { runCommand } from '../wm/commands';
import { Menu } from '../ui/Menu';
import './p2-8-overlays.css';

export function ContextMenuHost() {
  const [spec, setSpec] = useAtom(contextMenuAtom); const previous = useRef<HTMLElement | null>(null);
  const last = useRef(spec);
  const retained = useRef(spec);
  const desktop = useAtomValue(desktopAtom); const state = useAtomValue(menuStateAtom);
  const mochi = useAtomValue(mochiPrefsAtom);
  if (spec && (last.current !== spec || !previous.current)) {
    previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  last.current = spec;
  if (spec) retained.current = spec;
  const menu = spec ?? retained.current;
  const close = () => { setSpec(null); if (previous.current?.isConnected) previous.current.focus({ preventScroll: true }); };
  if (!menu) return null;
  return <Menu key={menu.target} open={!!spec} items={menu.items} label={`${menu.target} context menu`} point={{ x: menu.x, y: menu.y }}
    onClose={close} onCommand={command => runCommand(command, 'menu')} getItemState={command => {
      if (command === 'desktop.mochi') return { checked: mochi.visible };
      return desktop.focusedId ? state[desktop.focusedId]?.[command] ?? {} : {};
    }} />;
}
