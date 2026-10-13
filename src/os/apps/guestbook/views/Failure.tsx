import { blockedMessage, countdown, type BoardFailure } from '../api';
import { mostlySinhala } from '../board';
interface Props { failure: BoardFailure | null; seconds: number; retry(): void }
export function Failure({ failure, seconds, retry }: Props) {
  if (!failure || failure.kind === 'invalid') return null;
  const joke = failure.kind === 'profanity';
  const message = failure.kind === 'rate' ? `Easy, machan. One note a minute. Try again in ${countdown(seconds)}.` : failure.message;
  return <div className={joke ? 'k-compose-joke' : 'k-compose-error'} data-failure={failure.kind}>
    <p role={failure.kind === 'rate' ? 'status' : 'alert'} lang={joke && mostlySinhala(message) ? 'si' : undefined}
      aria-describedby={joke ? 'board-joke-edit' : undefined}>{message}</p>
    {joke && <p id="board-joke-edit" lang="en">Edit your note and try again.</p>}
    {failure.kind === 'origin' && <button type="button" onClick={() => location.reload()}>Reload</button>}
    {failure.kind === 'network' && <button type="button" onClick={retry}>Try again</button>}
    {failure.message === blockedMessage && <a href={document.querySelector<HTMLAnchorElement>('.k-contacts a[href^="mailto:"]')?.href ?? 'mailto:theekshana2@gmail.com'}>Email Nipun instead</a>}
  </div>;
}
