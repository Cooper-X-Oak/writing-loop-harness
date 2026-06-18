# 00_intake

## 目的

把人类的模糊意图转成可执行 loop 配置。

## 何时进入

- 初始化一个新 loop 时；
- 人类要求调整 loop 结构时；
- `LOOP.md` 不足以指导下一轮执行时；
- 节点、输入、输出、gate、模型、skills/plugins/agents 映射不清楚时。

## 输入

- 人类的自然语言意图；
- 当前 `LOOP.md`；
- 当前模块目录；
- 当前 `.env.example`；
- 当前 `skills/`、`plugins/`、`agents/` registry。

## 输出

- 更新后的 `LOOP.md`；
- 必要时新增或修改 `modules/<node>/`；
- 必要时更新 `.env.example`；
- 必要时更新 `skills/registry.md`、`plugins/registry.md`、`agents/registry.md`；
- 当前仍未解决的问题列表。

## 下游

当 intake gate 通过后，根据 `LOOP.md` 中的新节点图进入下一个 active node。

