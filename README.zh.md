# dsh-github-mcp

DSH-GitHub 桥接器，将 GitHub 官方 MCP 服务桥接成 DSH 原生工具，同时修复了 DSH 官方丢弃文件原文的问题。

安装后，Agent 可以使用 `mcp__github__*` 工具族和 `github_file_read` 工具直接访问 GitHub 和读取文件，不再需要通过本地 Git 或 `gh` 工具中转。

## 安装

```powershell
dsh plugin --profile web add github:GitRuozhi/dsh-github-mcp
```

安装后需配置 `GITHUB_TOKEN` 并重启 `dsh web`。本机 `gh` 已登录时，可直接让 DSH 帮你配置。

## 特点

| | |
|---|---|
| ✅ 官方 | 直连 GitHub 官方 `github-mcp-server` |
| ✅ 原生 MCP | 走 MCP 协议直连，不包装 `gh`、不手写 REST |
| ✅ 零本地依赖 | 使用 GitHub 官方托管端点 `https://api.githubcopilot.com/mcp/` |
| ✅ 能读文件正文 | `github_file_read` 修复了官方桥接丢弃文件原文的问题 |

## 工具

安装后新增两类工具：

**`github_file_read`** —— 读取文件正文（解码为 UTF-8 文本）或列出目录，私有仓库也能读（需 `GITHUB_TOKEN`）。

**`mcp__github__*`（44 个，来自 GitHub 官方 MCP server）**

- **搜索**：`search_repositories` 搜仓库、`search_code` 搜代码、`search_issues` 搜 issue、`search_pull_requests` 搜 PR、`search_commits` 搜 commit、`search_users` 搜用户
- **仓库**：`create_repository` 建仓库、`fork_repository` fork、`list_repository_collaborators` 协作者、`list_branches` / `create_branch` 列/建分支、`list_tags` / `get_tag` 列/读 tag、`list_commits` / `get_commit` 列/读 commit
- **文件**：`get_file_contents` 读文件/目录、`create_or_update_file` 写文件、`delete_file` 删文件、`push_files` 批量推文件
- **Release**：`list_releases` 列 release、`get_latest_release` 最新 release、`get_release_by_tag` 按 tag 读 release
- **Issue**：`list_issues` 列 issue、`issue_read` 读、`issue_write` 建/改、`sub_issue_write` 子 issue、`add_issue_comment` 评论、`get_label` 标签、`list_issue_types` / `list_issue_fields` 类型/字段、`get_teams` / `get_team_members` 团队/成员
- **Pull Request**：`list_pull_requests` 列 PR、`pull_request_read` 读、`create_pull_request` 建、`update_pull_request` 改、`update_pull_request_branch` 更新分支、`merge_pull_request` 合并、`pull_request_review_write` 审查、`add_comment_to_pending_review` 待审评论、`add_reply_to_pull_request_comment` 回复评论、`request_copilot_review` 请求 Copilot 审查
- **其它**：`get_me` 当前用户信息、`run_secret_scanning` 密钥扫描

> 模型看到的名字都带 `mcp__github__` 前缀。

## 极简预设

这个插件把工具注册在全局，所以所有预设都会继承 GitHub 工具，包括极简预设。如果您希望某个预设不采用此插件，可以在每次系统提示组装时把它们过滤掉。请注意，DSH 原生极简预设 `minimal` 无法屏蔽全局插件，您可以新建一个自定义极简预设来实现屏蔽。

> 请在 `system-prompt/assemble` 里过滤，而不要在 `apply` 时对 `ctx.tools.schemas()` 打快照：本插件是异步注册工具的（MCP 发现 + `ctx.effect` 注册），一次性快照在 `apply` 时是空的，屏蔽不会生效。组装时过滤与注册顺序无关——请求发生前已注册的工具都会被过滤掉。

```js
// restrict-github.js
const name = 'restrict-github';
const inject = ['tools'];

function apply(ctx) {
  ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    const assembled = await next();
    try {
      const tools = assembled && Array.isArray(assembled.tools) ? assembled.tools : [];
      const filtered = tools.filter((tool) => {
        const toolName = tool && typeof tool.name === 'string' ? tool.name : '';
        return !(toolName.startsWith('mcp__github__') || toolName === 'github_file_read');
      });
      if (filtered.length === tools.length) return assembled;
      return { ...assembled, tools: filtered };
    } catch (error) {
      // 过滤器出错绝不能把会话搞崩：保留全部工具。
      return assembled;
    }
  });
}

export { apply, inject, name };
```

```yaml
# 在该预设的 agent.cordis.yml 里
- id: restrict-github
  name: ./restrict-github.js
```
