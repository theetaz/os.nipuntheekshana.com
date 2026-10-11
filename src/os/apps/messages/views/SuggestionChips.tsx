import { MOCHI_QUESTIONS, QUESTIONS, type ThreadId } from '../script';

export function SuggestionChips({ thread, disabled, onSend }: { thread: ThreadId; disabled?: boolean; onSend?: (text: string) => void }) {
  const questions = thread === 'nipun' ? QUESTIONS.map(item => item.text) : MOCHI_QUESTIONS;
  return <div className="messages-suggestions" role="group" aria-label="Suggested messages">
    {questions.map((text, index) => onSend
      ? <button key={text} type="button" className="messages-chip" disabled={disabled} onClick={() => onSend(text)}>{text}</button>
      : <a key={text} className="messages-chip" href={`#messages-question-${QUESTIONS[index]?.intent}`}>{text}</a>)}
  </div>;
}
