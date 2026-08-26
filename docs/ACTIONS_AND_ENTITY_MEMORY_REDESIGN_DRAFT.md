# TRACE 行动与实体记忆重构草稿

日期：2026-08-26  
状态：设计评审稿，尚未修改实现

## 1. 目标

本轮重构希望让 TRACE 从“分析一次截图并产生少量固定卡片”，变成一个可以持续维护人物与会议上下文的本地 agent。

本稿覆盖以下产品要求：

1. 取消行动卡的业务数量上限。
2. 新人物只要与用户发生了有意义的直接互动，就可以建议创建联系人。
3. 创建联系人时只要求一个可辨识名称，不强迫补齐电话、邮箱、公司和职位。
4. 新增 `update_meeting` 行动卡。
5. Memory 分成联系人和会议两类，每个联系人、每个会议都有自己的专属记忆区。
6. 联系人与会议分别保留一组结构化基本信息，避免把姓名、时间等字段混入自由文本记忆。
7. 模型提出行动时不写 Memory，只有该行动成功执行后才允许更新实体和 Memory。
8. 用户可以直接新增、修改和删除任意专属记忆。
9. 联系人可以包含用户自己。
10. 联系人按字典序展示，会议按时间和状态展示。
11. 用户可以从 Memory 页面直接新建空联系人或空会议，稍后再补充内容。

## 2. 核心设计结论

### 2.1 基本信息与专属记忆分开

每个联系人或会议详情页分成两个区域：

- 基本信息：实体当前的唯一可信状态。
- 专属记忆：围绕该实体的偏好、背景、承诺、上下文和自由备注。

例如联系人姓名、电话和职位只存放在联系人基本信息中；“更喜欢先看书面材料”放在该联系人的专属记忆中。会议名称和时间只存放在会议基本信息中；“会前需要准备竞品数据”放在该会议的专属记忆中。

这样可以避免同一个时间、电话或职位在多个 Memory 中出现不同版本。

### 2.2 Memory 必须有归属实体

第一版不保留无归属的全局 Memory。每条 Memory 必须属于：

- 一个联系人，包括标记为“我”的联系人。
- 一个会议。

用户自己的偏好和背景信息写入 `isSelf = true` 的联系人，因此暂时不需要第三种全局 Memory。

### 2.3 模型只提出计划，执行成功才落库

模型输出的 Action Card 和记忆建议都只是候选内容。它们不会在分析、编辑、勾选或确认弹窗阶段写入 Memory。

只有满足以下条件才更新本地实体和 Memory：

1. 用户明确确认该卡片。
2. 对应系统工具执行成功。
3. 本地实体与 Memory 事务提交成功。

批量确认时按卡片独立处理。某张卡成功，只提交该卡的变更；另一张卡失败，不会留下相关 Memory。

用户手动编辑 Memory 是例外。手动点击保存本身就是明确确认，因此不需要再生成 Action Card。

### 2.4 Memory 页面允许直接创建空实体

联系人和会议不必只能由截图分析产生。用户可以在 Memory 页的 Contacts 或 Meetings 视图中直接新建实体，并暂时保持为空。

直接新建时：

- 只创建本地 `draft` 实体，不生成 Action Card，不调用模型。
- 不立即向 iOS Contacts 或 Calendar 写入空白记录。
- 联系人的姓名、联系方式、公司和职位可以全部为空。
- 会议的名称、时间、地点、参与人和备注可以全部为空。
- 初始专属 Memory 列表为空，不创建内容为空的 Memory 行。
- 用户可以随后补充基本信息或新增专属 Memory。
- 空草稿不加入视觉模型上下文，避免无意义实体干扰匹配。

列表中使用“未命名联系人”和“未命名会议”作为显示占位文字，但占位文字不写入实体数据。空联系人排在有名称联系人之后，空会议进入 `time_unresolved` 分组。

## 3. 目标数据模型

### 3.1 联系人实体

```ts
type ContactRecord = {
  id: string;
  externalContactId?: string;
  displayName: string;
  sortName?: string;
  givenName?: string;
  familyName?: string;
  company?: string;
  jobTitle?: string;
  phones: string[];
  emails: string[];
  isSelf: boolean;
  status: "draft" | "active";
  source: "ios" | "trace" | "demo";
  createdAt: string;
  updatedAt: string;
};
```

设计规则：

