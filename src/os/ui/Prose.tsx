import { forwardRef, type HTMLAttributes, type MouseEvent } from 'react';
import '../../styles/prose.css';
export interface ProseProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'dangerouslySetInnerHTML'> {
  /** Only trusted build-time HTML. Never pass visitor input. */
  html: string; size?: 15 | 17 | 19;
  /** Return true to prevent browser navigation. Modified clicks retain native behavior. */
  onLinkClick?: (url: URL, event: MouseEvent<HTMLDivElement>) => boolean | void;
}
export const Prose = forwardRef<HTMLDivElement, ProseProps>(function Prose({ html, size = 17, className = '', onLinkClick, onClick, ...props }, ref) {
  return <div {...props} ref={ref} data-size={size} className={`prose ${className}`} dangerouslySetInnerHTML={{ __html: html }}
    onClick={event => {
      onClick?.(event);
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !onLinkClick) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!anchor || !event.currentTarget.contains(anchor) || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
      const url = new URL(anchor.href);
      if (url.origin === window.location.origin && onLinkClick(url, event) === true) event.preventDefault();
    }} />;
});
