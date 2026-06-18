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

skills/registry.md
plugins/registry.md
agents/registry.md
  - 记录 loop 依赖的 skill / plugin / subagent

.env.example
  - 可公开的环境变量名
```

`tools/` 只放通用辅助脚本，不承载业务语义。当前 v1 的工具只做 validate / sync / export / scaffold / dev server。
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
npm test
```

这些命令只检查和维护文本 harness，不执行业务工作流。`npm run dev` 会启动前端和本地 Codex bridge；只有你在右侧面板点击 Send 时才会调用 `codex exec`。

## 当前仓库状态

现在仓库只有一个最小 harness 骨架：

- `LOOP.md`：当前架构地图和索引。
- `AGENTS.md`：根 agent 约束。
- `modules/00_intake/`：当前唯一已初始化节点，用来拷问需求并更新 loop 配置。
- `canvas/`：流程图和人类画布视图。
- `app/`：自研控制平面前端。
- `skills/`、`plugins/`、`agents/`：依赖 registry。
- `tools/`：薄辅助工具，只做校验、同步和节点脚手架。
- `tests/`：工具层测试。

当前还没有真实业务 loop。人类上手时，第一步不是运行代码，而是让 agent 根据本 README 和 `00_intake` 开始追问，并把答案沉淀进正确的事实源。
