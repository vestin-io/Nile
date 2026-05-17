# packages/core 深度 review（v3）

> 基线：`main` @ `2405190 Restructure agent and connection ownership`
>
> 本版与前版的区别：对照 Codex 这一轮反馈，逐条标注共识状态，并把每条结论改成可一行 grep 复现，避免再出现「实现搬走但 surface 还在 / 版本判断错位」的争议。

## 状态图例

- ✅ **共识**：我和 Codex 都认同，是当前真实债
- ⚠️ **部分一致**：双方都认有问题，但严重程度判断不同
- ❌ **Codex 误判**：Codex 认为已过时，但 main HEAD 上 grep 可复现
- 🆕 **新点**：Codex 没 raise，但有证据

每条都附 **一行 grep**，可直接在 `packages/core/src` 下复现。

---

## P1 — 双方一致的主线债

### P1-1（原 B1）`NileSession → SessionRuntime → SessionResources → SessionWorkspaceResources` 透传四层

✅ Codex 原话：「现在这条调用链还是偏长，属于真实结构债。」

**复现**：

```bash
rg -c "return this\." packages/core/src/runtime-local/NileSession.ts \
   packages/core/src/runtime-local/SessionRuntime.ts \
   packages/core/src/runtime-local/SessionResources.ts \
   packages/core/src/runtime-local/SessionWorkspaceResources.ts
```

`NileSession` 22 个方法 / `SessionRuntime` 25 个方法，绝大多数是 `return this.x.y.z(...)` 直传。

**改造**：

- `NileSession` 保留作 public facade
- 把 `SessionRuntime` 直接合进 `SessionResources`（中间没有任何真实业务分工）
- `Session*Resources` 按职责（不按 workspace/history）重组为 `ConnectionResources / AgentResources / UsageResources / HistoryResources`

---

### P1-2（原 A1）`actions/usage/Usage.ts` 仍是 `authMode + protocol` 中心硬分发

✅ Codex 原话：「Usage.ts 仍然按 authMode + protocol 硬分发 OpenAI / Claude / Cursor。」

**复现**：

```bash
rg -n '(protocols\.(openai|anthropic|cursor)|authMode === "(openai|claude|cursor)_session")' \
   packages/core/src/actions/usage/Usage.ts
```

```81:123:packages/core/src/actions/usage/Usage.ts
private async readSupportedUsage(...) {
  if (endpoint.protocols.openai && (access.authMode === "openai_session" || access.authMode === "openclaw_openai_session")) { ... }
  if (endpoint.protocols.anthropic && access.authMode === "claude_session") { ... }
  if (endpoint.protocols.cursor && access.authMode === "cursor_session") { ... }
  return null;
}
```

**改造**：

- core 只持有 `UsageReader` 协议 + `UsageReaderRegistry`（按 `authMode` 索引）
- `ClaudeSessionUsageReader`（268 行 OAuth refresh 实现）和 `OpenAiSessionUsageReader`（215 行 ChatGPT 后端实现）迁到 `@nile/connections/families/claude-session/usage` 和 `/openai-session/usage`
- Cursor reader 已经在 `@nile/agent-cursor/usage`，只需让它注册到 registry

---

### P1-3（原 A8 + B3）中心 union + 手写 source switch 是同一类问题

✅ Codex 原话：

- 「StoredCredential 这类中央 union 仍然存在，确实还是中心化的共享类型。」
- 「RequestBuilder.ts 里有 current_codex/current_claude/current_cursor/current_gemini 的 switch，所以这条不是错。」

**复现**：

```bash
rg -n '^\s*\|\s*[A-Z]\w+Credential;?$' packages/core/src/services/credential/Types.ts
rg -n 'case "current_(codex|claude|cursor|gemini)"' packages/core/src/session/RequestBuilder.ts
```

```73:81:packages/core/src/services/credential/Types.ts
export type StoredCredential =
  | ApiKeyCredential
  | ClaudeSessionCredential
  | OpenAiSessionCredential
  | OpenClawOpenAiSessionCredential
  | CursorSessionCredential
  | GeminiCliSessionCredential
  | CursorWebSessionCredential;
```

```67:89:packages/core/src/session/RequestBuilder.ts
switch (source) {
  case "current_codex":  return { authMode: "openai_session", source, ... };
  case "current_claude": return { authMode: "claude_session", source };
  case "current_cursor": return { authMode: "cursor_session", source };
  case "current_gemini": return { authMode: "gemini_cli_session", source };
}
```

`session/Types.ts` 的 `CurrentSessionCredentialRequest` 和 `session/LoginTypes.ts` 的 `InteractiveSessionLoginRequest` 是同样的手写 union；`application/local/LocalCredentialRequestBuilder.ts` 还有 `buildOpenAiSession` / `buildClaudeSession` / `buildCursorSession` / `buildGeminiSession` 四个具名 helper——同一类问题在 3 个文件里 spread。

