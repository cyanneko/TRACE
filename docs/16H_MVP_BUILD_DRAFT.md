# TRACE 16 小时初版开发草稿

> Thread Reasoning, Action, Context & Execution

日期：2026-08-26  
时间口径：16 小时为纯开发时间，不包含睡眠。  
交付目标：可在真实 iPhone 上通过 Expo Go 跑通的独立 Agent MVP，并保留本地可复现测试方式。

## 1. 一句话方案

TRACE 初版采用两段式 Agent 工作流：

1. 用户上传聊天截图并补充文字，DeepSeek Vision 结合精简后的联系人索引生成上下文理解和可编辑 action cards。
2. 用户确认后，App 调用 iOS Contacts/Calendar 工具执行动作，把确定事实写入设备端结构化 memory，再生成引用联系人历史和本次执行结果的洞察与建议。

这版不做完整云端账号、联系人同步和向量数据库。移动端负责敏感数据、执行和 memory，API 保持无状态，只承担模型推理。这样可以在 16 小时内把 Agent 闭环做完整，同时减少隐私和部署复杂度。

## 2. 16 小时后的验收画面

现场演示应能连续完成下面的流程：

1. 打开名为 **TRACE** 的 iOS App。
2. 从相册选择一张聊天截图，附加一句补充信息。
3. App 展示识别出的聊天摘要、参与人和证据片段。
4. App 生成 0 到 3 张 action cards：
   - 创建会议
   - 创建联系人
   - 更新联系人
5. 用户可以编辑字段、取消某张卡或确认执行。
6. 确认后，App 在获得权限时真实写入 iOS 联系人或日历。
7. 每次执行产生可见的成功或失败结果，不静默假装成功。
8. 已确认事实写入本地 memory，并保留来源、时间和状态。
9. Agent 基于截图、联系人、历史 memory 和工具执行结果，生成 1 到 3 条具体洞察或下一步建议。
10. 再上传一张与同一联系人相关的截图时，建议能引用上一轮保存的信息，证明 memory 真正在工作。

初版的关键不是 UI 数量，而是上述闭环完整、可解释、可重复。

## 3. 范围冻结

### P0：必须完成

- Expo React Native iOS App，产品名为 `TRACE`。
- 截图选择、预览和可选补充文字。
- `deepseek-v4-flash-vision-exp` 真实调用。
- 严格校验的 conversation/action card 输出。
- 三类 action card 的展示、编辑、选择、确认和拒绝。
- 用户确认前零副作用。
- iOS Contacts/Calendar 工具适配器。
- 无原生权限时可明确切换到本地 Demo executor，不能伪装成系统写入。
- 结构化 memory 的写入、检索、更新、删除和来源展示。
- 确认后 insight 生成。
- 确定性的 fixture provider，模型或网络故障时仍能演示完整产品流程。
- README、`.env.example`、启动脚本和最小自动测试。

### P1：主链路完成后再做

- 独立 Memory 页面。
- 分析历史列表。
- API 云部署。
- EAS preview build。
- 分享建议文字到系统分享面板。
- 更精细的 loading animation 和空状态。

### 本轮明确不做

- 登录、注册、多用户或团队协作。
- Supabase、云端联系人同步和服务端长期 memory。
- embedding、pgvector 或语义搜索。
- iOS Share Extension。
- 推送通知和后台任务。
- 通用聊天助手界面。
- App Store/TestFlight 正式发布。
- 模型自主执行工具。
- 多图、视频或聊天平台账号直连。

## 4. 为什么它仍然是 Agent，而不是 API 套壳

初版包含一个明确的状态机，而不是“图片进去、文本出来”：

```text
draft
  -> analyzing
  -> awaiting_confirmation
  -> executing
  -> curating_memory
  -> generating_insights
  -> completed

任一步也可以进入 failed，并从最近的安全状态重试。
```

Agent 的职责边界：

- **Perception**：从截图中抽取参与人、消息、承诺、时间和不确定项。
- **Grounding**：将截图中的人物与联系人索引、已有 memory 对齐。
- **Planning**：提出有证据的 action cards，但不执行。
- **Confirmation**：以用户编辑后的卡片作为唯一执行输入。
- **Execution**：调用 Contacts/Calendar 工具并记录真实结果。
- **Memory curation**：只将用户确认和工具验证过的事实固化。
- **Advising**：结合历史和结果给出下一步建议，并说明依据。

模型不能绕过 confirmation 状态，也不能直接调用产生副作用的工具。

## 5. 技术架构

