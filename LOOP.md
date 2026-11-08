# LOOP.md

> 本文件是 workflow control-plane manifest：它描述当前图、索引、全局策略和配置状态。节点细则不写在这里，必须下沉到 `modules/*`。

## 定位

`writing-loop-harness` 是一个以文本文件为事实源的 Agent 工作流控制平面。

- `LOOP.md` 定义当前 workflow 地图、节点索引、边索引和全局维护协议。
- `modules/*` 定义节点本地 harness，是每个环节的细则事实源。
- `GATE.md` 定义节点检查点和路由 outcome。
- `schemas/*` 定义节点 JSON artifact 的结构校验，不承载业务样本。
- `fixtures/*` 提供可提交的合成调试输入，用于 dry-run 数据流验证。
- agent 是执行引擎，按图进入 active node 并读取节点本地文件。
- `tools/*` 只是薄辅助层，用于校验结构、同步可视化投影、创建节点五件套。
- `app/*` 是基于 `@xyflow/react` 的自研前端视图层，用来查看控制平面，不是事实源。

本仓库必须独立于任何内容库、发布账号仓库、Obsidian 库、社媒运营项目或历史草稿语料。业务数据、历史草稿、账号资料、cookies、真实 API key 只能存在调用方项目或本地 `.env`。

## Workflow Goal

当前业务 loop：AI/科技热点写作工作流。

目标是在冷启动阶段保护有限推荐流，把每日写作产能集中到高互动、高分享、强冲突或强现实影响的 AI/科技热点上。论文源、arXiv、纯 benchmark、纯方法名默认降到最低优先级，只作为资料池；除非它们已经被社区、媒体或产品事件带起来，否则不进入主发文候选。

输出只到 reviewable article package，不发布、不推后台草稿、不改账号设置。

## Current Graph

```mermaid
flowchart TD
  intake["00_intake<br/>需求拷问与配置初始化"]
  scan["10_hotspot_scan<br/>6h 热点候选扫描"]
  topic["20_topic_gate<br/>选题准入与日预算门禁"]
  collect["30_source_collect<br/>一手资料采集"]
  analysis["40_evidence_analysis<br/>L1/L2/L3 公共分析"]
  draft["50_draft_package<br/>待审文章包"]
  visual["60_visual_plan<br/>配图与占位规划"]
  handoff["70_review_handoff<br/>人工审核交接"]
  human["HUMAN"]
  end["END"]

  intake -->|pass| scan
  intake -->|pause| human
  intake -->|fail| end
  scan -->|pass| topic
  scan -->|pause| human
  scan -->|fail| end
  topic -->|pass| collect
  topic -->|pause| human
  topic -->|fail| end
  collect -->|pass| analysis
  collect -->|pause| human
  collect -->|fail| end
  analysis -->|pass| draft
  analysis -->|pause| collect
  analysis -->|fail| end
  draft -->|pass| visual
  draft -->|pause| human
  draft -->|fail| end
  visual -->|pass| handoff
  visual -->|pause| handoff
  visual -->|fail| handoff
  handoff -->|pass| end
  handoff -->|pause| human
  handoff -->|fail| end
```

## Node Index

| Node                 | Folder                          | Purpose           | Gate                                   |
| -------------------- | ------------------------------- | ----------------- | -------------------------------------- |
| 00_intake            | `modules/00_intake/`            | 需求拷问与配置初始化        | `modules/00_intake/GATE.md`            |
| 10_hotspot_scan      | `modules/10_hotspot_scan/`      | 扫描 6h AI/科技社区热点候选 | `modules/10_hotspot_scan/GATE.md`      |
| 20_topic_gate        | `modules/20_topic_gate/`        | 选题准入、论文源降权、单日节流   | `modules/20_topic_gate/GATE.md`        |
| 30_source_collect    | `modules/30_source_collect/`    | 采集一手资料与可信二手来源     | `modules/30_source_collect/GATE.md`    |
| 40_evidence_analysis | `modules/40_evidence_analysis/` | 生成 L1/L2/L3 公共分析  | `modules/40_evidence_analysis/GATE.md` |
| 50_draft_package     | `modules/50_draft_package/`     | 生成待审文章包           | `modules/50_draft_package/GATE.md`     |
| 60_visual_plan       | `modules/60_visual_plan/`       | 生成配图方案和占位图计划      | `modules/60_visual_plan/GATE.md`       |
| 70_review_handoff    | `modules/70_review_handoff/`    | 输出人工审核交接          | `modules/70_review_handoff/GATE.md`    |

