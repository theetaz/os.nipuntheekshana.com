import type { ClientProfile } from '../../../types/content';
import { CvPage } from './CvPage';

export function CvThumbnails({ profile, currentPage, idPrefix, onPage }: {
  profile: ClientProfile; currentPage: number; idPrefix: string; onPage?: (page: 1 | 2) => void;
}) {
  return <nav className="cv-thumbnails" aria-label="Page thumbnails" id={`${idPrefix}-thumbnails`}>
    {([1, 2] as const).map(page => <a key={page} href={`#${idPrefix}-page-${page}`}
      aria-label={`Go to page ${page}`} aria-current={currentPage === page ? 'page' : undefined}
      onClick={onPage ? event => { event.preventDefault(); onPage(page); } : undefined}>
      <span className="cv-thumbnail-preview" aria-hidden="true" inert><CvPage profile={profile} page={page} thumbnail /></span>
      <span className="cv-thumbnail-number">{page}</span>
    </a>)}
  </nav>;
}
