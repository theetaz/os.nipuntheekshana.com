import { Fragment, type RefObject } from 'react';
import { Img } from '../../../ui/Img';
import type { ClientProfile } from '../../../types/content';
import { formatMessageTime, SCRIPTED_BANNER, type Message, type ThreadId } from '../script';
import { Bubble } from './Bubble';
import { Composer } from './Composer';
import { SuggestionChips } from './SuggestionChips';
import { MochiAvatar } from './ThreadList';

export function Thread({ profile, selected, messages, typing, busy, draft, mode = 'scripted', scrollRootRef, onChange, onSend, onCopy }: {
  profile: ClientProfile; selected: ThreadId; messages: Message[]; typing?: boolean; busy?: boolean; draft: string;
  mode?: 'scripted' | 'ai'; scrollRootRef?: RefObject<HTMLElement | null>; onChange?: (value: string) => void;
  onSend?: (text: string) => void; onCopy?: (text: string) => void;
}) {
  return <section className="messages-thread" aria-label={selected === 'nipun' ? 'Conversation with Nipun' : 'Conversation with Mochi'}>
    <header className="messages-thread-header">
      {selected === 'nipun' ? <Img image={profile.avatar} alt="" sizes="40px" className="messages-avatar" loading="eager" /> : <MochiAvatar />}
      <h1>{selected === 'nipun' ? `Nipun · ${mode === 'ai' ? 'AI' : 'scripted'}` : 'Mochi · desk buddy'}</h1>
      <p>{selected === 'nipun' ? mode === 'scripted' ? SCRIPTED_BANNER
        : "Replies come from an AI trained on Nipun's public profile. It can be wrong. For anything important, email him."
        : 'A little company for the desk. Pets and tea reach the real Mochi.'}</p>
    </header>
    <div className="messages-log" ref={scrollRootRef as RefObject<HTMLDivElement>} data-scroll-root={onSend ? true : undefined} tabIndex={0}
      role="log" aria-label="Message history" aria-live={onSend ? 'polite' : 'off'} aria-relevant="additions" aria-busy={typing || undefined}>
      <ol>
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const timestamp = previous && message.at - previous.at > 600_000;
          return <Fragment key={message.id}>
            {timestamp && <li className="messages-timestamp"><time dateTime={new Date(message.at).toISOString()}>
              {formatMessageTime(new Date(message.at), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} · Colombo
            </time></li>}
            <Bubble message={message} grouped={!timestamp && previous?.role === message.role} onCopy={onCopy} />
          </Fragment>;
        })}
        {typing && <li className="messages-bubble messages-bubble--assistant messages-typing" role="status" aria-label={selected === 'nipun' ? 'Nipun is typing' : 'Mochi is typing'}>
          <span /><span /><span /><span className="sr-only">{selected === 'nipun' ? 'Nipun' : 'Mochi'} is typing…</span>
        </li>}
      </ol>
    </div>
    <footer className="messages-thread-footer">
      <SuggestionChips thread={selected} disabled={busy} onSend={onSend} />
      <Composer thread={selected} value={draft} disabled={busy} onChange={onChange} onSend={onSend ? () => onSend(draft) : undefined} />
      <p className="messages-static-note">Read the replies above, or <a href={`mailto:${profile.site.email}`}>email Nipun directly</a>.</p>
    </footer>
  </section>;
}
