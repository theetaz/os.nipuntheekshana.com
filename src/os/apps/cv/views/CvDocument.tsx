import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { Download, Minus, PanelLeft, Plus, Printer } from 'lucide-react';
import type { ClientProfile } from '../../../types/content';
import { Button } from '../../../ui/Button';
import { IconButton } from '../../../ui/IconButton';
import { Toolbar } from '../../../ui/Toolbar';
import { CvPage, PAGE_GAP, PAGE_HEIGHT, PAGE_WIDTH } from './CvPage';
import { CvThumbnails } from './CvThumbnails';
import '../p3-4-cv.css';

export interface CvViewerState { zoom: number; thumbnails: boolean }
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
  const changeZoom = useCallback((step: number) => {
    setFit(false);
    setZoom(value => Math.max(.5, Math.min(2, Math.round(value * 4 + step) / 4)));
  }, []);
  const actualSize = useCallback(() => { setFit(false); setZoom(1); }, []);
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
      case 'cv.fitWidth': setFit(true); break;
      case 'cv.thumbnails': setThumbnails(value => !value); break;
      case 'cv.print': print(); break;
      case 'cv.download': download.current?.click(); break;
      default: return false;
    }
    return true;
  } }), [actualSize, changeZoom, print]);
  useEffect(() => { onStateChange?.({ zoom, thumbnails }); }, [zoom, thumbnails, onStateChange]);
  useEffect(() => {
    const element = scroll.current;
    if (!interactive || !element) return;
    const resize = new ResizeObserver(() => {
      if (fit) setZoom(Math.min(2, Math.max(.1, (element.clientWidth - 48) / PAGE_WIDTH)));
    });
    resize.observe(element);
    return () => resize.disconnect();
  }, [fit, interactive, thumbnails]);
  useEffect(() => {
    const element = scroll.current;
    if (!interactive || !element) return;
    const visible = new Map<Element, number>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) visible.set(entry.target, entry.intersectionRect.height);
      const page = [...visible].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (page && (visible.get(page) ?? 0) > 0) setCurrentPage(page.id.endsWith('-2') ? 2 : 1);
    }, { root: element, threshold: Array.from({ length: 21 }, (_, i) => i / 20) });
    element.querySelectorAll('.cv-page').forEach(page => observer.observe(page));
    return () => observer.disconnect();
  }, [interactive, zoom]);
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
  return <div ref={root} className="cv-viewer" style={{ '--cv-scale': zoom } as CSSProperties}>
    <Toolbar label="CV document controls" className="cv-toolbar">
      <div className="cv-navigation cv-interactive">
        <IconButton aria-label="Show thumbnails" title="Show thumbnails" aria-pressed={thumbnails} aria-controls={`${idPrefix}-thumbnails`} disabled={!interactive} onClick={() => setThumbnails(value => !value)}><PanelLeft size={16} aria-hidden="true" /></IconButton>
      </div>
      <span className="cv-page-indicator" role="status" aria-live="polite">Page {currentPage} of 2</span>
      <div className="cv-zoom cv-interactive">
        <IconButton aria-label="Zoom out" title="Zoom out (Alt −)" disabled={!interactive || zoom <= .5} onClick={() => changeZoom(-1)}><Minus size={16} aria-hidden="true" /></IconButton>
        <output aria-label="Zoom level">{Math.round(zoom * 100)}%</output>
        <IconButton aria-label="Zoom in" title="Zoom in (Alt =)" disabled={!interactive || zoom >= 2} onClick={() => changeZoom(1)}><Plus size={16} aria-hidden="true" /></IconButton>
        <Button variant="ghost" size={28} disabled={!interactive} aria-pressed={fit} onClick={() => setFit(true)}>Fit</Button>
      </div>
      <div className="cv-actions">
        <Button variant="ghost" size={28} className="cv-interactive" disabled={!interactive} onClick={print}><Printer size={16} aria-hidden="true" />Print</Button>
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
