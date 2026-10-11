import { useAtomValue } from 'jotai';
import { modeAtom } from '../state/atoms';
import type { DesktopProps } from '../Desktop';
import { deferredComponent } from '../lib/deferred-component';
const phone = deferredComponent(() => import('./PhoneRuntime').then(module => module.PhoneRuntime));
/** The static phone home paints first. No mobile implementation enters desktop B1. */
export function PhoneShell(props: DesktopProps) {
  return useAtomValue(modeAtom) === 'mobile' ? <phone.Component {...props} /> : null;
}
