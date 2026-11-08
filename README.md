# writing-loop-harness

这是一个给 agent 使用的 workflow harness 仓库。

它不是前端/后端项目，也不是给人直接点按钮运行的应用。它是一个以文本文件为事实源的 Agent 工作流控制平面：`LOOP.md` 定义图，`modules/*` 定义节点，`GATE.md` 定义检查点，agent 作为执行引擎按图运行。

## 这个 README 的用途

README 是两类入口：

- **给人手动配置的引导**：告诉人要准备哪些信息、哪些文件可以改、哪些内容不要写进仓库。
- **给 agent 的使用引导**：告诉 agent 接手后如何拷问人类、如何初始化 loop、如何持续维护 `LOOP.md`。

真正的运行架构地图是 `LOOP.md`，但节点细则不写在 `LOOP.md`。任何 loop 结构、节点索引、边索引、状态策略、skills/plugins/agents 策略发生变化，都要同步更新 `LOOP.md`；单个节点的 prompt、契约、gate 细则则写进对应 `modules/<node>/`。

## 人类怎么配置

先不要急着写复杂 prompt。先把需求按下面这些问题准备出来，agent 会逐项追问并写入 `LOOP.md` 或对应节点文件：

1. 这个 loop 的目标是什么？
2. 每轮 loop 的输入是什么？
3. 每轮 loop 的输出是什么？
4. loop 分哪些节点？
5. 节点之间怎么路由？
6. 哪些节点需要模型？
7. 哪些节点必须人工确认？
8. 每个节点失败时怎么办？
9. 需要哪些 skills / plugins / agents？
10. 需要哪些环境变量？

不要把真实 key、账号资料、cookies、浏览器 profile、平台后台数据写进仓库。真实密钥只写本地 `.env`。

## Agent 接手流程

Agent 进入这个仓库后，按这个顺序工作：

1. 读 `AGENTS.md`。
2. 读 `LOOP.md`。
3. 读本 README。
4. 检查当前目录结构。
5. 进入 `LOOP.md` 标明的 active node。
6. 读取该节点的 `AGENTS.md`、`NODE.md`、`SYSTEM.md`、`CONTRACT.md`、`GATE.md`。
7. 判断当前配置是否已经能完整指导一轮任务。
8. 如果不能，开始拷问人类。

拷问规则：

- 一次只问一个关键问题。
- 不问能从文件里看出来的问题。
- 每个问题都必须能改变 `LOOP.md`、节点契约或执行策略。
- 不替人自作主张确定业务目标、发布边界、模型选择、失败策略。
- 得到答案后，把稳定结论写入合适的事实源：全局图写 `LOOP.md`，节点细则写 `modules/<node>/`。

## 初始化一个 loop

当人类说“初始化这个 loop”时，agent 应该产出这些文件或章节：

```text
LOOP.md
  - Workflow Goal
  - Current Graph
  - Node Index
  - Edge Index
  - Runtime Policy
  - State Policy
  - Capability Registries
  - Current Configuration Status

modules/<node>/
  - AGENTS.md：节点级行为约束
  - NODE.md：节点职责、读写顺序、执行步骤
  - SYSTEM.md：该节点的系统提示词
  - CONTRACT.md：输入、输出、产物、状态契约
  - GATE.md：该节点 pass / pause / fail / route 条件

canvas/
  - loop.mmd：从 LOOP.md 派生的 Mermaid 图
  - loop.canvas：人类自由画布视图，不能替代 LOOP.md

app/
  - 基于 @xyflow/react 的自研前端视图层
  - 读取生成的 workflow-data.json
  - 右侧提供本机 Codex CLI Agent 对话面板

schemas/
  - 节点 JSON artifact 的结构校验
  - 命名规则：<node-id>.<artifact-name>.schema.json

fixtures/
  - 可提交的合成调试输入
  - 只用于 dry-run 数据流验证，不代表真实热点或账号数据

skills/registry.md
plugins/registry.md
agents/registry.md
  - 记录 loop 依赖的 skill / plugin / subagent

.env.example
  - 可公开的环境变量名
```

`tools/` 只放通用辅助脚本，不承载业务语义。当前工具支持 validate / sync / export / scaffold / dev server / run state runner。
`canvas/` 只用于可视化管理，`LOOP.md` 和 `modules/*` 才是事实源。
`app/` 只用于查看控制平面，不能手写 workflow 事实。右侧 Codex CLI 面板通过本地 Vite bridge 调用 `codex exec`。本机 Windows read-only sandbox 可能不可用，默认以 `CODEX_BRIDGE_SANDBOX` 或 `danger-full-access` 启动，并通过提示词约束只读不改文件。

## 修改一个已有 loop

当人类说“改 loop”或“调整某个节点”时，agent 应该：

1. 读 `LOOP.md` 当前地图。
2. 找到对应节点或约束。
3. 追问缺失的业务决策。
4. 更新对应模块文档。
5. 如果节点图变化，更新 `LOOP.md` 的 Node/Edge Index。
6. 运行 `npm run validate`。
7. 如图变化，运行 `npm run sync:canvas`。

