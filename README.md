# dsh-github-mcp

[DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) bundle that bridges the **official** [GitHub MCP server](https://github.com/github/github-mcp-server) (`github/github-mcp-server`) into DSH as native tools, using DSH's built-in `@deepseek-ai/dsh-mcp-client`.

After install, the model sees the `mcp__github__*` tool family — e.g. `mcp__github__get_me`, `mcp__github__search_repositories`, `mcp__github__search_code`, `mcp__github__create_issue`, `mcp__github__create_pull_request`, `mcp__github__get_file_contents`, `mcp__github__create_repository`, and more (the official server currently exposes ~44 tools).

## Install

```powershell
dsh plugin --profile web add github:GitRuozhi/dsh-github-mcp
```

Then set a GitHub token and restart `dsh web`:

```powershell
# put the token in DSH's user env layer (materialized into process.env at boot)
Set-Content -Path "$env:USERPROFILE\.dsh\.env" -Value "GITHUB_TOKEN=$(gh auth token)"
# restart dsh web
```

`GITHUB_TOKEN` is a GitHub OAuth token (`gh auth token`) or a fine-grained personal access token (PAT). DSH materializes `$DSH_HOME/.env` into `process.env` at boot; the bridge reads `process.env.GITHUB_TOKEN`.

## What it is / isn't

| | |
|---|---|
| ✅ Official server | connects to GitHub's first-party `github-mcp-server` |
| ✅ Native MCP | speaks MCP (`streamable-http`) directly — not wrapping `gh`, not hand-rolled REST |
| ✅ Remote mode | GitHub's hosted endpoint `https://api.githubcopilot.com/mcp/` — zero local deps |
| ❌ No bundled token | you supply `GITHUB_TOKEN` (see above) |

## Remote vs local mode

This bundle ships **remote mode** (recommended). To self-host the official server locally instead, edit `cordis.patch.yml`: point `url` at your own server and drop the `headers`:

```yaml
# docker run --rm -p 8085:8085 -e GITHUB_PERSONAL_ACCESS_TOKEN=<token> ghcr.io/github/github-mcp-server
config:
  serverName: github
  transport: streamable-http
  url: http://localhost:8085/mcp
```

## Known limitation

DSH's `dsh-mcp-client` bridges MCP **tools** only (not `resources`/`prompts`). GitHub's `get_file_contents` returns file bodies as an MCP *resource*, so the raw body is dropped on the bridge — the tool still fetches the file (SHA/size), but the text isn't passed back to the model. Search/issue/PR/repo tools that return text work normally.

## Verify

```powershell
node test/validate.mjs   # validates the bundle patch + mcp-client config schema
```

New session → ask the model to call `mcp__github__get_me`; your account info means it's connected.

## License

MIT
