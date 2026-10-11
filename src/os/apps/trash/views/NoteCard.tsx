import { useId, useLayoutEffect, useRef } from 'react';
import { m } from 'motion/react';
import { useAtomValue } from 'jotai';
import { reducedMotionAtom } from '../../../state/atoms';
import { isolateModal } from '../../../lib/modal-focus';
import { trapTab } from '../../../lib/focus';
import { Button } from '../../../ui/Button';
import type { TrashItem } from '../items';
import { PaperIcon } from './PaperIcon';

export function NoteCard({ item, onClose }: { item: TrashItem; onClose: () => void }) {
  const titleId = useId();
  const bodyId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const reduce = useAtomValue(reducedMotionAtom);
  useLayoutEffect(() => {
    const node = panel.current;
    if (!node) return;
    return isolateModal(node, () => node.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }));
  }, []);
  return <div className="kooda-note-layer" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <m.div ref={panel} className="kooda-note-card" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}
      tabIndex={-1} initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduce ? 0.1 : 0.16 }} onKeyDown={event => {
        trapTab(event, event.currentTarget);
        if (event.key === 'Escape' || event.key === ' ') { event.preventDefault(); onClose(); }
        event.stopPropagation();
      }}>
      <PaperIcon />
      <h2 id={titleId}>{item.name}</h2>
      <p id={bodyId}>{item.note}</p>
      <Button variant="ghost" onClick={onClose}>Close note</Button>
    </m.div>
  </div>;
}
