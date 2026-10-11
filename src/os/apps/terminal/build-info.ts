import { dependencies } from '../../../../package.json';

const minor = (version: string) => version.split('.').slice(0, 2).join('.');
export const KERNEL = `Astro ${minor(dependencies.astro)} + React ${minor(dependencies.react)}`;