```text
Expo iOS App
  |- Screenshot picker + optional note
  |- Contact index reader
  |- Agent run state machine
  |- Action card editor
  |- NativeActionExecutor
  |    |- expo-contacts
  |    `- expo-calendar
  |- DemoActionExecutor
  |- SQLite memory + run/event log
  `- Insight/result UI
            |
            | HTTPS
            v
Stateless TypeScript API
  |- POST /v1/analyze
  |- POST /v1/insights
  |- GET  /health
  |- Zod validation + one repair attempt
  |- DeepSeekProvider
  `- FixtureProvider
            |
            v
deepseek-v4-flash-vision-exp
```

推荐技术选择：

- Monorepo：npm workspaces。
- Mobile：Expo、React Native、TypeScript、Expo Router、TanStack Query。
- Native tools：`expo-image-picker`、`expo-contacts`、`expo-calendar`。
- Local data：`expo-sqlite`。
- API：Fastify、`@fastify/multipart`、Zod、OpenAI-compatible SDK。
- Tests：Vitest。

不在首版引入状态管理框架。Agent run 使用 reducer/state machine，服务端状态用 TanStack Query，本地持久化直接封装 SQLite repository。

## 6. 项目目录草案

```text
TRACE/
  apps/
    mobile/
      app/
        index.tsx
        review.tsx
        result.tsx
        memory.tsx
      src/
        agent/runReducer.ts
        api/client.ts
        components/ActionCard.tsx
        executors/nativeExecutor.ts
        executors/demoExecutor.ts
        memory/repository.ts
        memory/policy.ts
    api/
      src/
        index.ts
        routes/analyze.ts
        routes/insights.ts
        providers/deepseek.ts
        providers/fixture.ts
        prompts/analyze.ts
        prompts/insights.ts
  packages/
    contracts/
      src/index.ts
      src/schemas.ts
  fixtures/
    meeting/
    new-contact/
    update-contact/
    no-action/
  docs/
  .env.example
  package.json
