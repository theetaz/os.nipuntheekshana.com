import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface PackageManifest {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

interface PackageLock {
  packages: Record<string, {
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>;
}

const manifest = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as PackageManifest;
const lock = JSON.parse(
  readFileSync(new URL('../../package-lock.json', import.meta.url), 'utf8'),
) as PackageLock;

// Direct dependencies must remain exact and reproducible on clean installs.
describe('scaffold dependency lock', () => {
  it('records the same direct dependencies as the package manifest', () => {
    expect(lock.packages['']?.dependencies).toEqual(manifest.dependencies);
    expect(lock.packages['']?.devDependencies).toEqual(manifest.devDependencies);
  });

  it.each(Object.entries({ ...manifest.dependencies, ...manifest.devDependencies }))(
    '%s resolves to its exact pinned version %s',
    (name, version) => {
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(lock.packages[`node_modules/${name}`]?.version).toBe(version);
    },
  );
});
