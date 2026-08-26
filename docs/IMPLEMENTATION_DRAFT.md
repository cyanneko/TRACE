# TRACE Agent MVP 实现起草文档

> Thread Reasoning, Action, Context & Execution

日期：2026-08-26

## 1. 项目目标

产品名称：**TRACE**  
产品副标题：**Thread Reasoning, Action, Context & Execution**

在 48 小时内交付一个可运行的独立 agent 小项目，而不是简单的 API 套壳。

用户上传一张聊天截图，也可以补充一段文字。系统需要：

1. 理解截图中的聊天上下文。
2. 识别可执行行动，并生成用户可确认的 action cards。
3. 用户确认后，执行对应行动。
4. 结合用户联系人数据、当前上下文和 memory，生成真正有帮助的洞察与建议。

首版 action cards 聚焦三类：

- 创建会议
- 创建联系人
- 更新联系人

产品形式：iOS app。交付包括 GitHub repo、可运行测试环境、本地或云部署。

## 2. WSL 开发合理性评价

结论：WSL 适合做 80% 以上的开发，但不能单独完成 iOS 原生编译和 iOS Simulator 验证。

适合在 WSL 做的部分：

- TypeScript/Node 后端开发。
- Expo React Native 的 JS/TS 业务开发。
- API、数据库、agent workflow、prompt、schema、测试。
- 本地 Web 调试、Expo Metro 服务。
- 通过 Expo Go 在真实 iPhone 上扫码测试大部分功能。
- 通过 EAS Build 在云上构建 iOS app。

WSL 不适合或不能闭环的部分：

- 不能运行 Xcode。
- 不能运行 iOS Simulator。
- 不能在本机直接产出 iOS 原生包。
- 如果要 TestFlight、App Store 或 iOS 原生能力深度调试，最终仍需要 Mac 或云构建服务。

建议路线：

- 48 小时 MVP 用 Expo + EAS Build。
- 日常开发在 WSL。
- 真机测试优先使用 Expo Go 或 development build。
- iOS 包通过 EAS cloud build 产出。
- 如果最后要 TestFlight，需要 Apple Developer 账号和证书配置。

WSL 注意事项：

- Expo Metro 建议使用 tunnel 模式，避免 WSL2 网络和手机处在不同网段时连不上。
- 后端本地 API 尽量用公网临时隧道或局域网 IP，移动端不要写死 localhost。
- `.env` 分清 mobile 和 api，避免把服务端 key 打进 app bundle。

## 3. 推荐技术栈

### Mobile

- Expo React Native + TypeScript
- Expo Image Picker：上传截图
- React Query：请求状态和缓存
- Zustand：轻量本地状态
- Expo Router：页面路由

首屏直接是可用产品，不做 landing page：

- 截图上传入口
- 补充文字输入
- 分析进度
- action cards 列表
- 确认后洞察与建议

### API

- Node.js + TypeScript
- Hono 或 Fastify
- Zod：入参和 LLM 输出校验
- OpenAI SDK：同时兼容 OpenAI 和 DeepSeek 的 OpenAI-compatible endpoint
- Prisma 或 Drizzle：数据库 schema

### Data

首版建议使用 Supabase Cloud：

- Postgres：联系人、截图记录、action cards、memory、insight runs
- Storage：截图文件
- pgvector 可作为后续增强；MVP 可以先用联系人匹配 + recency + full-text search

本地测试可以选择：

- 快速路线：直接连接 Supabase dev project。
- 更完整路线：docker compose Postgres + local file storage。

48 小时内更推荐第一种。

## 4. DeepSeek 支持策略

用户希望支持 `DeepSeek-V4-Flash-Vision-Exp` 方便测试。DeepSeek 官方文档列出的 API model id 是：

```text
deepseek-v4-flash-vision-exp
```

建议做 provider abstraction，而不是把代码写死给单一模型。

环境变量：

```bash
MODEL_PROVIDER=deepseek
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash-vision-exp

OPENAI_API_KEY=...
OPENAI_MODEL=<vision-capable-openai-model>
```

模型能力分工：

- DeepSeek vision model：截图理解、上下文抽取、action card 初稿、洞察生成。
- OpenAI provider：作为可选 fallback，尤其适合严格 structured outputs、eval 和生产稳定性。
- Embedding 首版不强依赖模型供应商，先用 Postgres FTS 和结构化 memory 检索；后续再接 OpenAI embeddings、Jina、Voyage 或本地 fastembed。

DeepSeek 接入原则：

- 使用 OpenAI-compatible Chat Completions。
- 图片输入用 content blocks。
- 要求 JSON Output，但服务端必须用 Zod 再校验。
- 校验失败时做一次 repair call。
- 不把副作用交给模型直接执行。模型只提出 plan 和 cards，服务端在用户确认后调用真实工具。

