import { dependencies } from '../../../../package.json';

const major = (version: string) => version.split('.')[0];
export const KERNEL = `Astro ${major(dependencies.astro)} + React ${major(dependencies.react)}`;