- `displayName` 是创建联系人唯一必填的个人字段。
- 从 Memory 页面手动创建的 `draft` 联系人允许 `displayName` 暂时为空；Action Card 创建联系人时仍必须有可辨识名称。
- 截图里只有昵称时，昵称可以直接作为 `displayName`。
- 不允许模型猜测真实姓名、电话、邮箱、公司或职位。
- `externalContactId` 用于关联 iOS Contacts，`id` 始终使用 TRACE 自己的稳定 ID。
- `isSelf` 标记用户自己，第一版默认最多一个活动的 self 联系人。
- self 联系人和其他联系人使用相同的数据结构、排序规则和 Memory 功能。

### 3.2 会议实体

```ts
type MeetingRecord = {
  id: string;
  externalEventId?: string;
  title: string;
  startAt?: string;
  endAt?: string;
  timezone: string;
  allDay: boolean;
  location?: string;
  meetingLink?: string;
  notes?: string;
  participantContactIds: string[];
  status: "draft" | "active";
  source: "ios" | "trace" | "demo";
  createdAt: string;
  updatedAt: string;
};
```

会议状态不长期写入数据库，而是根据当前时间动态计算，避免 App 放置一段时间后状态过期。

这里的实体 `status` 只表示草稿是否已经形成有效实体，不代表会议进行状态。Memory 页面手动新建的 `draft` 会议允许 `title` 暂时为空；由 Action Card 创建会议时仍需要标题，并在执行条件满足后转为 `active`。

```ts
type MeetingState = "ongoing" | "upcoming" | "ended" | "time_unresolved";
```

只有开始和结束时间都明确时，才能可靠判断 `ongoing`。缺少必要时间的会议进入 `time_unresolved`，不猜测默认时长。

### 3.3 实体专属记忆

```ts
type EntityMemory = {
  id: string;
  ownerType: "contact" | "meeting";
  ownerId: string;
  kind: "context" | "preference" | "commitment" | "note";
  content: string;
  status: "active" | "deleted";
  source: "action" | "manual" | "migration";
  sourceRunId?: string;
  sourceActionId?: string;
  sourceEvidenceRefs: string[];
  confidence?: number;
  createdAt: string;
  updatedAt: string;
};
```

第一版 Memory 使用可直接编辑的文本 `content`，不再让用户面对通用的 `key/value` JSON。

行为规则：

- 用户可以新增、编辑、删除 Memory。
- 用户编辑后，内容以用户版本为准，`source` 改为 `manual`，置信度视为 1。
- 删除采用软删除，默认界面不展示，但数据迁移和故障恢复仍可追踪。
- Action 产生的 Memory 保留 `sourceRunId`、`sourceActionId` 和证据引用。
- 结构化字段的历史变化记录在 Action Event 中，不重复写成基本信息 Memory。

## 4. Action Card 重构

### 4.1 支持的行动类型

```ts
type ActionType =
  | "create_meeting"
  | "update_meeting"
  | "create_contact"
  | "update_contact";
```

### 4.2 取消数量上限

需要同时移除以下业务限制：

- `AnalyzeResultSchema.actionCards.max(3)`。
- `InsightRequestSchema.confirmedActions.max(3)`。
- `InsightRequestSchema.toolResults.max(3)`。
- Prompt 中“最多 3 个行动”的要求。
- UI、Reducer、Fixture 和测试中任何 `slice(0, 3)` 或固定三个卡片的假设。

产品层不设置行动数量上限。仍保留请求体大小、模型 token 和执行并发等技术保护，但它们不能静默删除合法卡片。模型输出截断时应明确报错或继续请求剩余行动。

Prompt 仍需要求：

- 每个独立行动生成一张卡。
- 同一人物或会议的重复建议合并。
- 按截图中的证据出现顺序返回。
- 没有行动时返回空数组。

取消上限后，不建议继续默认全选所有卡片。推荐默认不选，由用户逐卡勾选；同时保留明确的“全选”命令和已选数量。

### 4.3 最小联系人创建卡

```ts
type CreateContactPayload = {
  displayName: string;
  givenName?: string;
  familyName?: string;
  company?: string;
  jobTitle?: string;
  phones: string[];
  emails: string[];
  isSelf: boolean;
  interactionSummary?: string;
};
```

`displayName` 之外的字段都允许为空。执行到 iOS Contacts 时，如果没有拆分姓名，使用 `displayName` 作为 `givenName`。

为新人物生成创建联系人卡的条件：

1. 截图中存在稳定可见的名称、昵称或账号标识。
2. 该人物不是已经明确匹配的联系人。
3. 该人物与用户发生了至少一次有意义的直接互动。
4. 卡片至少引用一条能证明互动关系的截图证据。

