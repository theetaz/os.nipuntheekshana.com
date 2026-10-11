import { useLayoutEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';
import { MAX_INPUT } from '../script';

export function Composer({ value, disabled, thread, onChange, onSend }: {
  value: string; disabled?: boolean; thread: 'nipun' | 'mochi'; onChange?: (value: string) => void; onSend?: () => void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (!input.current) return;
    input.current.style.height = 'auto';
    input.current.style.height = `${Math.min(110, Math.max(22, input.current.scrollHeight))}px`;
  }, [value]);
  return <form className="messages-composer" aria-label="Message composer" onSubmit={event => { event.preventDefault(); onSend?.(); }}>
    <textarea ref={input} aria-label={thread === 'nipun' ? 'Write to Nipun' : 'Write to Mochi'} data-autofocus="" rows={1}
      placeholder={thread === 'nipun' ? 'Write to Nipun…' : 'Write to Mochi…'} maxLength={MAX_INPUT} value={value}
      readOnly={!onChange} disabled={!onSend} onChange={event => onChange?.(event.target.value)}
      onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault(); if (!disabled && value.trim()) onSend?.();
        }
      }} />
    <button type="submit" aria-label="Send message" data-accent-filled="true" disabled={disabled || !value.trim() || !onSend}>
      <ArrowUp aria-hidden="true" size={18} />
    </button>
  </form>;
}
