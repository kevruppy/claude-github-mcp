export default async function handler(req, res) {

  const authHeader = req.headers['authorization'];
  const SECRET = process.env.AUTH_SECRET;

  if (!SECRET || authHeader !== `Bearer ${SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      schema_version: 'v1',
      name_for_human: 'GitHub Action Starter',
      name_for_model: 'github_action_starter',
      description_for_model: 'Tool to trigger GitHub Actions via workflow_dispatch',
      tools: [
        {
          name: 'trigger_github_action',
          description: 'Triggers a GitHub Action workflow_dispatch event.',
          input_schema: {
            type: 'object',
            properties: {
              owner: { type: 'string', description: 'GitHub username or org' },
              repo: { type: 'string', description: 'Repository name' },
              workflow_id: { type: 'string', description: 'Workflow filename (e.g. sync.yml)' },
              ref: { type: 'string', description: 'Branch name (defaults to main)', default: 'main' }
            },
            required: ['owner', 'repo', 'workflow_id']
          }
        }
      ]
    });
  }

  if (req.method === 'POST') {
    const { owner, repo, workflow_id, ref = 'main' } = req.body;

    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GITHUB_PAT}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'Claude-MCP-Server'
          },
          body: JSON.stringify({ ref })
        }
      );

      if (response.ok || response.status === 204) {
        return res.status(200).json({ success: true, message: `Workflow ${workflow_id} successfully triggered on branch ${ref}.` });
      } else {
        const errorText = await response.text();
        return res.status(response.status).json({ error: errorText });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}