不要只改某个 prompt，而忘记 `LOOP.md`。`LOOP.md` 是让后续 agent 不迷路的总图。

## .env 使用

`.env.example` 只声明变量名，不放真实值。

本地实验时复制：

```powershell
Copy-Item .env.example .env
```

常见变量：

```text
WRITING_LOOP_PROVIDER=
WRITING_LOOP_DEFAULT_MODEL=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
ANTHROPIC_API_KEY=
WRITING_LOOP_TIMEOUT_MS=
```

如果某个模块需要额外 key，先写进 `.env.example`，再在对应节点 `CONTRACT.md` 和 registry 中说明用途。

## 工具命令

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

`run:step` 默认 dry-run，只验证 prompt 组装、gate 记录和路由。显式加 `--exec` 才会调用本机 `codex exec` 执行当前节点。

`npm run dev` 会启动前端和本地 Codex bridge；只有你在右侧面板点击 Send 时才会调用 `codex exec`。

## 试跑一个 loop

先启动前端：

```powershell
npm run dev
```

再跑 dry-run，确认控制平面能走通：

```powershell
npm run run:start -- --run smoke-001 --node 10_hotspot_scan
npm run run:step -- --run smoke-001 --outcome pass
npm run run:inspect -- --run smoke-001
```

预期结果：

- `.runs/smoke-001/manifest.json` 存在；
- `.runs/smoke-001/events.jsonl` 存在；
- `.runs/smoke-001/nodes/10_hotspot_scan/prompt.md` 存在；
- `.runs/smoke-001/nodes/10_hotspot_scan/gate-result.json` 存在；
- manifest 里的 `currentNode` 变成 `20_topic_gate`。
- 前端画布顶部显示最新 run；
- `10_hotspot_scan` 节点显示 `pass`；
- `20_topic_gate` 节点显示 `current`；
- `10_hotspot_scan / pass -> 20_topic_gate` 边加粗高亮。
- 前端顶部显示最近过程事件，如 `prompt_assembled`、`gate_recorded`、`routed`。

如果 gate JSON 里声明了 artifact，例如：

```json
{
  "outcome": "pass",
  "reason": "candidate scan complete",
  "artifacts": ["candidates.json"]
}
```

runner 会查找：

```text
schemas/10_hotspot_scan.candidates.schema.json
```

有匹配 schema 时，校验结果会写进 `gate-result.json` 的 `artifactValidation` 字段。

要让本机 Codex 真执行当前节点：

```powershell
npm run run:start -- --run live-001 --node 10_hotspot_scan
npm run run:step -- --run live-001 --exec
```

真实执行仍然只写 `.runs/<run-id>/`。如果节点缺少真实 source registry、writer adapter、image provider 或必要人工决策，正确 outcome 应该是 `pause`，而不是硬编业务结果。

## 试跑数据流

用合成 fixture 跑到资料采集：

```powershell
npm run run:start -- --run data-demo-001 --node 10_hotspot_scan
npm run run:step -- --run data-demo-001 --fixture fixtures/hotspot-candidates.demo.json
npm run run:step -- --run data-demo-001
npm run run:step -- --run data-demo-001 --fixture fixtures/source-inventory.demo.json
npm run run:inspect -- --run data-demo-001
```

预期结果：

- `10_hotspot_scan` 写入 `.runs/data-demo-001/nodes/10_hotspot_scan/candidates.json`；
- `10_hotspot_scan` 的 `gate-result.json` 里 `artifactValidation[0].ok` 为 `true`；
- `20_topic_gate` 读取上游 `candidates.json`；
- `20_topic_gate` 写入 `topic-scorecard.json` 和 `selected-topic.md`；
- `topic-scorecard.json` 通过 `schemas/20_topic_gate.topic-scorecard.schema.json` 校验；
- `30_source_collect` 读取上游 `topic-scorecard.json`；
- `30_source_collect` 写入 `source-inventory.json`、`source-inventory.md` 和 `source-gaps.md`；
- `source-inventory.json` 通过 `schemas/30_source_collect.source-inventory.schema.json` 校验；
- 前端能看到三步路由和过程事件。

## 当前仓库状态

现在仓库是一个可校验、可视化、可 dry-run 路由的热点写作 harness：

- `LOOP.md`：当前架构地图和索引。
- `AGENTS.md`：根 agent 约束。
- `modules/*`：热点写作 loop 的 8 个节点。
- `schemas/`：节点 JSON artifact schema。
- `fixtures/`：合成调试输入。
- `canvas/`：流程图和人类画布视图。
- `app/`：自研控制平面前端。
- `skills/`、`plugins/`、`agents/`：依赖 registry。
- `tools/`：薄辅助工具，包含校验、同步、节点脚手架和最小 runner。
- `tests/`：工具层测试。

当前还没有绑定真实 source registry、writer adapter、image provider 或调用方内容仓路径。人类上手时，第一步是 dry-run 控制流；第二步才是把真实输入源逐个接进对应节点契约。