Provider interface 草案：

```ts
export interface ModelProvider {
  extractConversation(input: VisionRunInput): Promise<ExtractedConversation>;
  proposeActions(input: ActionProposalInput): Promise<ActionCard[]>;
  generateInsights(input: InsightInput): Promise<InsightBundle>;
  repairJson<T>(input: JsonRepairInput<T>): Promise<T>;
}
```

DeepSeek adapter 伪代码：

```ts
const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
});

const response = await client.chat.completions.create({
  model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash-vision-exp",
  response_format: { type: "json_object" },
  messages: [
    {
      role: "system",
      content: "Return valid JSON that matches the provided schema. Do not execute actions.",
    },
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: { url: screenshotUrlOrDataUrl },
        },
      ],
    },
  ],
});
```

## 5. 为什么这是 Agent 项目，不是 API 套壳

核心不是“把截图发给模型然后展示结果”，而是一个有状态、有工具、有确认、有 memory policy 的 agent workflow。

Agent workflow：

1. Ingest
   - 接收截图和补充文字。
   - 存储原始输入。
   - 创建 `analysis_run`。

2. Perception
   - 多模态模型识别聊天内容。
   - 抽取参与人、时间线、显式承诺、隐式意图、可执行事项、证据片段和不确定性。

3. Grounding
   - 用抽取到的人名、昵称、手机号、公司、上下文去匹配现有联系人。
   - 检索相关 memory。
   - 标出重复联系人、可能冲突、缺失字段。

4. Planning
   - 生成 action cards。
   - 每张卡都包含 action type、字段、置信度、证据、风险和可编辑项。
   - 这里只是提出行动，不产生副作用。

5. Confirmation
   - 用户可以接受、拒绝、编辑每张卡。
   - 被用户确认的卡成为事实依据。

6. Execution
   - 服务端执行工具：
     - `createMeeting`
     - `createContact`
     - `updateContact`
   - 所有执行结果写入 action event log。

7. Memory Curation
   - 将用户确认的信息和高价值上下文写入 memory。
   - 低置信度推断只作为 candidate memory，要求用户确认或后续再次出现再固化。

8. Insight Advisor
   - 基于当前截图、联系人、历史 memory、确认行动生成洞察和建议。
   - 输出要能帮用户下一步行动，而不是泛泛总结。

## 6. Action Card 设计

通用字段：

```ts
type ActionCardBase = {
  id: string;
  runId: string;
  type: "create_meeting" | "create_contact" | "update_contact";
  title: string;
  status: "proposed" | "accepted" | "rejected" | "edited" | "executed" | "failed";
  confidence: number;
  evidence: EvidenceSpan[];
  editableFields: string[];
  riskFlags: string[];
};
```

创建会议：

```ts
type CreateMeetingCard = ActionCardBase & {
  type: "create_meeting";
  payload: {
    title: string;
    startAt?: string;
    endAt?: string;
    timezone: string;
    location?: string;
    meetingLink?: string;
    attendees: Array<{
      contactId?: string;
      displayName: string;
      role?: string;
    }>;
    agenda?: string[];
    unresolvedQuestions?: string[];
  };
};
```

创建联系人：

```ts
type CreateContactCard = ActionCardBase & {
  type: "create_contact";
  payload: {
    name: string;
    aliases?: string[];
    company?: string;
    role?: string;
    phone?: string;
    email?: string;
    socialHandles?: Record<string, string>;
    relationship?: string;
    sourceNote: string;
  };
};
```

更新联系人：

```ts
type UpdateContactCard = ActionCardBase & {
  type: "update_contact";
  payload: {
    contactId: string;
    patch: Partial<Contact>;
    mergeReason: string;
    previousValues: Record<string, unknown>;
  };
};
```

UI 呈现：

- 卡片必须可编辑。
- 置信度低时提示“需要确认”，而不是自动执行。
- 每个字段旁边展示简短证据。
- 确认按钮使用明确动词：创建、更新、安排。
- 确认后进入洞察页。

## 7. Memory 设计

不要把“所有聊天截图总结”都塞进长上下文。首版使用结构化 memory + event log。

Memory 类型：

- `contact_fact`：联系人事实，如公司、职位、手机号、邮箱、昵称。
- `relationship_fact`：用户和此人的关系，如客户、候选人、投资人、同事。
- `preference`：联系人偏好，如喜欢上午沟通、偏好微信、不喜欢临时会议。
- `open_loop`：尚未完成的承诺或跟进。
- `interaction_pattern`：互动模式，如对方经常延迟回复、对价格敏感。
- `context_note`：一次性但高价值的上下文。

Memory 字段：

