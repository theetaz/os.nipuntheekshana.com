import { useEffect, useState, type ReactNode } from 'react';
import { useAtomValue } from 'jotai';
import { modeAtom } from '../state/atoms';

export const MODE_QUERY = '(max-width: 1023px), (pointer: coarse) and (max-width: 1179px)';
export function ModeSwitch({ desktop, mobile }: { desktop: ReactNode; mobile: ReactNode }) {
  const mode = useAtomValue(modeAtom); const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return <>{(!hydrated || mode === 'desktop') && <div className="island-desktop os-chrome" data-shell="desktop">{desktop}</div>}
    {(!hydrated || mode === 'mobile') && <div className="island-mobile os-chrome" data-shell="mobile">{mobile}</div>}</>;
}
