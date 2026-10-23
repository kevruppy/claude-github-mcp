import crypto from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const OWNER = process.env.GITHUB_OWNER || 'kevruppy';
const TARGET = {
  owner: OWNER,
  repo: 'fitness_tracking',
  workflow_id: 'ci.yml',
  ref: 'main',
};

function tokenOk(provided) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !provided) return false;
  const a = crypto.createHash('sha256').update(String(provided)).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

function buildServer() {
  const server = new McpServer({ name: 'github-action-starter', version: '1.0.0' });

  server.tool(
    'trigger_ci',
    `Triggers the "${TARGET.workflow_id}" GitHub Actions workflow in ${TARGET.owner}/${TARGET.repo} on branch ${TARGET.ref}. Takes no parameters.`,
    {},
    async () => {
      const r = await fetch(
        `https://api.github.com/repos/${TARGET.owner}/${TARGET.repo}/actions/workflows/${TARGET.workflow_id}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_PAT}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'Claude-MCP-Server',
          },
          body: JSON.stringify({ ref: TARGET.ref }),
        }
      );
      if (r.ok) {
        return {
          content: [{ type: 'text', text: `Workflow ${TARGET.workflow_id} in ${TARGET.repo} triggered on ${TARGET.ref}.` }],
        };
      }
      return { isError: true, content: [{ type: 'text', text: `GitHub error ${r.status}: ${await r.text()}` }] };
    }
  );
  return server;
}

export default async function handler(req, res) {
  const headerToken = (req.headers['authorization'] || '').replace(/^Bearer /, '');
  if (!tokenOk(req.query?.token) && !tokenOk(headerToken)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
