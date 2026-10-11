import { useAtomValue } from 'jotai';
import { announceAtom } from '../state/atoms';
export function LiveRegion() {
  const announcement = useAtomValue(announceAtom);
  return <><div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement.politeness === 'polite' && <span key={announcement.seq}>{announcement.text}</span>}</div>
    <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">{announcement.politeness === 'assertive' && <span key={announcement.seq}>{announcement.text}</span>}</div></>;
}