**改造**：

- `RequestBuilder.buildCurrent` 的 switch 改成 `CURRENT_SESSION_SOURCE_REGISTRY.read(source).authMode`，每个 source manifest 已经声明了 `authMode`
- 四个具名 `build*Session` helper 删掉，调用方传 generic 参数
- `StoredCredential` 的 7-分支字段下放到 family / agent 包，core 只做 union 拼装（或者改 type-guard 注册表）

---

## P2 — Codex 误判为"过时"，但 main HEAD 上仍可复现

> 这一组的共同模式：实现类挪走了，但 core 的 API surface / 硬编码字符串还在。**「实现搬走 ≠ 问题没了」**。

### P2-1（原 A2）Cursor surface 仍在 core 上

✅ **已修复**（本轮清理完成）

**修复内容**：
- `@nile/agent-cursor` 从 `packages/core/package.json` 依赖中移除（零包级循环依赖）
- Cursor 结果类型（`BindCursorUsageResult` / `CursorUsageAutoBindResult` / `CursorUsageSessionProbe`）前移到 `packages/core/src/runtime-local/CursorSessionTypes.ts`，cursor 包重新导出
- 新增 `LocalCursorOps` / `LocalCursorOpsFactory` 抽象接口（`packages/core/src/runtime-local/LocalCursorOps.ts`），cursor 通过 `AgentModule.localCursorOpsFactory` 注册工厂
- `Usage.ts` 改为从 registry 注入 reader，不再直接 new cursor 类
- `WorkspaceState.ts` 全面去除 cursor import，改走 `getCursorOps()` 查注册表
- `StateReset.ts` 的 `cursor_usage_bindings` 硬编码 SQL 改成从 `AgentModule.localCursorOpsFactory.credentialRefQuery` 读取
- `NileSession` 内联 `CursorUsageConnectionFollowUp` 逻辑，删除对 cursor 包的引用
- 所有 typecheck + 测试通过（78 core / 3 cli / 38 desktop）

**验证**：

```bash
# 0 结果表示清理完成
rg "@nile/agent-cursor" packages/core/src --include="*.ts" -l | grep -v ".test.ts"
grep "agent-cursor" packages/core/package.json
```

---

### P2-2（原 A6）`OnboardingSupport` 硬编码 `manifest.id === "gateway"`

✅ **Codex 判断正确，已修复**（agent-registry PR 已 merge）

`OnboardingSupport.ts` 已改为委托给 `module.resolveOnboardingConfig?.(protocols)` 调用，gateway preset 自己在 `Gateway.ts` 中实现该方法。`=== "gateway"` 硬编码已清除。

**改造（参考 Gateway.ts 实现）**：

```ts
// in @nile/connections/presets/gateway
manifest: {
  id: "gateway", ...,
  resolveOnboardingAgents?(protocols): AgentId[] { ... }
}
```

core 的 `OnboardingSupport` 改成「先问 preset 自己，没实现就走默认」。

---

### P2-3（原 B6）`models/agent/Types.ts` 仍是 facade，文件名错

❌ Codex 原话：「Types.ts 还是 facade，要看它写 review 时的版本；现在很多 ownership 已经改过了。」

**复现**：

```bash
wc -l packages/core/src/models/agent/Types.ts
rg -n "^export (type |interface)" packages/core/src/models/agent/Types.ts
```

```1:25:packages/core/src/models/agent/Types.ts
import { listAgentManifests, readAgentManifest, formatAgentLabel } from "./registry";
import { SUPPORTED_AGENT_IDS, type AgentId, isAgentId } from "./Ids";

export { SUPPORTED_AGENT_IDS, formatAgentLabel, isAgentId };
export type { AgentId };

export function listAgentDefinitions() { ... }
export function readAgentDefinition(agentId: AgentId) { ... }
```

25 行，**零类型定义**，全是 `./registry + ./Ids` 转一道手的 facade 函数。

**改造**：改名为 `Definitions.ts`，或者直接合进 `index.ts`。`AGENTS.md` 已有规则：「If a name sounds architectural but the code only does one concrete thing, rename it to the concrete thing.」

---

### P2-4（原 C1）`readAgentManifest` / `formatAgentLabel` 每次重建 Map

❌ Codex 原话：「Map 重建 / registry 没统一这类批评，有一部分可能已经被 IndexedRegistry 之类收掉了。」

**复现**：

```bash
rg -n "new Map<string, AgentManifest>" packages/core/src/models/agent
```

