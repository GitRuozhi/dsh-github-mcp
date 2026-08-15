# dsh-github-mcp

DSH-GitHub bridge: exposes the official GitHub MCP server as DSH-native tools, and fixes the issue where DSH's bridge discards file content.

After install, the agent can reach GitHub and read files directly through the `mcp__github__*` tool family and the `github_file_read` tool — no local Git or `gh` CLI in between.

## Install

```powershell
dsh plugin --profile web add github:GitRuozhi/dsh-github-mcp
```

Set `GITHUB_TOKEN` and restart `dsh web`. If `gh` is already logged in on this machine, you can just ask DSH to configure it for you.

## Features

| | |
|---|---|
| ✅ Official | talks to GitHub's official `github-mcp-server` |
| ✅ Native MCP | speaks MCP directly — no `gh` wrapper, no hand-written REST |
| ✅ Zero local deps | uses GitHub's hosted endpoint `https://api.githubcopilot.com/mcp/` |
| ✅ Reads file bodies | `github_file_read` fixes the official bridge's dropped-content problem |

## Tools

Two tool families are added on install:

**`github_file_read`** — read a file's contents (decoded to UTF-8 text) or list a directory; private repos work too (needs `GITHUB_TOKEN`).

**`mcp__github__*` (44 tools from GitHub's official MCP server)**

- **Search**: `search_repositories`, `search_code`, `search_issues`, `search_pull_requests`, `search_commits`, `search_users`
- **Repos**: `create_repository`, `fork_repository`, `list_repository_collaborators`, `list_branches` / `create_branch`, `list_tags` / `get_tag`, `list_commits` / `get_commit`
- **Files**: `get_file_contents`, `create_or_update_file`, `delete_file`, `push_files`
- **Releases**: `list_releases`, `get_latest_release`, `get_release_by_tag`
- **Issues**: `list_issues`, `issue_read`, `issue_write`, `sub_issue_write`, `add_issue_comment`, `get_label`, `list_issue_types` / `list_issue_fields`, `get_teams` / `get_team_members`
- **Pull requests**: `list_pull_requests`, `pull_request_read`, `create_pull_request`, `update_pull_request`, `update_pull_request_branch`, `merge_pull_request`, `pull_request_review_write`, `add_comment_to_pending_review`, `add_reply_to_pull_request_comment`, `request_copilot_review`
- **Other**: `get_me`, `run_secret_scanning`

> Model-facing names all carry the `mcp__github__` prefix.

## Minimal presets

This plugin registers its tools globally, so every preset inherits the GitHub tools — including minimal presets. To opt a preset out, mask them as follows. Note: DSH's built-in `minimal` preset cannot mask global plugins; create your own custom minimal preset instead.

```js
// restrict-github.js
const name = 'restrict-github';
const inject = ['tools'];

function apply(ctx) {
  const deny = ctx.tools
    .schemas()
    .map((schema) => schema.name)
    .filter((n) => n.startsWith('mcp__github__') || n === 'github_file_read');
  if (deny.length > 0) ctx.tools.restrict({ deny });
}

export { apply, inject, name };
```

```yaml
# in that preset's agent.cordis.yml
- id: restrict-github
  name: ./restrict-github.js
```