## Edge Index

| From                 | Outcome | To                   | Meaning                      |
| -------------------- | ------- | -------------------- | ---------------------------- |
| 00_intake            | pass    | 10_hotspot_scan      | loop 配置足够，开始热点扫描             |
| 00_intake            | pause   | HUMAN                | 需要人类补充配置决策                   |
| 00_intake            | fail    | END                  | 初始化终止或事实源损坏                  |
| 10_hotspot_scan      | pass    | 20_topic_gate        | 存在可评估候选                      |
| 10_hotspot_scan      | pause   | HUMAN                | 候选太弱、全是论文源、或需要 fallback 决策   |
| 10_hotspot_scan      | fail    | END                  | 没有可读候选来源                     |
| 20_topic_gate        | pass    | 30_source_collect    | 选出一个值得消耗本轮产能的题               |
| 20_topic_gate        | pause   | HUMAN                | 无题过线、日预算已满、或需人工拍板            |
| 20_topic_gate        | fail    | END                  | 候选 artifact 缺失或不可读           |
| 30_source_collect    | pass    | 40_evidence_analysis | 资料足够进入公共分析                   |
| 30_source_collect    | pause   | HUMAN                | 缺关键一手来源或需授权采集                |
| 30_source_collect    | fail    | END                  | 无可靠来源支撑                      |
| 40_evidence_analysis | pass    | 50_draft_package     | L1/L2/L3 边界清楚，可写稿            |
| 40_evidence_analysis | pause   | 30_source_collect    | 可补的一手资料缺口必须先补采               |
| 40_evidence_analysis | fail    | END                  | 证据不足以支撑有用文章                  |
| 50_draft_package     | pass    | 60_visual_plan       | 待审文章包已形成                     |
| 50_draft_package     | pause   | HUMAN                | 结构、writer adapter 或关键事实需人类确认 |
| 50_draft_package     | fail    | END                  | 无法从公共分析安全成稿                  |
| 60_visual_plan       | pass    | 70_review_handoff    | 配图方案/占位计划可交审                 |
| 60_visual_plan       | pause   | 70_review_handoff    | 图片 pending，但可作为待补图交接         |
| 60_visual_plan       | fail    | 70_review_handoff    | 配图失败，记录 blocker 后交接          |
| 70_review_handoff    | pass    | END                  | reviewable package 已交接       |
| 70_review_handoff    | pause   | HUMAN                | 发布、上传或外部写入需人工授权              |
| 70_review_handoff    | fail    | END                  | 必要文章 artifact 缺失             |

## Runtime Policy

Agent 接手后按这个顺序行动：

1. 读根 `AGENTS.md`。
2. 读本文件，确认 workflow 地图和当前配置状态。
3. 根据 active node 进入 `modules/<node>/`。
4. 依次读该节点的 `AGENTS.md`、`NODE.md`、`SYSTEM.md`、`CONTRACT.md`、`GATE.md`。
5. 只在节点契约内产出声明过的 artifacts。
6. 根据 `GATE.md` outcome 和本文件 `Edge Index` 路由。

不要从聊天历史里猜 workflow。`LOOP.md` 和 `modules/*` 才是事实源。

## Hotspot Policy

- 论文源最低优先级：paper-only / arXiv-only / benchmark-only / method-name-only 默认只作背景资料。
- 6h 社区热点优先：社区讨论、转发势能、争议、产品影响和用户痛点优先。
- 单日节流：默认每天只推进 1 篇主稿，最多 2 篇可发布稿。
- 热点优先于去 AI 味：先保证选题传播性，再做句层修正。
- 只产出待审稿：发布、上传、推草稿、改账号设置均不在本 loop 内自动执行。

## State Policy