```10:25:packages/core/src/models/agent/registry/Manifest.ts
export function readAgentManifest(agentId: AgentId): AgentManifest {
  const manifestsById = new Map<string, AgentManifest>(
    listAgentManifests().map((manifest) => [manifest.id, manifest]),
  );
  ...
}

export function formatAgentLabel(agentId: string): string {
  const manifestsById = new Map<string, AgentManifest>(
    listAgentManifests().map((manifest) => [manifest.id, manifest]),
  );
  ...
}
```

`IndexedRegistry` 存在但这两处没用。`AgentCapabilities.read()` 也是每次走一遍 `readAgentManifest` + 数组浅拷贝。

**改造**：换成 `IndexedRegistry` 或 module-scope 缓存。

---

## P3 — Codex 同意但说"没那么严重"，可降级

### P3-1（原 B4）`AGENT_DECLARATIONS` 与 `AGENT_MODULES` 双注册

⚠️ Codex 原话：「B4 对 agent 双注册的担心有道理，但已经没它写得那么重了。`Ids.ts` 已经从声明层派生。」

**复现**：

```bash
rg -n "export const AGENT_DECLARATIONS|export const AGENT_MODULES" packages/core/src
rg -n "AGENT_MODULES\.map.*manifest" packages/core/src/models/agent/registry/Manifest.ts
```

```9:15:packages/core/src/models/agent/registry/Declarations.ts
export const AGENT_DECLARATIONS = [
  CODEX_MANIFEST, CURSOR_MANIFEST, CLAUDE_MANIFEST, GEMINI_MANIFEST, OPENCLAW_MANIFEST,
] as const ...
```

```5:7:packages/core/src/models/agent/registry/Manifest.ts
export function listAgentManifests(): AgentManifest[] {
  return AGENT_MODULES.map((module) => module.manifest);
}
```

确认：`Ids.ts` 已经从 `AGENT_DECLARATIONS` 派生，不是独立手写。当前**事实问题**只剩「同一份 manifest 通过两条 import 路径进入 core，仅 `Homes.ts` / `Ids.ts` 用 `AGENT_DECLARATIONS`、其余走 `AGENT_MODULES`」。

**改造（降级为 P3）**：

- 删 `AGENT_DECLARATIONS`，让 `Homes.ts` / `Ids.ts` 也走 `AGENT_MODULES.map(m => m.manifest)`
- 如果发现 tree-shaking 确实需要 narrow import，再保留并加注释说明

---

### P3-2（原 B2）connection policy/support/catalog 过度切片

🆕 Codex 没 raise，但仍是当前 main 的结构债。

**复现**：

```bash
wc -l packages/core/src/models/connection/{Catalog,Support,PresetSupport,AgentPolicy,EnvKeySupport,EnabledAgentsPolicy}.ts
```

| 文件 | 行数 | 实质 |
| --- | --- | --- |
| `Catalog.ts` | 16 | 委托 `PresetSupport` |
| `Support.ts` | 38 | 委托 `CONNECTION_FAMILY_REGISTRY`，导出 `ConnectionSupportKind = ConnectionFamilyId` 这种纯 alias |
| `PresetSupport.ts` | 57 | `buildDefinition` + onboarding |
| `AgentPolicy.ts` | 95 | 按 preset/family 算 enabled agents |
| `EnvKeySupport.ts` | 14 | `agents.some(...AGENT_CAPABILITIES.read(a)...)` |
| `EnabledAgentsPolicy.ts` | 22 | 一个 `reconcile` |

全部 `SHARED_XXX` 单例，处理同一坨数据的不同视角。

**改造**：合成单个 `ConnectionPolicy`，按方法名区分 query；删 `Catalog.ts` / `Support.ts` / `EnvKeySupport.ts` / `EnabledAgentsPolicy.ts`。

---

### P3-3 杂项结构清理（原 B5 / B7 / B8 / B9）

🆕 Codex 没具体表态，作为常规清理。

- **B5** `models/agent/Adapter.ts` 92 行混了 interface + 7 个结果类型 → 拆 `Adapter.ts` / `Results.ts` / `Detection.ts`
- **B7** 5+ store 重复 `static open + fromDatabase + ownedDatabase` 模式 → ownership 集中到 `LocalWorkspaceState`，其余 store 只暴露 `fromDatabase(db)`
- **B8** `runtime-local/` 22 个文件混三层 → 拆 `runtime-local/{agents, session, shared}/`
- **B9** URL/family 推断在 `SavedConnections.ts:237-243`、`EndpointUrl.ts`、`Status.ts:detectedStateFamilyFromEndpoint`、`projection/Url.ts` 四处重复，要收口

---

## P4 — 长期重构 / 风格统一

