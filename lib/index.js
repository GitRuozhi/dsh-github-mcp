// lib/index.js — dsh-github-mcp plugin.
//
// Registers `github_file_read`, a REST-backed GitHub file/directory reader.
// It exists because DSH's built-in dsh-mcp-client discards MCP `resource`
// content, so the official get_file_contents tool cannot return file bodies —
// it only surfaces "successfully downloaded text file (SHA: ...)" plus a
// "[resource: content discarded]" placeholder. This tool calls the GitHub
// contents API directly and returns decoded UTF-8 text, which passes through
// to the model normally.
import { defineTool } from '@deepseek-ai/dsh-tools';

const name = 'github-file-read';
const inject = ['tools'];

const API_BASE = 'https://api.github.com';
const MAX_INLINE_BYTES = 1024 * 1024; // contents API inline limit (1 MB)

async function readContents(args, signal) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      'GITHUB_TOKEN is not set in the DSH process environment — set it in $DSH_HOME/.env and restart dsh.'
    );
  }
  const { owner, repo, path, ref } = args;
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  const url =
    `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}` +
    `/contents/${encodeURIComponent(path)}${query}`;

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'dsh-github-mcp',
    },
    signal,
  });

  const bodyText = await response.text();
  if (!response.ok) {
    let detail = bodyText;
    try {
      detail = JSON.stringify(JSON.parse(bodyText)).slice(0, 500);
    } catch {}
    throw new Error(
      `GitHub API ${response.status} ${response.statusText} for ${owner}/${repo}/${path}: ${detail}`
    );
  }

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new Error(`GitHub API returned non-JSON for ${owner}/${repo}/${path}`);
  }

  // Directory: the API returns an array of entries.
  if (Array.isArray(data)) {
    const lines = data.map((entry) => {
      const type = entry.type === 'dir' ? 'dir ' : 'file';
      const size = typeof entry.size === 'number' ? ` (${entry.size} bytes)` : '';
      return `${type}  ${entry.name}${size}`;
    });
    const text =
      `Directory listing of ${owner}/${repo}/${path}:\n` +
      (lines.length > 0 ? lines.join('\n') : '(empty directory)');
    return { kind: 'directory', text };
  }

  // File: inline base64 content, or "none" for files over ~1 MB.
  if (data.type === 'file') {
    if (data.encoding === 'base64' && typeof data.content === 'string' && data.content.length > 0) {
      const decoded = Buffer.from(data.content, 'base64').toString('utf8');
      return { kind: 'file', text: decoded, size: data.size };
    }
    const size = typeof data.size === 'number' ? data.size : 0;
    return {
      kind: 'file',
      size,
      text:
        `File ${data.path} is ${size} bytes (over the ${MAX_INLINE_BYTES / 1024 / 1024} MB contents-API ` +
        `inline limit), so no inline content was returned. Read it via the raw endpoint or clone the repo.`,
    };
  }

  // Symlink, submodule, or anything else: pass through a compact JSON view.
  return { kind: data.type ?? 'other', text: JSON.stringify(data, null, 2) };
}

function apply(ctx) {
  ctx.effect(() => {
    const dispose = ctx.tools.register(
      defineTool({
        name: 'github_file_read',
        description:
          'Read the contents of a file (decoded text) or list a directory from a GitHub repository. ' +
          'Works for public and private repos (private needs a token with repo scope). ' +
          'This complements the MCP get_file_contents tool, whose resource-based file bodies are ' +
          'discarded by the DSH MCP bridge.',
        parameters: {
          owner: { type: 'string', required: true, description: 'Repository owner (user or organization).' },
          repo: { type: 'string', required: true, description: 'Repository name.' },
          path: { type: 'string', required: true, description: 'File path, or a directory path to list.' },
          ref: { type: 'string', description: 'Branch, tag, or commit SHA. Defaults to the default branch.' },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', required: true, description: "One of 'file', 'directory', 'symlink', 'submodule', or 'other'." },
              text: { type: 'string', required: true, description: 'Decoded file text or directory listing.' },
              size: { type: 'integer', description: 'File size in bytes (files only).' },
            },
          },
          render: (_args, value) => [{ type: 'text', text: value.text }],
        },
        timeoutMs: 30000,
        isConcurrencySafe: () => true,
        async execute(args, exec) {
          return readContents(args, exec?.signal);
        },
        presentCall: (args) => ({
          card: 'generic',
          kind: 'read',
          title: `Read GitHub file ${args.owner}/${args.repo}/${args.path}`,
          rawInput: `${args.owner}/${args.repo}/${args.path}`,
        }),
      })
    );
    return () => dispose();
  }, 'dsh-github-mcp.file-read');
}

export { apply, inject, name };
