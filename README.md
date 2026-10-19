# zentao-helper

通过 MCP 操作禅道 REST API v2。包含 OpenAPI 定义的 **119 个原始操作**和 3 个常用查询工具，供 Codex、Claude Desktop 等 MCP 客户端调用。

## 前提

- Node.js 20.17 或更高版本
- 可访问的禅道 REST API v2，以及有相应权限的账号

## 首次配置

在终端运行：

```bash
npx -y zentao-helper setup
```

依次输入禅道站点地址（例如 `https://zentao.example.com`，也可直接填 `/api.php/v2` 地址）、账号和密码。配置保存在当前用户的 `~/.config/zentao-helper/config.json`（Windows 为 `%APPDATA%\zentao-helper\config.json`），文件权限为仅当前用户可读写；启动时自动登录并将 Token 缓存在进程内。不会把凭据写入 npm 包或 MCP 客户端配置。

验证连接：

```bash
npx -y zentao-helper doctor
```

无法交互配置的环境可设置 `ZENTAO_URL`、`ZENTAO_ACCOUNT`、`ZENTAO_PASSWORD` 环境变量，启动时优先读取它们。已有 API Token 时，也可设置 `ZENTAO_URL` 和 `ZENTAO_TOKEN`；Token 不会写入包内。使用环境变量时无需运行 `setup`。

## MCP 客户端配置

Codex 的 `~/.codex/config.toml`：

```toml
[mcp_servers.zentao]
command = "npx"
args = ["-y", "zentao-helper"]
```

Claude Desktop 等 JSON 配置格式：

```json
{
  "mcpServers": {
    "zentao": {
      "command": "npx",
      "args": ["-y", "zentao-helper"]
    }
  }
}
```

配置后重启客户端，使其重新连接 MCP。`npx zentao-helper` 以 stdio 方式运行；标准输出只传 MCP 协议消息。

## 常用请求

- “列出 V1.1 产品计划的需求”：调用 `zentao_list_plan_stories`，可按计划 ID 或名称查找。若名称重名，提供计划 ID 或产品 ID。
- “查看需求 123 的详情”：调用 `zentao_get_story`。
- “查看指派给我的需求和 Bug”：调用 `zentao_assigned_to_me`，可按产品及类型筛选。
- “帮我实现需求 123 / 修复 Bug 456，并处理任务状态”：先通过 MCP 读取记录和关联任务；编程代理在本地代码仓库实现和测试；按用户要求调用 `put_tasks_taskID_start`、`put_tasks_taskID_finish` 或 `put_bugs_bugID_resolve`，再读取记录确认状态。MCP 工具只负责禅道数据，不会自行修改代码仓库。

提示中的“版本”默认视为产品计划。若明确提到发布、构建或项目版本，可调用相应原始接口。所有原始工具以 `get_`、`post_`、`put_`、`delete_` 开头；路径参数已暴露为必填输入，例如 `get_stories_storyID` 的 `storyID`。

## 权限与安全

该 MCP 包提供删除、用户管理、状态流转等高风险写操作。请使用权限适当的专用禅道账号，并在 MCP 客户端保留对写入操作的人工确认。`DELETE` 工具带有 destructive 标记；所有写工具在描述中注明会修改数据。客户端是否弹出确认取决于客户端自身的安全策略。

源码中的 OpenAPI 文件用于生成工具定义；公开包内没有实际禅道地址或账号凭据。配置文件包含明文密码，请保护当前用户账号及其配置目录。

## 开发

```bash
npm install
npm test
npm pack --dry-run
```

MIT License。
