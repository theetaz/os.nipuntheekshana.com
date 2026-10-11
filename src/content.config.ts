// Ported from nipuntheekshana.com/src/content.config.ts @ 64482c5325ceace12c645d1ac5ca211cece46445
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    kind: z.enum(['engineering', 'notes', 'life']).default('engineering'),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

// Long-form case studies for projects. Card metadata (title, stack, links, screens)
// lives in src/data/projects.ts; the file name here matches the project slug.
const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    /** One or two sentences that open the page, in my own words. */
    lede: z.string(),
    /** What I did on it. */
    role: z.string().default('Design, engineering'),
    /** Headline numbers shown in a strip under the hero. */
    facts: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
  }),
});

export const collections = { writing, work };