“有意义的直接互动”包括直接对话、回复、约定、邀请、任务分配、交换信息或明确表达后续联系意愿。

以下情况不自动建议创建联系人：

- 只在消息中被第三方提到的人名。
- 转发内容、新闻、群公告中的人物。
- 系统账号、机器人或无法辨识的头像。
- 已明确识别为用户自己的人物。

如果疑似已有重复联系人，卡片保留但加入 `possible_duplicate` 风险，并让用户在执行前选择“创建新联系人”或“关联已有联系人”。

### 4.4 更新会议卡

```ts
type MeetingChange = {
  field:
    | "title"
    | "startAt"
    | "endAt"
    | "timezone"
    | "location"
    | "meetingLink"
    | "notes"
    | "participantContactIds";
  previousValue: unknown;
  nextValue: unknown;
};

type UpdateMeetingPayload = {
  meetingId: string | null;
  displayTitle: string;
  changes: MeetingChange[];
};
```

生成条件：

- 截图明确表达了改期、取消后重约、标题变化、地点变化、链接变化、备注变化或参与人变化。
- TRACE 能匹配一个已有会议，或者向用户展示待选择的候选会议。
- 每项变化均有截图证据。

执行条件：

- `meetingId` 必须在用户确认前解析为现有会议。
- 日历事件必须仍然存在且允许修改。
- 时间冲突和缺失字段显示为风险，不由模型擅自补全。

第一版不把“取消会议”混进更新会议。取消会产生不可逆副作用，建议后续作为独立 `cancel_meeting` 类型设计。

### 4.5 Action 关联的候选 Memory

Action Card 可以附带可预览的 Memory 建议，但不直接落库：

```ts
type MemoryProposal = {
  target:
    | { type: "action_entity" }
    | { type: "contact"; contactId: string }
    | { type: "meeting"; meetingId: string };
  kind: "context" | "preference" | "commitment" | "note";
  content: string;
  evidenceRefs: string[];
};
```

`action_entity` 表示这条 Memory 属于即将创建的联系人或会议，执行成功拿到实体 ID 后再解析归属。

Memory Proposal 必须有证据，且用户可以在卡片的展开区域中查看或编辑。结构化基本信息的更新不作为 Memory Proposal。

## 5. 执行与 Memory 写入流程

每张卡独立执行以下状态机：

```text
proposed
  -> confirmed
  -> executing_external_tool
  -> external_tool_succeeded
  -> committing_local_state
  -> executed
```

失败状态：

```text
executing_external_tool -> failed_no_memory
committing_local_state  -> pending_local_commit
```

详细顺序：

1. 再次校验用户编辑后的 Action Card。
2. 使用 `runId:actionId` 检查幂等记录。
3. 执行 iOS Contacts、Calendar 或 Web Demo 工具。
4. 工具失败时结束，不修改实体，不写 Memory。
5. 工具成功后获得 `externalContactId` 或 `externalEventId`。
6. 在同一个本地 SQLite 事务中写 Action Event、更新实体、写入该卡的 Memory Proposal。
7. 返回该卡的最终执行状态。

iOS 系统数据库和 TRACE SQLite 无法组成真正的跨数据库事务。如果系统写入成功但本地提交失败，卡片进入 `pending_local_commit`，重试时只补做本地提交，不能再次创建系统联系人或日历事件。

`ToolResult` 需要增加目标实体信息：

```ts
type ToolResult = {
  actionId: string;
  success: boolean;
  provider: "native" | "demo";
  entityRef?: {
    type: "contact" | "meeting";
    id: string;
    externalId?: string;
  };
  error?: string;
};
```

## 6. 本地存储设计

iOS SQLite 建议从单一 `memory_entries(payload)` 表升级为以下实体表：

```text
contacts
meetings
meeting_participants
entity_memories
action_events
schema_migrations
```

关键索引：

```text
contacts(sort_name, display_name)
contacts(external_contact_id)
meetings(start_at, end_at)
meetings(external_event_id)
entity_memories(owner_type, owner_id, status, updated_at)
action_events(idempotency_key)
```

Web 模拟环境使用同一套 Repository 接口，在 `localStorage` 中保存带版本号的对象，不为 Web 单独设计另一套业务模型。

迁移原则：

- 新建 v2 表，不删除旧 `memory_entries`。
- 旧 `contactId` Memory 迁移到对应联系人。
- `value.kind = scheduled_meeting` 的旧 Memory 转换成会议实体。
- 无法可靠归属的数据保留在旧表并记录迁移结果，不擅自挂到用户自己名下。
- 完成验证前保留 v1 读取代码和回退 tag。

