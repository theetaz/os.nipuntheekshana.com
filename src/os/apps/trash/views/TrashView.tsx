import type { RefObject } from 'react';
import { AppIcon } from '../../../ui/AppIcon';
import { Button } from '../../../ui/Button';
import type { TrashItem } from '../items';
import { NoteCard } from './NoteCard';
import { PaperIcon } from './PaperIcon';
import '../kooda.css';

interface TrashViewProps {
  items: readonly TrashItem[];
  empty?: boolean;
  note?: TrashItem | null;
  onOpen?: (item: TrashItem) => void;
  onCloseNote?: () => void;
  onEmpty?: () => void;
  scrollRootRef?: RefObject<HTMLElement | null>;
}

export function TrashView({ items, empty = false, note, onOpen, onCloseNote, onEmpty, scrollRootRef }: TrashViewProps) {
  return <div className="kooda-view" data-kooda-view>
    <div className="kooda-toolbar" role="group" aria-label="Kooda actions" data-no-drag>
      <Button size={28} disabled={empty || !onEmpty} title={!onEmpty ? 'Available in the interactive desktop' : undefined}
        onClick={onEmpty}>Empty Kooda</Button>
      {!onEmpty && <span className="sr-only">Empty Kooda requires JavaScript.</span>}
    </div>
    <div className="kooda-scroll" ref={scrollRootRef as RefObject<HTMLDivElement | null>} data-scroll-root={onOpen ? '' : undefined}>
      <h1 className="kooda-heading sr-only">Kooda</h1>
      <p className="kooda-subtitle">Kooda (<span lang="si">කූඩය</span>) — Sinhala for basket.</p>
      {empty ? <section className="kooda-empty" aria-label="Empty basket" role="status">
        <AppIcon icon="app-trash" size={64} />
        <h2>Kooda is empty.</h2>
      </section> : <ul className="kooda-grid" aria-label="Things that didn’t make it">
        {items.map(item => <li key={item.id}>
          {onOpen ? <button type="button" className="kooda-tile" onClick={() => onOpen(item)} aria-haspopup="dialog">
            <PaperIcon /><span>{item.name}</span>
          </button> : <details className="kooda-static-note">
            <summary className="kooda-tile"><PaperIcon /><span>{item.name}</span></summary>
            <p>{item.note}</p>
          </details>}
        </li>)}
      </ul>}
    </div>
    {note && onCloseNote && <NoteCard item={note} onClose={onCloseNote} />}
  </div>;
}
