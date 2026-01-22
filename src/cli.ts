export type ParsedArgs = {
  transport: 'stdio' | 'http';
  port: number;
  authToken?: string;
};

export function parseArgs(argv: string[] = process.argv.slice(2)): ParsedArgs {
  const args = argv;
  let transport: ParsedArgs['transport'] = 'stdio';
  let port = 3000;
  let authToken: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--transport' && i + 1 < args.length) {
      const value = args[i + 1];
      if (value === 'stdio' || value === 'http') transport = value;
      else transport = value as ParsedArgs['transport']; // validated below for identical error text
      i++;
    } else if (args[i] === '--port' && i + 1 < args.length) {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--token' && i + 1 < args.length) {
      authToken = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      // Keep output identical to prior behavior for users/scripts.
      console.log(getHelpText());
      process.exit(0);
    }
  }

  if (transport !== 'stdio' && transport !== 'http') {
    console.error('Error: --transport must be either "stdio" or "http"');
    process.exit(1);
  }

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error('Error: --port must be a valid port number (1-65535)');
    process.exit(1);
  }

  return { transport, port, authToken };
}

export function getHelpText(): string {
  return `
Usage: node index.js [options]

Options:
  --transport <type>     Transport type: 'stdio' or 'http' (default: stdio)
  --port <number>        Port for HTTP server when using Streamable HTTP transport (default: 3000)
  --token <token>        Bearer token for HTTP authorization (optional, can also use AUTH_TOKEN env var)
  --help, -h             Show this help message

Environment Variables (Slack):
  SLACK_BOT_TOKEN        Bot token (xoxb-...) - messages appear as the bot app
  SLACK_USER_TOKEN       User token (xoxp-...) - messages appear as you (takes precedence over bot token)
  SLACK_TEAM_ID          Workspace/Team ID (required)
  SLACK_CHANNEL_IDS      Optional comma-separated channel IDs to restrict access

Environment Variables (HTTP Transport):
  AUTH_TOKEN             Bearer token for HTTP authorization (fallback if --token not provided)

Token Modes:
  Bot Mode (SLACK_BOT_TOKEN):
    - Messages appear from the bot app
    - Only accesses channels the bot is invited to
    - search.messages does NOT work (requires user token)
  
  User Mode (SLACK_USER_TOKEN):
    - Messages appear as you
    - Accesses all channels you have access to
    - search.messages works
    - If both tokens are set, user token takes precedence

Examples:
  node index.js                                    # Use stdio transport (default)
  node index.js --transport stdio                  # Use stdio transport explicitly
  node index.js --transport http                   # Use Streamable HTTP transport on port 3000
  node index.js --transport http --port 8080       # Use Streamable HTTP transport on port 8080
  node index.js --transport http --token mytoken   # Use Streamable HTTP transport with custom auth token
  AUTH_TOKEN=mytoken node index.js --transport http   # Use Streamable HTTP transport with auth token from env var
`;
}