## 7. 联系人与会议的数据来源

### 7.1 iOS

- Contacts：读取系统联系人，映射为 TRACE ContactRecord，并保存 `externalContactId`。
- Calendar：新增 MeetingSource，读取允许范围内的系统事件，并保存 `externalEventId`。
- TRACE 专属 Memory 只存在本地 SQLite，不写进系统联系人备注或日历备注。
- 更新基本信息时，先写系统实体，成功后同步本地镜像。

### 7.2 WSL 与浏览器

- 使用 DemoContactSource、DemoMeetingSource 和 DemoActionExecutor。
- Web 与 iOS 共享排序、状态计算、Memory CRUD、Action 状态机和 Schema。
- 浏览器可以完整模拟创建和更新会议，但不会修改真实系统日历。

## 8. 分析请求与 Prompt 调整

分析请求需要从“联系人 + 无归属 Memory”升级为实体上下文：

```ts
type AnalyzeRequest = {
  screenshotDataUrl: string;
  note: string;
  contacts: ContactContext[];
  meetings: MeetingContext[];
  currentTime: string;
  timezone: string;
  visionProvider?: UserVisionProvider;
};
```

`ContactContext` 和 `MeetingContext` 各自携带少量相关专属 Memory。第一版数据量较小时可以全部传入；数据增多后改为先抽取人物和会议线索，再做本地检索，不应无限扩大 Prompt。

Prompt 新增规则：

- 提取全部独立可执行行动，不设置业务数量上限。
- 对每个新人物检查是否与用户有直接互动。
- 创建联系人只要求截图可见的名称或昵称，未知字段保持空值。
- 明确区分用户自己、现有联系人、新人物和仅被提及的第三方。
- 检查截图是否更新已有会议。
- 更新会议必须引用已有 `meetingId`；匹配不明确时标记风险并等待用户选择。
- Memory Proposal 只能记录截图或现有上下文明确支持的内容。
- 不把基本信息字段重复生成为自由 Memory。

服务端仍然需要 JSON Schema 校验和一次 Repair。取消 Action 数量上限后，要额外覆盖长输出和 `finish_reason = length`。若一张截图产生的合法行动超过单次输出容量，后续可增加 continuation 请求并按 Action ID 与证据去重。

## 9. Memory 界面调整

底部仍保持两个主功能：`Analyze` 和 `Memory`。

Memory 页面内部使用联系人和会议两个分段视图：

```text
Memory
[ Contacts | Meetings ]
```

两个分段视图分别提供一个新建图标按钮：

- Contacts 中点击新建，立即保存一个本地空 `draft` 联系人并打开详情页。
- Meetings 中点击新建，立即保存一个本地空 `draft` 会议并打开详情页。
- 新建操作不弹出要求用户先填写字段的表单。
- 返回列表时，即使仍为空也保留该草稿，用户可以稍后继续编辑或主动删除。

联系人列表行显示：

- 姓名或昵称。
- 公司和职位，有值才显示。
- `我` 标记，有 `isSelf` 才显示。
- 活动 Memory 数量。

联系人详情页：

```text
基本信息
姓名、联系方式、公司、职位、是否为我

专属记忆
新增、编辑、删除
```

会议列表行显示：

- 会议名称。
- 开始与结束时间。
- 参与人。
- 会议状态。
- 活动 Memory 数量。

会议详情页：

```text
基本信息
名称、时间、时区、地点、链接、参与人

专属记忆
新增、编辑、删除
```

详情页使用普通分区，不在卡片中继续嵌套卡片。

## 10. 排序与会议视觉状态

### 10.1 联系人排序

联系人按 `sortName ?? displayName` 使用当前 App locale 的字典序排列：

```ts
new Intl.Collator(locale, {
  sensitivity: "base",
  numeric: true,
}).compare(leftName, rightName);
```

相同名称使用稳定 `id` 作为第二排序键。self 联系人不置顶，仍参与正常字典序。

名称为空的 `draft` 联系人统一排在所有已命名联系人之后，再按创建时间排序。

### 10.2 会议排序

推荐默认顺序：

1. 进行中会议：按结束时间升序。
2. 未开始会议：按开始时间升序。
3. 已结束会议：按结束时间降序，最近结束的在前。
4. 时间未确定：放在最后。

这比把所有历史会议按绝对升序堆在最上方更适合日常使用，同时每个状态分组内部仍按时间排序。

### 10.3 会议标注

