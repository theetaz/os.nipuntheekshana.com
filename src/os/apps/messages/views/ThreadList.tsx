import { useRef, useState } from 'react';
import { SearchField } from '../../../ui/SearchField';
import { Img } from '../../../ui/Img';
import type { ClientProfile } from '../../../types/content';
import type { Message, ThreadId } from '../script';

export function MochiAvatar() {
  return <svg viewBox="0 0 40 40" className="messages-avatar messages-mochi" aria-hidden="true">
    <path d="M8 28C3 11 12 6 20 8c8-2 17 3 12 20-3 7-21 7-24 0Z" fill="var(--os-raised)" stroke="currentColor" />
    <path d="M14 19v3m12-3v3m-9 4q3 3 6 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>;
}
export function ThreadList({ profile, selected, threads, onSelect }: {
  profile: ClientProfile; selected: ThreadId; threads: Record<ThreadId, Message[]>; onSelect?: (id: ThreadId) => void;
}) {
  const [search, setSearch] = useState('');
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const matches = (['nipun', 'mochi'] as const).filter(id => id.includes(search.trim().toLowerCase()));
  return <nav className="messages-thread-list" aria-label="Conversations">
    <SearchField label="Search conversations" placeholder="Search" value={search} disabled={!onSelect} onChange={event => setSearch(event.target.value)} />
    <div className="messages-thread-rows">
      {matches.map((id, index) => <button key={id} ref={node => { rows.current[index] = node; }} type="button"
        className="messages-thread-row" aria-label={id === 'nipun' ? 'Nipun conversation' : 'Mochi conversation'}
        aria-current={selected === id ? 'page' : undefined} disabled={!onSelect && id !== 'nipun'} onClick={() => onSelect?.(id)}
        onKeyDown={event => {
          let next: number | undefined;
          if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % matches.length;
          if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + matches.length) % matches.length;
          if (event.key === 'Home') next = 0;
          if (event.key === 'End') next = matches.length - 1;
          if (next !== undefined) { event.preventDefault(); rows.current[next]?.focus(); }
        }}>
        {id === 'nipun' ? <Img image={profile.avatar} alt="" sizes="40px" className="messages-avatar" /> : <MochiAvatar />}
        <span className="messages-thread-summary"><span className="messages-thread-name">{id === 'nipun' ? 'Nipun' : 'Mochi'}<span>now</span></span>
          <span className="messages-thread-preview">{threads[id].at(-1)?.text ?? (id === 'nipun' ? 'Ask me about…' : 'Pet me?')}</span></span>
      </button>)}
      {!matches.length && <p className="messages-no-results">No conversations found.</p>}
    </div>
  </nav>;
}
