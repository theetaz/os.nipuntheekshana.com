import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { ISLAND_PATH, ISLAND_VIEWBOX } from '../icons/island-glyph';

export const IslandMenu = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function IslandMenu(props, ref) {
  return <button {...props} ref={ref} type="button" role="menuitem" aria-label="Island menu" title="Island menu"
    aria-haspopup="menu" className="mb-trigger"><svg width="11" height="18" viewBox={ISLAND_VIEWBOX} aria-hidden="true">
      <path d={ISLAND_PATH} fill="currentColor" /></svg></button>;
});