- `ongoing`：使用明显但克制的强调色、左侧状态条和“进行中”标记，标题加粗。
- `upcoming`：正常文字和背景，不额外抢占注意力。
- `ended`：降低文字与图标对比度，不降低到无法阅读。
- `time_unresolved`：显示“时间待确认”，不伪装成未开始会议。
- 空 `draft` 会议：显示“未命名会议”，归入时间未确定区域，不写入系统日历。

状态在页面显示、App 回到前台以及跨越最近会议边界时重新计算。

## 11. Insights 与 Memory 的关系

Action 数量取消上限不代表 Insights 也必须无限增长。建议继续只展示最多 3 条经过优先级排序的核心洞察，避免结果页被模板信息淹没。

Insights 只使用：

- 成功执行的 Action。
- 当前联系人或会议的基本信息。
- 这些实体的活动 Memory。
- 当前截图证据。

失败、拒绝和未执行卡片不能影响洞察，也不能写入 Memory。

后续把当前模板式 Insights 升级为模型生成时，仍需要求每条洞察引用实体 ID、Memory ID 和 Evidence ID。

## 12. 建议实施顺序

### Iteration 1：Contracts 与测试夹具

- 新增 ContactRecord、MeetingRecord、EntityMemory。
- 新增 `update_meeting`。
- 移除 Action 数量上限。
- 增加多行动、新联系人、更新会议 Fixture。
- 暂不接 UI。

### Iteration 2：本地实体仓库与迁移

- 增加联系人、会议和实体 Memory Repository。
- 实现 SQLite v2 Schema 和 Web v2 Storage。
- 实现旧 Memory 非破坏迁移。
- 增加 CRUD、排序和状态计算测试。

### Iteration 3：执行协调器

- 实现 `update_meeting` 的 Demo 与 iOS Executor。
- 将实体更新、Memory Proposal 和 Action Event 放进成功后提交流程。
- 增加幂等、局部失败和 pending local commit 测试。

### Iteration 4：分析与 Prompt

- 请求中加入会议和分组后的实体 Memory。
- 调整新人物识别规则。
- 输出不限数量的 Action Cards。
- 增加更新会议与 Memory Proposal。
- 对 DeepSeek、GLM、豆包和 Custom 使用同一 Contract。

### Iteration 5：Memory 页面

- 增加 Contacts、Meetings 分段视图。
- 增加联系人与会议详情。
- 增加直接创建空联系人和空会议的入口与 `draft` 状态。
- 增加专属 Memory 的新增、编辑、删除。
- 完成字典序和会议状态视觉。

### Iteration 6：完整回归

- WSL 浏览器完整跑通四种行动。
- 测试大量 Action Cards 的滚动、选择和分批执行。
- iOS 真机验证联系人和日历权限、创建、更新和回读。
- 为本轮完成状态建立独立 Git tag，保留现有版本 tag 作为回退点。

## 13. 必须覆盖的验收场景

1. 一张截图产生 4 张以上卡片，Contract 和 UI 不截断。
2. 只有昵称的新人物与用户直接交流，产生最小创建联系人卡。
3. 消息中只被提到的第三方，不产生联系人卡。
4. 已存在联系人不重复创建，疑似重复时要求用户选择。
5. 用户自己可以出现在联系人列表并拥有专属 Memory。
6. 明确改期的截图产生 `update_meeting` 卡。
7. 无法确定目标会议时禁止直接执行。
8. 卡片未执行、被拒绝或执行失败时，Memory 完全不变。
9. 一批卡片部分成功时，只写入成功卡片对应的实体和 Memory。
10. 重试同一行动不会重复创建联系人、会议或 Memory。
11. 用户可以新增、编辑、删除联系人和会议 Memory。
12. 联系人按 locale 字典序稳定排列。
13. 进行中会议突出，未来会议正常，历史会议淡化。
14. 会议跨越开始或结束时间后，状态无需重启 App 即可变化。
15. Web Demo 与 iOS 使用相同业务规则。
16. Memory 页可以新建完全为空的联系人和会议，退出详情页后草稿仍存在。
17. 空草稿不创建空白 iOS 联系人或日历事件，也不进入模型分析上下文。

## 14. 本稿建议优先确认的三个决定

1. 取消数量上限后，Action Card 是否接受“默认全部不选”的安全策略。本稿建议接受。
2. 会议列表是否采用“进行中、未开始、已结束、时间未定”的分组时间序，而不是所有会议纯粹按时间升序。本稿建议采用分组时间序。
3. Action Card 中是否显示可展开的“确认后会记住”内容。本稿建议显示，以便用户在执行前理解 Memory 影响。