```ts
type Memory = {
  id: string;
  userId: string;
  contactId?: string;
  type: "contact_fact" | "relationship_fact" | "preference" | "open_loop" | "interaction_pattern" | "context_note";
  content: string;
  structuredValue?: Record<string, unknown>;
  sourceRunId: string;
  sourceActionId?: string;
  confidence: number;
  status: "candidate" | "active" | "rejected" | "superseded";
  privacyLevel: "normal" | "sensitive";
  validFrom: string;
  validUntil?: string;
  lastUsedAt?: string;
};
```

写入策略：

- 联系方式、会议、联系人更新：用户确认后直接写入 active memory。
- 对关系、偏好、动机的推断：默认 candidate。
- 同一事实多次出现且不冲突，可以自动升级 active。
- 与旧事实冲突时，生成 update_contact card 或 memory conflict card。
- memory 必须能被用户查看、删除、纠正。

检索策略：

- 当前截图中出现的人名、昵称、公司、手机号优先匹配联系人。
- 对匹配联系人拉取 active memory。
- open_loop 和 preference 优先进入 insight prompt。
- 过旧、低置信度、被用户否定的 memory 不进入上下文。

洞察生成输入不超过：

- 当前 extracted conversation
- confirmed actions
- matched contacts
- top 10 relevant memories
- unresolved questions

## 8. 洞察与建议设计

这是产品重点。洞察不要停留在“总结聊天内容”，而要回答：

- 用户现在应该知道什么？
- 用户接下来怎么做更有利？
- 是否有遗漏、风险、关系变化、时机问题？
- 新创建或更新的联系人信息如何影响下一步？

InsightBundle 草案：

```ts
type InsightBundle = {
  summary: string;
  insights: Array<{
    title: string;
    body: string;
    evidenceRefs: string[];
    importance: "high" | "medium" | "low";
  }>;
  suggestions: Array<{
    title: string;
    rationale: string;
    nextStep: string;
    suggestedMessage?: string;
  }>;
  memoryUpdates: Array<{
    memoryId?: string;
    proposedContent: string;
    status: "written" | "candidate";
  }>;
  unresolvedQuestions: string[];
};
```

好的输出示例：

- “对方已经给出明确时间窗口，但没有确认会议形式。建议会议卡先创建为 tentative，并补一句确认线上还是线下。”
- “这位联系人此前偏好上午沟通，这次截图里他再次提出上午 10 点，建议把 preferred_meeting_time 写入 memory。”
- “截图里的 Mike 很可能是已有联系人 Michael Chen，因为公司和项目名一致，但昵称不完全一致。建议更新 alias，而不是新建联系人。”

差的输出：

- “你们聊得很好。”
- “建议继续沟通。”
- “可以创建会议。”

## 9. API 草案

上传并分析截图：

```http
POST /v1/runs
Content-Type: multipart/form-data

image=<file>
note=<optional text>
```

返回：

```json
{
  "runId": "run_123",
  "extractedConversation": {},
  "matchedContacts": [],
  "actionCards": []
}
```

编辑 action card：

```http
PATCH /v1/action-cards/:id
```

确认并执行：

```http
POST /v1/runs/:id/confirm
```

请求体：

```json
{
  "acceptedCardIds": ["card_1", "card_2"],
  "rejectedCardIds": ["card_3"]
}
```

返回：

```json
{
  "executedActions": [],
  "memoryUpdates": [],
  "insights": {}
}
```

联系人：

```http
GET /v1/contacts
POST /v1/contacts
PATCH /v1/contacts/:id
```

Memory：

```http
GET /v1/memories?contactId=...
PATCH /v1/memories/:id
DELETE /v1/memories/:id
```

## 10. 数据库表草案

核心表：

- `users`
- `contacts`
- `contact_aliases`
- `screenshots`
- `analysis_runs`
- `extracted_messages`
- `action_cards`
- `action_events`
- `memories`
- `insight_runs`
- `feedback_events`

`contacts`：