### P4-1（原 A3）core 反向依赖 agent 包

🆕 Codex 没 raise，但是是 P1-3 / P2-1 的根因。

**复现**：

```bash
rg '"@nile/agent-' packages/core/package.json
rg -n '@nile/agent-' packages/core/src/agents/index.ts
```

```12:16:packages/core/package.json
"@nile/agent-claude": "0.0.0",
"@nile/agent-codex": "0.0.0",
"@nile/agent-cursor": "0.0.0",
"@nile/agent-gemini": "0.0.0",
"@nile/agent-openclaw": "0.0.0",
```

**改造**：第一步先删 `core/src/agents/index.ts`（纯 re-export，删完 apps 自己 import agent 包就好）；最终把 `AGENT_DECLARATIONS`/`AGENT_MODULES`/`CONNECTION_FAMILY_MODULES` 三张表外移到独立的 `@nile/plugins-registry` 包，core 只持有协议。

---

### P4-2（原 A4）`EndpointShape` 把协议家族语义钉死

```bash
rg -n 'protocols\.(openai|anthropic|cursor|gemini)' packages/core/src/models/endpoint/Shape.ts | head
```

187 行的 `Shape.ts` 里 `readFamily / mergeOpenAi / mergeAnthropic / cursorEqual / geminiEqual / openAiContains / anthropicContains` 全是协议家族级语义。`EndpointProtocols = { openai?, anthropic?, cursor?, gemini? }` 锁死了支持集合。这是类型层手术，留到最后做。

---

### P4-3（原 A5）`Builder.inferEnabledAgents` 硬编码协议→agent

```bash
rg -n 'agents\.push' packages/core/src/models/access/Builder.ts
```

```171:183:packages/core/src/models/access/Builder.ts
if (endpoint.protocols.openai) agents.push("codex");
if (endpoint.protocols.anthropic) agents.push("claude");
if (endpoint.protocols.cursor) agents.push("cursor");
```

改为 `AGENT_CAPABILITIES.supportsDetectedProtocols(agentId, protocols)`。

---

### P4-4（原 A7）`Naming.prettifyAzureResource` 走错家

`models/connection/Naming.ts:35-47` 专门处理 `.cognitiveservices.azure.com`——azure-openai preset 的实现细节，应该挪到 azure-openai family / preset module。

---

### P4-5 其它（原 C2~C9）

> Codex 对 C1/C2 有质疑，但其它子项他没特别评论。这一组都是相对独立的小清理。

- **C3** `ConnectionFamilyBehaviorSet` 通用 behavior 集里塞了 `openAiSessionModelCatalogReader`——family-specific 字段应独立成 capability
- **C4** `AccessMatch.ts:47` family-agnostic fallback 应注册为「default access matcher」
- **C5** class + UPPERCASE 单例双导出在 11+ 文件泛滥，二选一
- **C6** `ConnectionPresetModule = { manifest }` 单字段包装层可以删
- **C7** 单方法薄类（`EnabledAgentsPolicy` / `AgentSetupReconciliationReader` / `JwtPayloadDecoder` / `ApplySelectionValidationError` / `ProjectionError`）合并
- **C8** `package.json` `exports` 50+ 子路径，删「一文件一入口」
- **C9** `core/src/agents/` 仅剩 3 个 mutation orchestrator → 挪到 `runtime-local/mutations/`，目录名让位给 `packages/agents/`

---

## E. AGENTS.md 建议补的规则（新一轮）

1. `package.json` `exports` 不允许「一文件一入口」，只能按子目录边界暴露
2. 同一个 registry / policy 不允许同时导出 `class` 和大写 singleton，二选一
3. 形如 `XxxKind = YyyId` 的纯 re-export type alias 直接禁掉（已有规则的细化）
4. `@nile/core` 不允许 `import "@nile/agent-*"` 或 `import "@nile/connections/*"`（除了未来的 `@nile/plugins-registry` 这种专门聚合层）。可以加 `eslint` `no-restricted-imports` 兜底

---

## 执行建议（合并 Codex 意见后）

按 P1 → P4 顺序推进；每完成一阶段写一条 build log，记录 grep 命令的命中数变化（前后对照）。

**P1 三件套（同一轮可一起做）**：

1. **P1-1 NileSession 透传链合并** — 删 `SessionRuntime`，重组 `Session*Resources`
2. **P1-2 Usage registry 化** — 引 `UsageReaderRegistry`，三个 reader 出库到 family
3. **P1-3 session/request switch + StoredCredential 中央 union** — 一次性收口

**P2 是 Codex 误判区，单独一轮**：A2 + A6 + B6 + C1 可以打包成「Cursor surface + 小硬编码清理」一个 PR。

**P3 / P4 之后再排**。
