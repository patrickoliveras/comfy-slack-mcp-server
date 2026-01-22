#!/usr/bin/env node
import { main } from './src/main.js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export { SlackClient } from './src/client/slack-client.js';
export { createSlackServer } from './src/server/create-slack-server.js';
export { parseArgs } from './src/cli.js';
export { main } from './src/main.js';

export type { TokenType } from './src/types/slack.js';

// Only run main() if this file is executed directly, not when imported by tests
// This handles both direct execution and global npm installation
if (import.meta.url.startsWith('file://')) {
  const currentFile = fileURLToPath(import.meta.url);
  const executedFile = process.argv[1] ? resolve(process.argv[1]) : '';

  // Check if this is the main module being executed
  // Don't run if we're in a test environment (jest)
  const isTestEnvironment =
    process.argv.some((arg) => arg.includes('jest')) ||
    process.env.NODE_ENV === 'test' ||
    process.argv[1]?.includes('jest');

  const isMainModule =
    !isTestEnvironment &&
    (currentFile === executedFile ||
      (process.argv[1] && process.argv[1].includes('slack-mcp')) ||
      (process.argv[0].includes('node') && process.argv[1] && !process.argv[1].includes('test')));

  if (isMainModule) {
    main().catch((error) => {
      console.error('Fatal error in main():', error);
      process.exit(1);
    });
  }
}