`LOOP.md` 描述配置状态，不记录每次运行细节。

每次执行状态写入 `.runs/<run-id>/`：

```text
.runs/<run-id>/
  manifest.json
  current-node.md
  events.jsonl
  nodes/<node-id>/
    prompt.md
    stdout.md
    stderr.md
    final.md
    gate-result.json
    gate-result.md
    artifacts/
    notes.md
```

规则：

- `.runs/` 不提交 git。
- active node、gate 结果、产物路径、恢复提示写入 run state。
- 过程事件追加写入 `events.jsonl`，用于调试 prompt 组装、执行、gate 记录和路由。
- 节点 JSON artifact 如有匹配的 `schemas/<node-id>.<artifact-name>.schema.json`，runner 必须记录校验结果。
- `fixtures/` 只能用于本地 dry-run，不代表真实热点、账号数据或发布依据。
- 修改 workflow 结构时才更新 `LOOP.md`。
- 修改节点细则时只更新对应 `modules/<node>/`。

## Capability Registries

能力依赖只做索引，不复制外部工具的大段说明：

- `skills/registry.md`
- `plugins/registry.md`
- `agents/registry.md`

节点如需使用 skill/plugin/subagent，必须在节点 `CONTRACT.md` 写明，并在对应 registry 登记。

## View Projection

`canvas/` 和 `app/` 是视图层，不是事实源：

- `canvas/loop.mmd` 是从本文件 Node/Edge Index 派生的 Mermaid 图。
- `canvas/loop.canvas` 是人类自由画布视图。
- `app/workflow-data.json` 由 `tools/export-workflow.mjs` 生成，供 `@xyflow/react` 前端读取。
- 前端右侧 Codex CLI 面板通过 Vite 本地 bridge 调用 `codex exec`，不替代主 agent 会话。本机 Windows read-only sandbox 可能不可用，默认以 `CODEX_BRIDGE_SANDBOX` 或 `danger-full-access` 启动，并通过提示词约束只读不改文件。
- 前端通过 `/api/runs/latest` 只读投影 `.runs/<run-id>/manifest.json` 和 `events.jsonl`，用于显示节点状态、当前节点、最近路由、过程事件和 gate outcome 颜色；这些反馈不是 workflow 事实源。
- 如果视图层和本文件冲突，以本文件和 `modules/*` 为准。

## Tools

```powershell
npm run validate
npm run sync:canvas
npm run export:app
npm run dev
npm run scaffold:node -- <node-id> "<Node Title>"
npm run run:start -- --run <run-id> --node <node-id>
npm run run:step -- --run <run-id>
npm run run:step -- --run <run-id> --fixture fixtures/hotspot-candidates.demo.json
npm run run:step -- --run <run-id> --exec
npm run run:inspect -- --run <run-id>
npm test
```

工具层不得：

- 默认不得自动调用模型。`run:step` 默认 dry-run；只有显式 `--exec` 才可调用本机 Codex CLI；
- 写平台账号/发布流程；
- 成为 workflow 事实源；
- 替代 agent 执行节点任务。

## Current Configuration Status

- active_node: `modules/10_hotspot_scan/`
- initialized_nodes: `00_intake`, `10_hotspot_scan`, `20_topic_gate`, `30_source_collect`, `40_evidence_analysis`, `50_draft_package`, `60_visual_plan`, `70_review_handoff`
- business_loop: AI/科技热点写作
- human_gate_required: true when gate outcome is `pause`
- runner_policy: `agent-executed-text-harness`
- publish_policy: `never publish automatically`

当前 loop 已配置为热点写作工作流，但尚未绑定真实 source registry、writer adapter、image provider 或调用方内容仓路径。

## Maintenance Rules

以下变化必须同步更新本文件：

- 新增、删除、重命名节点；
- 节点路由 outcome 变化；
- Node Index 或 Edge Index 变化；
- 状态策略变化；
- registry 策略变化；
- tools 命令变化。

以下变化不应写进本文件正文：

- 节点详细 prompt；
- 节点执行步骤细节；
- 节点输入输出长契约；
- gate 判定细则；
- 业务样本、账号信息、平台后台数据、密钥。