```sql
create table contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  company text,
  role text,
  email text,
  phone text,
  relationship text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`action_cards`：

```sql
create table action_cards (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  type text not null,
  status text not null,
  title text not null,
  payload jsonb not null,
  evidence jsonb not null default '[]',
  confidence numeric not null,
  risk_flags jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`memories`：

```sql
create table memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  contact_id uuid,
  type text not null,
  content text not null,
  structured_value jsonb,
  source_run_id uuid not null,
  source_action_id uuid,
  confidence numeric not null,
  status text not null,
  privacy_level text not null default 'normal',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 11. Prompt 结构

建议拆三步，而不是一个超大 prompt。

Step 1：Conversation extraction

- 输入：截图、补充文字。
- 输出：消息列表、参与人、时间表达、承诺、实体、证据、不确定性。

Step 2：Action proposal

- 输入：extracted conversation、matched contacts、relevant memories。
- 输出：action cards。

Step 3：Insight advisor

- 输入：extracted conversation、用户确认动作、执行结果、relevant memories。
- 输出：insight bundle。

这样做的好处：

- 每步输出更容易校验。
- DeepSeek JSON Output 出错时更容易 repair。
- 可以单独为 action cards 和 insight 做 eval。
- 用户确认成为 workflow 的状态边界。

## 12. 测试计划

测试数据：

- 准备 12 张聊天截图 fixture：
  - 明确约会议。
  - 模糊时间约会议。
  - 新联系人出现。
  - 已有联系人昵称出现。
  - 联系人公司/职位变更。
  - 电话或邮箱出现在截图中。
  - 多人聊天。
  - 中文、英文混合。
  - 截图裁切不完整。
  - 图片质量差。
  - 没有可执行行动。
  - 模型容易过度推断的场景。

自动测试：

- Zod schema validation。
- action card snapshot tests。
- contact matching unit tests。
- memory write policy tests。
- insight output smoke tests。

手动验收：

- 上传截图后 15 秒内返回 action cards。
- 用户能编辑并确认 card。
- 确认后 DB 里产生 action event 和 memory。
- 洞察能引用联系人历史信息。
- 没有明显 hallucinated action。

## 13. 48 小时排期

### 0-4 小时：项目骨架

- Monorepo 初始化。
- Expo app 初始化。
- API app 初始化。
- env、lint、format、README。
- Supabase dev project 和 schema migration。

### 4-12 小时：截图分析链路

- 上传截图接口。
- DeepSeek provider adapter。
- extraction schema。
- action card schema。
- 基础 prompt。
- 本地 fixture 测试。

### 12-20 小时：移动端主流程

- 上传截图页面。
- 补充文字输入。
- 分析中状态。
- action cards 展示和编辑。
- confirm/reject 交互。

### 20-30 小时：执行工具和 memory

- createContact。
- updateContact。
- createMeeting。
- action event log。
- memory write policy。
- contact matching。

### 30-38 小时：洞察与建议

- memory retrieval。
- insight advisor prompt。
- insight UI。
- feedback。
- 关键 fixture eval。

### 38-44 小时：部署与构建

- API 部署到 Railway/Fly/Render/Vercel。
- Supabase Cloud 配置。
- Expo EAS preview build。
- README 跑通。

### 44-48 小时：打磨与 demo

- 种子数据。
- demo 截图。
- 错误状态。
- loading 和 retry。
- 最小安全策略。
- 最终录屏或 demo script。

## 14. MVP 范围控制

必须做：

- iOS app 可上传截图。
- DeepSeek vision 模型可跑通。
- 生成三类 action cards。
- 用户能确认/拒绝/编辑。
- 确认后真实写入联系人、会议、memory。
- 生成有联系人上下文的洞察与建议。
- 有 README 和测试环境。

暂缓：

- 真实 iOS Contacts 写入。
- 真实 Apple Calendar 写入。
- 多用户团队协作。
- 完整 OAuth。
- 完整向量检索。
- 长期后台任务。
- 复杂权限体系。

可以作为加分：

- 导出 `.ics` 文件。
- 手动导入/粘贴联系人 CSV。
- memory 管理页。
- 模型 provider 切换面板。
- prompt/eval dashboard。

## 15. 风险与对策

风险：截图 OCR 或上下文理解错误。

对策：所有 action card 都展示证据，不自动执行；低置信度字段必须用户确认。

风险：DeepSeek JSON 不稳定。

对策：小 schema、多步骤、Zod 校验、repair call、失败时展示“需要人工填写”。

风险：联系人合并错误。

对策：update_contact 必须展示 matched contact 和 merge reason；相似但不确定时生成候选卡。

风险：洞察太泛。

对策：prompt 强制要求每条 insight 包含 evidenceRefs、联系人 memory 或明确下一步；没有证据就放入 unresolvedQuestions。

风险：WSL iOS 构建受限。

对策：Expo Go 真机测试 + EAS cloud build；需要 Simulator 时借 Mac 验证。

## 16. 外部文档参考

- OpenAI Images and Vision guide: https://developers.openai.com/api/docs/guides/images-vision
- OpenAI Function Calling guide: https://developers.openai.com/api/docs/guides/function-calling
- OpenAI Structured Outputs guide: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI Agents SDK docs: https://openai.github.io/openai-agents-js/
- DeepSeek Vision guide: https://api-docs.deepseek.com/guides/vision/
- DeepSeek JSON Output guide: https://api-docs.deepseek.com/guides/json_mode/
- DeepSeek Tool Calls guide: https://api-docs.deepseek.com/guides/function_calling/
- Expo EAS Build docs: https://docs.expo.dev/build/introduction/
- Expo iOS Simulator docs: https://docs.expo.dev/workflow/ios-simulator/
- Apple Developer Program: https://developer.apple.com/programs/
