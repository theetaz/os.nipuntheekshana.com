import type { RefObject } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Prose, type ProseProps } from '../../../ui/Prose';
import { Chip } from '../../../ui/Chip';
import { EmptyState } from '../../../ui/EmptyState';
import { Button } from '../../../ui/Button';
import { Skeleton, SkeletonText } from '../../../ui/Skeleton';
import type { ClientPost } from '../../../types/content';
import { FOLDERS, postDate, readerHtml, type TextSize } from '../data';

export interface PostReaderProps {
  post: ClientPost | null; route: string; size: TextSize; error?: Error | null; notFound?: boolean;
  scrollRootRef?: RefObject<HTMLElement | null>; onBack?: () => void; onRetry?: () => void;
  onTagChange?: (tag: string) => void; onLinkClick?: ProseProps['onLinkClick'];
}
function PostEyebrow({ post }: { post: ClientPost }) {
  const kind = `${FOLDERS.find(item => item.id === post.kind)?.label} · `;
  const date = postDate(post.date, true); const duration = ` · ${post.minutes} min`;
  // Condensed Martian Mono advances .65em per character plus .08em tracking.
  // Reserve those widths while the metric fallback loads, keeping each segment in place.
  const width = (text: string) => ({ inlineSize: `${text.length * .73}em` });
  return <p className="writing-eyebrow"><span style={width(kind)}>{kind}</span>
    <time style={width(date)} dateTime={post.date}>{date}</time><span style={width(duration)}>{duration}</span></p>;
}
export function PostReader({ post, route, size, error, notFound, scrollRootRef, onBack, onRetry, onTagChange, onLinkClick }: PostReaderProps) {
  return <section className="writing-reader" aria-label="Post reader" ref={route ? scrollRootRef as RefObject<HTMLElement> : undefined}
    data-scroll-root={route ? '' : undefined} tabIndex={-1}>
    {route && <a className="writing-back" href="/writing" onClick={event => {
      if (!onBack || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); onBack();
    }}><ChevronLeft size={16} aria-hidden="true" />All writing</a>}
    {notFound ? <EmptyState title="This post isn't here." body="Choose another post from the list." />
      : error ? <EmptyState role="alert" title="Couldn't load this post." body="Check your connection and try again."
        action={<Button onClick={onRetry}>Retry</Button>} />
        : post ? <article className="writing-article">
          <header>
            <PostEyebrow post={post} />
            <h1 className="writing-title" tabIndex={-1}>{post.title}</h1>
            <p className="writing-description">{post.description}</p>
            <div className="writing-post-tags" role="group" aria-label="Post tags">{post.tags.map(tag => <span key={tag}>
              <Chip className="js-only" onClick={() => onTagChange?.(tag)}>#{tag}</Chip>
              <span className="no-js-only writing-static-tag">#{tag}</span>
            </span>)}</div>
            <div className="writing-rule" />
          </header>
          <Prose html={readerHtml(post.html, !onLinkClick)} size={size} onLinkClick={onLinkClick} />
        </article> : route ? <Skeleton className="writing-loading" aria-label="Loading post">{Array.from({ length: 8 }, (_, index) => <SkeletonText key={index} />)}</Skeleton>
          : <EmptyState className="writing-reader-empty" title="Choose a post" body="Engineering notes and the occasional essay." />}
  </section>;
}
