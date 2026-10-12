import { forwardRef, type ButtonHTMLAttributes } from 'react';

export const IslandMenu = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function IslandMenu(props, ref) {
  // TODO(K3): import brand-glyph
  return <button {...props} ref={ref} type="button" role="menuitem" aria-label="Kottu menu" title="Kottu menu"
    aria-haspopup="menu" className="mb-trigger mb-brand"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <g stroke="var(--k-ink)" strokeWidth="2" strokeLinejoin="round"><path d="M4 18L16 6l3 3L7 21z" fill="var(--k-paper)" />
        <path d="M20 18L8 6 5 9l12 12z" fill="var(--k-red)" /></g></svg><span>kottu</span></button>;
});
