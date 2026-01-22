import { readFileSync } from 'node:fs';

let cachedVersion: string | null = null;

export function getPackageVersionSync(): string {
  if (cachedVersion) return cachedVersion;

  try {
    // When compiled, this becomes `dist/version.js`, so `../package.json` resolves to
    // the package root's package.json (present in npm installs and our Docker image).
    const pkgUrl = new URL('../package.json', import.meta.url);
    const raw = readFileSync(pkgUrl, 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    cachedVersion = parsed.version ?? '0.0.0';
    return cachedVersion;
  } catch {
    cachedVersion = '0.0.0';
    return cachedVersion;
  }
}
