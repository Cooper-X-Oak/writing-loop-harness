# GATE

## Outcomes

- pass
- pause
- fail

## Pass

`00_intake` 通过条件：

- loop 目标一句话可复述；
- 每轮输入清楚；
- 每轮输出清楚；
- 当前节点图存在于 `LOOP.md`；
- active node 已标明；
- 每个已创建节点都有标准文件；
- 每个已创建节点有输入、输出、gate；
- 需要的模型/API 变量已写入 `.env.example`；
- 需要的 skills/plugins/agents 已写入 registry；
- 未解决问题不会阻塞下一步。

## Pause

暂停并继续拷问人类：

- 目标不清：继续问人类；
- 输入/输出不清：继续问人类；
- 节点边界不清：提出 2 到 3 个可选拆法让人类选；
- 涉及外部写入/发布：必须暂停并要求明确授权；
- 需要密钥：只更新 `.env.example`，提醒人类本地写 `.env`。

## Fail

仅当文件结构损坏、必要事实源缺失、或人类要求停止该 loop 初始化时，标记为 fail。
