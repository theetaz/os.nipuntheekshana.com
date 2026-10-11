import { useLayoutEffect, useRef } from 'react';
import { useAtomValue, useStore } from 'jotai';
import { reducedMotionAtom, snapPreviewAtom } from '../state/atoms';
import { animateSnapPreview, createFrameController, type FrameController } from './frame-controller';
import { getSnapPreviewOrigin } from './useWindowDrag';

export function SnapPreview({ zIndex = 1 }: { zIndex?: number }) {
  const store = useStore(); const preview = useAtomValue(snapPreviewAtom);
  const el = useRef<HTMLDivElement>(null); const frame = useRef<FrameController | null>(null);
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    if (preview) {
      if (!frame.current) frame.current = createFrameController(node, preview.rect);
      else frame.current.set(preview.rect);
      node.hidden = false; node.dataset.valid = String(preview.valid);
    }
    const controller = frame.current;
    if (!controller) { node.hidden = true; return; }
    const animation = animateSnapPreview(controller, !!preview, store.get(reducedMotionAtom), getSnapPreviewOrigin());
    let active = true;
    void Promise.resolve(animation).then(() => { if (active && !preview) node.hidden = true; });
    return () => { active = false; animation.cancel(); };
  }, [preview, store]);
  useLayoutEffect(() => () => { frame.current?.destroy(); frame.current = null; }, []);
  return <div ref={el} className="window-snap-preview" data-snap-preview={preview?.zone} aria-hidden="true" style={{ zIndex }} />;
}
