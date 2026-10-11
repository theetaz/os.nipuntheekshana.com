import type { ClientProfile } from '../../types/content';

export const ABOUT_SECTIONS = ['Overview', 'Story', 'Principles', 'Toolbox', 'Life'] as const;
export type AboutSection = typeof ABOUT_SECTIONS[number];
export type AboutProfile = ClientProfile & { renderedAt?: string };

export function sectionFromHash(hash: string): AboutSection {
  return ABOUT_SECTIONS.find(section => hash === `#about-${section.toLowerCase()}`) ?? 'Overview';
}
