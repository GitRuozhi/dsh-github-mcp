# dsh-github-mcp

[DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) bundle that bridges the **official** [GitHub MCP server](https://github.com/github/github-mcp-server) (`github/github-mcp-server`) into DSH as native tools, using DSH's built-in `@deepseek-ai/dsh-mcp-client`.

After install, the model sees the `mcp__github__*` tool family — e.g. `mcp__github__get_me`, `mcp__github__search_repositories`, `mcp__github__search_code`, `mcp__github__create_issue`, `mcp__github__create_pull_request`, `mcp__github__create_repository`, and more (the official server currently exposes ~44 tools) — **plus** a `github_file_read` tool that returns decoded file/directory contents (see below).

## Install

```powershell
dsh plugin --profile web add github:GitRuozhi/dsh-github-mcp
```

Then set a GitHub token and restart `dsh web`:

```powershell
# $DSH_HOME defaults to ~/.dsh — write the token to its .env (materialized into process.env at boot)
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

## Reading file contents (`github_file_read`)

DSH's built-in `dsh-mcp-client` bridges MCP **tools** only (not `resources`/`prompts`). GitHub's `get_file_contents` returns file bodies as an MCP *resource*, which the bridge drops — so `mcp__github__get_file_contents` can fetch a file (SHA/size) but cannot return its text.

`github_file_read` fills that gap by calling the GitHub contents REST API directly and returning decoded UTF-8 text:

- `owner` / `repo` / `path` — the file to read, or a directory to list.
- `ref` — optional branch / tag / commit SHA.
- Files ≤ 1 MB are decoded inline; larger files return a clear message (use the raw endpoint or clone the repo).
- Works for public and private repos; private repos need a `GITHUB_TOKEN` with `repo` scope.

Search/issue/PR/repo/commit MCP tools that return text are unaffected.

## Minimal presets

This bundle registers its tools **globally** (at the profile layer), so **every** agent preset inherits `mcp__github__*` and `github_file_read` — including the `minimal` and `mini-win` presets. If you want a minimal preset to stay minimal, mask the GitHub tools by dropping a tiny local plugin next to that preset's `agent.cordis.yml`:

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

Restart `dsh`. That preset keeps its own tools but no longer inherits the GitHub ones.

> **Shipped presets can't be overridden this way.** This method works for presets *you* author. DSH's built-in `minimal` preset ships with the harness and **shadows any same-named user preset** (shipped roots win duplicate ids), so you cannot mask it by adding a `minimal` directory under `.agent-presets`. To mask a shipped preset, copy it to your own preset first (as `mini-win` is a Windows copy of `minimal`), then add `restrict-github.js` to the copy. Editing the shipped file directly works until the harness cache refreshes, then is lost — not recommended.

## Verify

```powershell
node test/validate.mjs   # validates the bundle patch + mcp-client config schema
```

New session → ask the model to call `mcp__github__get_me`; your account info means it's connected.

## License

MIT
