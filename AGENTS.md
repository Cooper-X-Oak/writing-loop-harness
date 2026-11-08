---
audience: [agent]
kind: directive
---

# Agent Rules

这是一个以文本文件为事实源的 Agent 工作流控制平面：`LOOP.md` 定义图，`modules/*` 定义节点，`GATE.md` 定义检查点，agent 作为执行引擎按图运行。

## 事实源

- 修改架构、运行行为、gate、状态策略或环境变量前，先读 `LOOP.md`。
- 架构或运行契约变化时，同步更新 `LOOP.md`。
- `README.md` 是人类手动配置和 agent 上手拷问指南。
- `LOOP.md` 是 agent 执行 loop 的最新运行地图和索引，不承载节点细则。
- `modules/*` 是 loop 节点的文本事实源。
- `canvas/*` 是可视化视图。
- `app/*` 是基于 `@xyflow/react` 的自研前端视图层，读取生成的 `workflow-data.json`。
- `skills/`、`plugins/`、`agents/` 是依赖索引。
- `tools/*` 只是薄辅助层，不是 workflow runtime。

## 隔离规则

- 不导入调用方项目的规则、prompt、草稿、平台数据、账号设置或 AGENTS 文件。
- 不硬编码微信、Obsidian、Twitter/X、Bilibili、newsletter、SEO 等业务流程。
- 不提交 `.env`、凭证、API key、cookies、浏览器 profile 或生成的 run state。
- `.runs/` 只保存本地执行状态，不进入版本库。

## 目录边界

- `LOOP.md`：全局地图、节点索引、边索引、状态策略和维护协议。
- `modules/`：纯文本 loop 节点，不是源码包。
- `schemas/`：节点 JSON artifact 的结构校验，不放业务样本或真实数据。
- `fixtures/`：可提交的合成调试输入，只用于 dry-run 数据流验证。
- `canvas/`：流程图和画布视图，不能替代 `LOOP.md`。
- `app/`：控制平面前端，只读展示 workflow，不替代 `LOOP.md`；右侧 Codex CLI 面板默认 read-only。
- `skills/`、`plugins/`、`agents/`：registry，不复制外部工具的大段说明。
- `tools/`：validate / sync / export / scaffold / dev server 这类薄辅助。
- `tests/`：工具层测试。
- `docs/`：较长设计说明，不得替代 `LOOP.md`。

## 节点规则

每个 `modules/<node>/` 必须包含：

- `AGENTS.md`
- `NODE.md`
- `SYSTEM.md`
- `CONTRACT.md`
- `GATE.md`

修改节点细则时，只改对应节点文件夹；修改节点图或路由时，同步更新 `LOOP.md`、`canvas/loop.mmd` 和 `app/workflow-data.json`。

## 实施规则

- 改 tools 行为前先加测试。
- gate 必须可确定性判定。
- prompt / LLM 节点必须显式，不要把模型调用藏进工具代码。
- durable run state 写入 `.runs/`，不要把每次运行结果写回 `LOOP.md`。
- 增加业务 loop 时，优先新增 `modules/<node>/` 五件套，并同步 `LOOP.md` Node/Edge Index。

## 验证

完成前运行：

```powershell
npm run validate
npm run export:app
npm test
```
