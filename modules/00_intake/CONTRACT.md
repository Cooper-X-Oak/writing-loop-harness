# CONTRACT

## 输入契约

`00_intake` 接受：

- 人类目标描述；
- 现有 loop 文件；
- 现有模块结构；
- 可用模型/API 信息；
- 可用 skills/plugins/agents 信息。

## 输出契约

必须输出或更新：

- `LOOP.md` 的目标、节点图、节点索引、边索引、配置状态；
- 新增/修改节点的标准文件；
- `.env.example` 中需要公开声明的变量名；
- registry 中需要登记的 skills/plugins/agents；
- 未解决问题清单。

运行中的 active node、gate 结果、产物路径和恢复提示写入 `.runs/<run-id>/`，不要反复写回 `LOOP.md`。

## 不允许输出

- 真实 API key；
- cookies；
- 平台账号后台数据；
- 未经人类确认的业务目标；
- 未经人类确认的发布/外部写入动作。
