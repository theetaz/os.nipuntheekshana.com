import type { RefObject } from 'react';
import type { ClientProfile } from '../../../types/content';
import type { Message, ThreadId } from '../script';
import { ThreadList } from './ThreadList';
import { Thread } from './Thread';
import '../messages.css';

export interface MessagesViewProps {
  profile: ClientProfile; selected: ThreadId; threads: Record<ThreadId, Message[]>; draft?: string;
  typing?: ThreadId | null; busy?: boolean; mode?: 'scripted' | 'ai'; scrollRootRef?: RefObject<HTMLElement | null>;
  onSelect?: (id: ThreadId) => void; onChange?: (value: string) => void; onSend?: (text: string) => void; onCopy?: (text: string) => void;
}
export function MessagesView({ profile, selected, threads, typing, draft = '', onSelect, ...props }: MessagesViewProps) {
  return <div className="messages-app" data-messages-interactive={!!props.onSend}>
    <ThreadList profile={profile} selected={selected} threads={threads} onSelect={onSelect} />
    <Thread {...props} profile={profile} selected={selected} draft={draft} messages={threads[selected]} typing={typing === selected} />
  </div>;
}
