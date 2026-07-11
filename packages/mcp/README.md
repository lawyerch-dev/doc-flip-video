# @doc-flip/mcp

MCP（Model Context Protocol）服务。供 AI 编辑器（Claude、Cursor 等）直接调用视频生成。

## 配置

在 AI 工具中配置：

```json
{
  "mcpServers": {
    "doc-flip-video": {
      "command": "node",
      "args": ["packages/mcp/mcp-server.mjs"]
    }
  }
}
```

## 功能

- 从文章 JSON 自动生成完整视频
- 无需手动操作 UI，AI 工具可直接调用

## 关键文件

| 文件 | 职责 |
|------|------|
| `mcp-server.mjs` | MCP 服务入口，接收请求 → 调用 engine 生成视频 |
