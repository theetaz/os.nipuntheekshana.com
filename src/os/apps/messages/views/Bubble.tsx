import type { Message } from '../script';

export function Bubble({ message, grouped = false, onCopy }: { message: Message; grouped?: boolean; onCopy?: (text: string) => void }) {
  return <li className={`messages-bubble messages-bubble--${message.role}`} data-grouped={grouped || undefined} data-message-id={message.id}
    id={message.role === 'user' && message.id.startsWith('question-') ? `messages-${message.id}` : undefined}>
    <span className="sr-only">{message.role === 'user' ? 'You' : 'Reply'}: </span>
    <p>{message.text}</p>
    {(message.links?.length || message.emailText) && <div className="messages-bubble-actions">
      {message.links?.map(link => <a key={link.href} href={link.href} target={link.href.startsWith('https:') ? '_blank' : undefined}
        rel={link.href.startsWith('https:') ? 'noopener noreferrer' : undefined}>{link.label}</a>)}
      {message.emailText && onCopy && <button type="button" onClick={() => onCopy(message.emailText!)}>Copy text</button>}
    </div>}
  </li>;
}
