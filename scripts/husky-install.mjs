import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Husky isn't needed in CI/package consumers; it's a dev convenience.
// This script attempts to install git hooks, but never fails the install if it can't
// (e.g. read-only .git, sandboxed environments, tarball installs without .git).
if (!existsSync('.git')) {
  process.exit(0);
}

const result = spawnSync('npx', ['--no', 'husky', 'install'], {
  stdio: 'inherit',
});

// If hooks can't be installed, don't fail dependency installation.
if (result.status && result.status !== 0) {
  process.exit(0);
}
process.exit(result.status ?? 0);