```

## 7. 两次模型调用

### 调用一：理解、联系人匹配和行动规划

`POST /v1/analyze`

输入：

- 压缩后的截图。
- 用户补充文字。
- 联系人精简索引：`id/name/company/phones/emails`。
- 与已知联系人关联的 active memories。
- 当前时区和当前时间。

输出：

```ts
type AnalyzeResult = {
  runId: string;
  thread: {
    summary: string;
    participants: Array<{
      displayName: string;
      contactId?: string;
      confidence: number;
    }>;
    evidence: Array<{
      id: string;
      quote: string;
    }>;
    uncertainties: string[];
  };
  actionCards: ActionCard[];
};
```

为了控制延迟，首版把 OCR/上下文抽取、grounding 和 action planning 合并为一次视觉模型调用。服务端使用 Zod 校验；失败时只做一次 JSON repair，第二次失败就返回结构化错误，不循环消耗时间和 token。

### 调用二：确认后的洞察

`POST /v1/insights`

输入：

- 第一阶段 thread 摘要和 evidence。
- 用户最终确认过的 action cards。
- 每个工具的真实执行结果。
- 本轮写入的 memory。
- 相关联系人的已有 active memories，最多 12 条。

输出：

```ts
type InsightBundle = {
  insights: Array<{
    title: string;
    body: string;
    importance: "high" | "medium" | "low";
    evidenceRefs: string[];
    nextStep?: string;
    suggestedMessage?: string;
  }>;
  unresolvedQuestions: string[];
};
```

每条 insight 必须引用当前截图证据、确认行动或 active memory。证据不足时允许返回空 insights 和一个待确认问题，不允许用泛泛建议填满界面。

## 8. Action Card 约束

所有卡片共享：

- `id`
- `type`
- `title`
- `confidence`
- `evidenceRefs`
- `editableFields`
- `riskFlags`
- `selected`
- `payload`

创建会议：

- 标题、开始时间、结束时间、参与人、备注。
- 时间不完整时必须设置 `needs_time_confirmation`，不能猜一个日期直接执行。

创建联系人：

- 姓名、公司、职位、电话、邮箱、备注。
- 姓名缺失时不能执行。

更新联系人：

- 明确的 `contactId`。
- `changes` 必须展示旧值和新值。
- 匹配不唯一时只能保持 proposed，用户选定联系人后才能确认。

UI 上每张卡显示证据和将要写入的位置；编辑后重新通过客户端 Zod schema，再进入执行状态。

## 9. 联系人与日历执行

定义统一接口：

```ts
interface ActionExecutor {
  createMeeting(card: CreateMeetingCard): Promise<ToolResult>;
  createContact(card: CreateContactCard): Promise<ToolResult>;
  updateContact(card: UpdateContactCard): Promise<ToolResult>;
}
```

提供两个实现：

- `NativeActionExecutor`：通过 Expo Contacts/Calendar 写入真实 iOS 数据。
- `DemoActionExecutor`：写入本地 SQLite，供 Web、权限拒绝和自动测试使用。

执行原则：

- App 必须先展示系统权限请求。
- 权限拒绝时明确提示“保存到 TRACE 本地”，由用户再次确认是否降级。
- 每个动作使用 action card ID 作为幂等键，避免重试造成重复联系人或会议。
- 工具结果包含 `success/provider/externalId/error`。
- 只有成功执行的动作可以生成 active memory；失败动作保留 event log，不写成已完成事实。

## 10. Memory 初版设计

Memory 是本项目的重点，但首版不使用向量库。SQLite 中只保存结构化、可追踪的信息。

```ts
type MemoryEntry = {
  id: string;
  contactId?: string;
  type: "contact_fact" | "preference" | "open_loop" | "relationship_fact";
  key: string;
  value: unknown;
  status: "candidate" | "active" | "superseded" | "deleted";
  sourceRunId: string;
  sourceActionId?: string;
  sourceEvidenceRefs: string[];
  confidence: number;
  createdAt: string;
  updatedAt: string;
};
```

写入策略：

- 用户确认且工具执行成功的联系人字段直接写为 `active`。
- 联系人字段更新时，将相同 `contactId + key` 的旧 memory 标为 `superseded`。
- 创建会议后写入一个 `open_loop`，记录参与人、时间和 calendar event ID。
- 模型推断出的偏好或关系只能是 `candidate`，首版不自动用于未来行动。
- 用户可以删除 memory；删除后后续 prompt 不再检索它。

检索策略：

1. 优先使用 action card 中的明确 contact ID。
2. 其次使用参与人姓名和别名精确匹配。
3. 只取 `active`。
4. `open_loop` 和最近更新的事实优先。
5. 单次最多送入 12 条，避免把整个历史重新塞给模型。

为了证明 memory 有效，至少准备一个两轮 fixture：第一轮确认联系人职位或会议，第二轮截图中 Agent 能引用这条历史并给出不同建议。

## 11. UI 初版

### Capture

- 顶部显示 TRACE。
- 截图选择区和预览。
- 一行可选补充文字。
- `Analyze` 主按钮。
- 权限状态只在需要时出现。

### Review

- 截图缩略图和一段 thread summary。
- 参与人匹配结果。
- Action cards 列表。
- 每张卡可以选择、编辑、查看证据。
- 底部固定确认按钮，显示将执行的动作数。

### Result

- 每个动作的真实执行状态。
- 洞察和建议按重要性排序。
- 建议回复支持复制。
- 显示本轮新增或更新的 memory。

### Memory

- 按联系人分组显示 active memory。
- 每条显示内容、来源和时间。
- 支持删除。

视觉风格保持安静、工具化和高信息密度。Action card 是主要重复组件，不用营销式 hero、装饰性渐变或大面积卡片嵌套。

## 12. 16 小时排期

### H0:00-H0:45：能力冒烟与范围锁定

- 确认 Node/npm、Expo 和 iPhone 测试链路。
- 用真实 API key 对 DeepSeek Vision 做最小图片请求。
- 验证 JSON Output 和当前模型名。
- 定稿 contracts，之后不再扩 action 类型。

退出条件：命令行能从一张 fixture 得到可解析 JSON；失败则立刻保留 DeepSeek adapter，并启用 fixture provider 继续开发。

### H0:45-H2:00：Monorepo 和共享协议

- 创建 Expo App、Fastify API、contracts package。
- 配置 npm workspaces、TypeScript、Vitest、env。
- 定义 AnalyzeResult、ActionCard、ToolResult、MemoryEntry、InsightBundle 的 Zod schema。
- 加 `/health` 和 fixture provider。

退出条件：mobile、api、tests 三个命令都能启动。

### H2:00-H4:30：DeepSeek 分析链路

- multipart 图片接收和尺寸限制。
- 图片转 data URL，不在服务端持久化。
- 联系人索引裁剪和 prompt。
- DeepSeek provider、Zod validation、一次 repair。
- `/v1/analyze` 跑通四类 fixture。

退出条件：会议、新联系人、更新联系人、无动作四种输出都符合 schema。

### H4:30-H7:30：移动端 Capture 和 Review

- 图片选择、预览、补充文字。
- 联系人权限和精简索引读取。
- 分析请求、loading、timeout、retry。
- Thread summary、参与人和 action cards。
- Card 编辑、选择、拒绝、确认前校验。

退出条件：真机能从截图走到可编辑的 action cards。

### H7:30-H10:00：真实工具执行

- NativeActionExecutor。
- DemoActionExecutor。
- 创建/更新 iOS 联系人。
- 创建 iOS 日历事件。
- 权限拒绝、重复执行和部分失败处理。
- SQLite action event log。

退出条件：至少在真实 iPhone 上分别成功创建一个联系人和一个日历事件；更新联系人有一条可复现路径。

### H10:00-H12:00：Memory 闭环

- SQLite migration 和 repository。
- confirmed action 到 memory 的确定性映射。
- supersede、delete 和 bounded retrieval。
- Memory 列表或 Result 页 memory section。
- 两轮 fixture 验证跨运行记忆。

退出条件：第二轮分析/洞察能读取第一轮确认产生的 active memory。

### H12:00-H13:30：洞察与建议

- `/v1/insights` prompt 和 schema。
- 将工具结果、evidence 和 relevant memory 组装进请求。
- 结果页、建议回复复制和空洞察状态。
- 检查建议是否引用真实依据。

退出条件：确认后的 insight 至少引用一个 evidence 或 memory，且不在执行前出现。

### H13:30-H14:30：测试和故障兜底

- Schema validation tests。
- Memory policy tests。
- Executor mock tests。
- Fixture provider API smoke test。
- 网络失败、模型 JSON 错误、权限拒绝、无 action 场景手测。

退出条件：mock 模式可以离线跑完整闭环，真实模式失败时 UI 有清楚的恢复路径。

### H14:30-H15:15：可运行环境

- 本地 API 启动脚本。
- 真机通过 LAN 地址或临时 tunnel 访问 API。
- Dockerfile 或容器启动说明。
- 若现成云账号和凭据已就绪，再部署 API；否则不牺牲 QA 时间。

退出条件：全新终端按 README 可以启动 API 和 Expo，密钥不会进入 mobile bundle。

### H15:15-H16:00：冻结、验收和交付

- 按 demo script 连跑两次。
- 清理明显 UI 溢出和错误文案。
- 检查 Git 状态、env 示例、启动说明。
- 截图或录制一段完整流程。
- 打 tag 或建立明确的 MVP commit。

最后 45 分钟不再加功能，只修阻塞演示的问题。

## 13. 硬性止损规则

- 单个环境或依赖问题最多投入 20 分钟，随后切换已定义的 fallback。
- DeepSeek 输出不稳定：缩小 schema并启用一次 repair，不增加第三次调用。
- 真机无法连 WSL：使用 Expo tunnel 和 API tunnel，不调试复杂局域网配置。
- Native contact update 卡住：保留 create contact/calendar 的真实执行，update 使用明确标注的 Demo executor，主链路继续。
- API 云部署超过 30 分钟：交付本地 Docker/启动脚本和 tunnel 方案。
- EAS 签名或 Apple 证书出问题：交付 Expo Go 运行方式，不在本轮处理 TestFlight。
- UI 时间不足：保留 Capture、Review、Result 三个状态，Memory 管理并入 Result 页。

## 14. 测试素材

至少准备四个单轮 fixture 和一个两轮场景：

- 明确约会：日期、时间和参与人完整。
- 新联系人：姓名和至少一个可保存字段。
- 更新联系人：已有联系人出现新的公司、职位、电话或邮箱。
- 无可执行动作：模型必须返回空 action cards。
- 两轮 memory：第一轮确认事实，第二轮必须引用该事实生成更具体建议。

每个 fixture 同时保存：

- 输入截图。
- 可选补充文字。
- 精简联系人索引。
- fixture provider 的固定响应。
- 最少断言，不要求逐字匹配模型自然语言。

## 15. Definition of Done

只有同时满足以下条件才称为初版完成：

- `npm install` 后有明确命令启动 API 和 mobile。
- DeepSeek Vision 真实模式至少成功跑通一个 fixture。
- Fixture 模式可稳定跑通完整流程。
- 三种 action card 都能生成、编辑和确认。
- 未确认 action 不会产生联系人、日历或 memory 副作用。
- 工具执行有真实成功/失败状态和幂等保护。
- active memory 只来自确认事实，并能查看和删除。
- 第二轮运行能检索第一轮 memory。
- Insight 只在确认后生成，并显示证据来源。
- 真机 Expo Go 完成一次端到端验证。
- 服务端 key 未出现在 App 配置或客户端 bundle。
- GitHub README 包含运行方式、环境变量、已知限制和 demo 路径。

## 16. 预期交付物

16 小时结束时应有：

- GitHub 仓库中的可运行源码。
- TRACE Expo App。
- DeepSeek + fixture 两个 provider。
- 本地可运行 API，云部署视凭据和时间作为 P1。
- 真实 iOS 工具适配器和本地 fallback。
- 结构化 memory 与两轮 demo。
- 自动测试和四类 fixture。
- `.env.example`、README 和 demo script。

这不是生产版。它应当是一条可信、完整、能被评审亲手操作的 Agent 主链路，并为后续接入云端账号、加密同步、向量检索和 TestFlight 留下清晰边界。
