import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { BRAND_BLADE_PATH, BRAND_VIEWBOX } from '../icons/brand-glyph';

export const IslandMenu = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function IslandMenu(props, ref) {
  return <button {...props} ref={ref} type="button" role="menuitem" aria-label="Kottu menu" title="Kottu menu"
    aria-haspopup="menu" className="mb-trigger mb-brand"><svg width="18" height="18" viewBox={BRAND_VIEWBOX} aria-hidden="true">
      <g stroke="var(--k-ink)" strokeWidth="2" strokeLinejoin="round"><path d={BRAND_BLADE_PATH} transform="rotate(45 32 32)" fill="#FFFDF8" />
        <path d={BRAND_BLADE_PATH} transform="rotate(-45 32 32)" fill="var(--k-red)" /></g></svg><span>kottu</span></button>;
});
