import { useAtomValue } from 'jotai';
import { focusedIdAtom } from '../state/atoms';
import type { DesktopProps } from '../Desktop';
import { HomeScreen } from './HomeScreen';
import { AppSheet } from './AppSheet';
import { Dock } from '../shell/Dock';
import { MenuBar } from '../shell/MenuBar';
export function PhoneShell(props: DesktopProps) {
  const focused = useAtomValue(focusedIdAtom);
  return focused ? <AppSheet windowId={focused} /> : <><MenuBar home={props.home} build={props.build} /><HomeScreen home={props.home} /><Dock mode="mobile" /></>;
}
