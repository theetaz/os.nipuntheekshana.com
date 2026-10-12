import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { Download, Minus, PanelLeft, Plus, Printer } from 'lucide-react';
import type { ClientProfile } from '../../../types/content';
import { Button } from '../../../ui/Button';
import { IconButton } from '../../../ui/IconButton';
import { Toolbar } from '../../../ui/Toolbar';
import { CvPage, PAGE_GAP, PAGE_HEIGHT, PAGE_WIDTH } from './CvPage';
import { CvThumbnails } from './CvThumbnails';
import '../p3-4-cv.css';

/** `narrow` mirrors the 600 px `window` container query that fits pages and hides thumbnails. */
export interface CvViewerState { zoom: number; thumbnails: boolean; narrow: boolean }
export interface CvViewerHandle { command: (command: string) => boolean }
interface Props {
  profile: ClientProfile; interactive?: boolean; idPrefix?: string;
  scrollRootRef?: RefObject<HTMLElement | null>; onStateChange?: (state: CvViewerState) => void;
}

export const CvDocument = forwardRef<CvViewerHandle, Props>(function CvDocument({
  profile, interactive = false, idPrefix = 'cv-static', scrollRootRef, onStateChange,
}, ref) {
  const root = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const download = useRef<HTMLAnchorElement>(null);
  const [zoom, setZoom] = useState(1);
  const [thumbnails, setThumbnails] = useState(true);
  const [currentPage, setCurrentPage] = useState<1 | 2>(1);
  const [fit, setFit] = useState(false);
  // Narrow containers fit pages in CSS (static adoption included) until a
  // zoom is chosen explicitly; `pinned` hands the scale back to `zoom`.
  const [narrow, setNarrow] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [fitScale, setFitScale] = useState(1);
  const scale = narrow && !pinned ? fitScale : zoom;
  const changeZoom = useCallback((step: number) => {
    setFit(false); setPinned(true);
    setZoom(Math.max(.5, Math.min(2, Math.round(scale * 4 + step) / 4)));
  }, [scale]);
  const actualSize = useCallback(() => { setFit(false); setPinned(true); setZoom(1); }, []);
  const fitWidth = useCallback(() => { setFit(true); setPinned(false); }, []);
  const print = useCallback(() => {
    if (!root.current) return;
    root.current.dataset.cvPrintTarget = '';
    document.documentElement.dataset.printing = 'cv';
    window.print();
  }, []);
  useImperativeHandle(ref, () => ({ command(command) {
    switch (command) {
      case 'cv.zoomIn': changeZoom(1); break;
      case 'cv.zoomOut': changeZoom(-1); break;
      case 'cv.actualSize': actualSize(); break;
      case 'cv.fitWidth': fitWidth(); break;
      case 'cv.thumbnails': if (narrow) return false; setThumbnails(value => !value); break;
      case 'cv.print': print(); break;
      case 'cv.download': download.current?.click(); break;
      default: return false;
    }
    return true;
  } }), [actualSize, changeZoom, fitWidth, narrow, print]);
  useEffect(() => { onStateChange?.({ zoom: scale, thumbnails, narrow }); }, [scale, thumbnails, narrow, onStateChange]);
  useEffect(() => {
    const element = scroll.current;
    const viewer = root.current;
    if (!interactive || !element || !viewer) return;
    const resize = new ResizeObserver(() => {
      const style = getComputedStyle(element);
      const width = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const fitted = Math.min(2, Math.max(.1, width / PAGE_WIDTH));
      setNarrow(viewer.clientWidth <= 600);
      setFitScale(fitted);
      if (fit) setZoom(fitted);
    });
    resize.observe(element);
    resize.observe(viewer);
    return () => resize.disconnect();
  }, [fit, interactive, thumbnails]);
  useEffect(() => {
    const element = scroll.current;
    if (!interactive || !element) return;
    const pages = [...element.querySelectorAll<HTMLElement>('.cv-page')];
    let frame = 0;
    const update = () => {
      frame = 0;
      const viewport = element.getBoundingClientRect();
      const visible = pages.map(page => {
        const rect = page.getBoundingClientRect();
        return { page, height: Math.max(0, Math.min(rect.bottom, viewport.bottom) - Math.max(rect.top, viewport.top)) };
      }).sort((a, b) => b.height - a.height)[0];
      if (visible && visible.height > 0) setCurrentPage(visible.page.id.endsWith('-2') ? 2 : 1);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    // A thumbnail jump and its reversal can happen between observer samples.
    // Read both pages on the actual scroll frame instead of caching thresholds.
    element.addEventListener('scroll', schedule, { passive: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(element);
    schedule();
    return () => { cancelAnimationFrame(frame); element.removeEventListener('scroll', schedule); resize.disconnect(); };
  }, [interactive, scale]);
  useEffect(() => {
    if (!interactive) return;
    const before = () => {
      const element = root.current;
      if (!element || element.closest('[hidden], [inert]') || !element.getClientRects().length) return;
      element.dataset.cvPrintTarget = '';
      document.documentElement.dataset.printing = 'cv';
    };
    const after = () => {
      root.current?.removeAttribute('data-cv-print-target');
      if (document.documentElement.dataset.printing === 'cv') delete document.documentElement.dataset.printing;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); after(); };
  }, [interactive]);
  const goToPage = (page: 1 | 2) => {
    const element = scroll.current;
    const paper = element?.querySelector<HTMLElement>(`#${idPrefix}-page-${page}`);
    if (!element || !paper) return;
    element.scrollTop += paper.getBoundingClientRect().top - element.getBoundingClientRect().top - 24;
    setCurrentPage(page);
  };
  return <div ref={root} className="cv-viewer" data-zoomed={pinned || undefined} style={{ '--cv-scale': zoom } as CSSProperties}>
    <Toolbar label="CV document controls" className="cv-toolbar">
      <div className="cv-navigation cv-interactive">
        <IconButton aria-label="Show thumbnails" title="Show thumbnails" aria-pressed={thumbnails} aria-controls={`${idPrefix}-thumbnails`} disabled={!interactive} onClick={() => setThumbnails(value => !value)}><PanelLeft size={16} aria-hidden="true" /></IconButton>
      </div>
      <span className="cv-page-indicator" role="status" aria-live="polite">Page {currentPage} of 2</span>
      <div className="cv-zoom cv-interactive">
        <IconButton aria-label="Zoom out" title="Zoom out (Alt −)" disabled={!interactive || scale <= .5} onClick={() => changeZoom(-1)}><Minus size={16} aria-hidden="true" /></IconButton>
        <output aria-label="Zoom level">{Math.round(scale * 100)}%</output>
        <IconButton aria-label="Zoom in" title="Zoom in (Alt =)" disabled={!interactive || scale >= 2} onClick={() => changeZoom(1)}><Plus size={16} aria-hidden="true" /></IconButton>
        <Button variant="ghost" size={28} disabled={!interactive} aria-pressed={fit} onClick={fitWidth}>Fit</Button>
      </div>
      <div className="cv-actions">
        <Button variant="ghost" size={28} className="cv-interactive" disabled={!interactive} onClick={print}><Printer size={16} aria-hidden="true" /><span className="cv-print-label">Print</span></Button>
        <a ref={download} className="cv-download" data-accent-filled href={profile.cv.href} download={profile.cv.filename}><Download size={16} aria-hidden="true" /><span>Download PDF<small>{profile.cv.sizeLabel}</small></span></a>
      </div>
    </Toolbar>
    <div className="cv-body">
      {thumbnails && <CvThumbnails profile={profile} currentPage={currentPage} idPrefix={idPrefix} onPage={interactive ? goToPage : undefined} />}
      <div className="cv-scroll" ref={element => { scroll.current = element; if (scrollRootRef) scrollRootRef.current = element; }} data-scroll-root tabIndex={0} aria-label="CV pages">
        <div className="cv-scaled-pages" style={{ '--cv-stack-height': `${PAGE_HEIGHT * 2 + PAGE_GAP}px` } as CSSProperties}>
          <div className="cv-pages">
            <CvPage profile={profile} page={1} id={`${idPrefix}-page-1`} />
            <CvPage profile={profile} page={2} id={`${idPrefix}-page-2`} />
          </div>
        </div>
      </div>
    </div>
  </div>;
});
