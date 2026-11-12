# Sender-Receiver CSV 导出规范与修改说明

> **本次修改分支**: G2017
> **修改日期**: 2026-03-03
> **CSV 文件名**: `{experimentName}_SenderReceiver.csv`
> **每行代表**: 一对 sender-receiver 在一个 stage 中的**一个 round** 的完整数据

---

## 目录

1. [修复的 Bug 清单](#1-修复的-bug-清单)
2. [CSV 列总览（52 列，7 个分组）](#2-csv-列总览52-列7-个分组)
3. [每列的操作性定义](#3-每列的操作性定义)
4. [反应时系统详解](#4-反应时系统详解)
5. [数据流全链路追踪](#5-数据流全链路追踪)
6. [修改的文件和代码位置](#6-修改的文件和代码位置)
7. [检查清单](#7-检查清单)

---

## 1. 修复的 Bug 清单

### Bug 1: CSV 列错位 ❌→✅

**修改前的问题**:
```
Headers:  ...Receiver Saw Message Time | Receiver Submitted Time | Attention Check RT (ms)...
数据行:  ...receiverSawMessageTime   | attentionCheckRT        | receiverSubmittedTime ...
```
`Receiver Submitted Time` 和 `Attention Check RT (ms)` 的数据互换了。

**修复**: 重写了整个 `getSenderReceiverCSV()` 函数，headers 和数据行严格一一对应，共 52 列已逐列验证对齐。

**文件**: `frontend/src/shared/file.utils.ts:1580-1735`

---

### Bug 2: attentionCheckReactionTimeMs 从未存储 ❌→✅

**修改前的问题**:
- 前端在 `next_round` payload 中发送 `attentionCheckReactionTimeMs`
- 后端 `handleNextRound(currentData, config, stageId, userId)` 函数签名**不包含 payload 参数**
- 结果: Firestore 中该字段永远是 `null`

**修复**:
1. `handleNextRound` 函数签名增加了 `payload` 参数
2. 在函数体中根据角色写入 `senderAttentionCheckReactionTimeMs` 或 `receiverAttentionCheckReactionTimeMs`
3. 顺便修复了 `shouldAdvance=true` 时 updates 丢失的 bug（原来的 `return { currentRound: ... }` 会覆盖之前的 updates）

**文件**: `functions/src/stages/sender_receiver.endpoints.ts:290-341`

---

### Bug 3: receiverSawMessageTime 从不写入 ❌→✅

**修改前的问题**:
- 前端在 `round.status === 'SHOW_FEEDBACK'` 时触发 `recordReceiverSawMessage()`
- 后端只在 `round.status === 'WAITING_RECEIVER_DECIDE'` 时接受写入
- 状态不匹配 → 后端静默拒绝 → 该字段永远 `null`

**修复**: 将前端触发条件从 `SHOW_FEEDBACK` 改为 `WAITING_RECEIVER_DECIDE`

**文件**: `frontend/src/components/stages/sender_receiver/sender_receiver_participant_view.ts:172`

---

## 2. CSV 列总览（52 列，7 个分组）

| 分组 | 列号 | 列名 | 值类型 |
|------|------|------|--------|
| **实验标识** | 1 | Experiment | string |
| | 2 | Cohort ID | string |
| | 3 | Cohort Name | string |
| | 4 | Stage ID | string |
| | 5 | Stage Name | string |
| **Stage 配置** | 6 | Allow Text Message | boolean |
| **(系统设置)** | 7 | Allow Button Press | boolean |
| | 8 | Sender Time Limit (s) | number \| empty |
| | 9 | Receiver Time Limit (s) | number \| empty |
| | 10 | Num Rounds | number |
| | 11 | State 1 Probability | number |
| | 12 | Payoff Sender A | number |
| | 13 | Payoff Sender B1 | number |
| | 14 | Payoff Sender B2 | number |
| | 15 | Payoff Receiver A | number |
| | 16 | Payoff Receiver B1 | number |
| | 17 | Payoff Receiver B2 | number |
| | 18 | Require Participant Click | boolean |
| | 19 | Default Sender Choice Config | string |
| | 20 | Show Payoff Feedback | boolean |
| | 21 | Enable Truthfulness Feature | boolean |
| **系统随机参数** | 22 | Round | number |
| **(per-round)** | 23 | True State | 1 \| 2 |
| | 24 | Default Sender Choice | A \| B \| empty |
| | 25 | Truthfulness Probability | number \| empty |
| | 26 | Is Honest Round | boolean \| empty |
| | 27 | System Recommendation | A \| B \| empty |
| **参与者标识** | 28 | Sender ID | string |
| | 29 | Receiver ID | string |
| **用户行为** | 30 | Sender Choice | A \| B \| empty |
| | 31 | Sender Message | string (CSV escaped) |
| | 32 | Receiver Choice | A \| B \| empty |
| | 33 | Sender Timed Out | boolean |
| | 34 | Receiver Timed Out | boolean |
| **收益** | 35 | Sender Payoff | number \| empty |
| | 36 | Receiver Payoff | number \| empty |
| | 37 | Sender Cumulative Payoff | number |
| | 38 | Receiver Cumulative Payoff | number |
| **时间戳** | 39 | Start Time | ISO 8601 |
| | 40 | Sender Unlocked Time | ISO 8601 |
| | 41 | Sender Submitted Time | ISO 8601 |
| | 42 | Receiver Unlocked Time | ISO 8601 |
| | 43 | Receiver Saw Message Time | ISO 8601 |
| | 44 | Receiver Submitted Time | ISO 8601 |
| **反应时** | 45 | Sender Reaction Time (s) | number \| empty |
| | 46 | Receiver Reaction Time (s) | number \| empty |
| | 47 | Sender Active Time (s) | number \| empty |
| | 48 | Receiver Active Time (s) | number \| empty |
| | 49 | Sender Attention Check RT (ms) | number \| empty |
| | 50 | Receiver Attention Check RT (ms) | number \| empty |
| **数据质量** | 51 | Sender Anomaly Flag | string |
| | 52 | Receiver Anomaly Flag | string |

---

## 3. 每列的操作性定义

### 分组 A: 实验标识（列 1-5）

这 5 列在同一个实验的同一个 stage 内**每行相同**，用于区分不同实验/cohort/stage。

| # | 列名 | 操作性定义 | 数据来源 |
|---|------|-----------|---------|
| 1 | **Experiment** | 实验名称，由实验创建者在 UI 中设置 | `data.experiment.metadata.name` |
| 2 | **Cohort ID** | Cohort 的自动生成 ID | Firestore document ID |
| 3 | **Cohort Name** | Cohort 显示名称 | `cohortData.cohort.metadata.name` |
| 4 | **Stage ID** | Stage 的自动生成 ID | Firestore document ID |
| 5 | **Stage Name** | Stage 显示名称 | `stageConfig.name` |

---

### 分组 B: Stage 配置 / 系统设置（列 6-21）

这 16 列在同一个 stage 的所有 round 中**每行相同**，代表实验者在 Experiment Builder 中设置的参数。

| # | 列名 | 操作性定义 | 取值范围 |
|---|------|-----------|---------|
| 6 | **Allow Text Message** | 是否允许 sender 输入自定义文字消息 | `true` / `false` |
| 7 | **Allow Button Press** | 是否允许 sender 选择选项按钮（A/B） | `true` / `false` |
| 8 | **Sender Time Limit (s)** | Sender 决策时间限制（秒）。为空表示无限制 | number 或 空 |
| 9 | **Receiver Time Limit (s)** | Receiver 决策时间限制（秒）。为空表示无限制 | number 或 空 |
| 10 | **Num Rounds** | 该 stage（block）的总轮数 | 正整数 |
| 11 | **State 1 Probability** | True State 为 State 1 的概率 | 0-1 之间, 如 `0.5` |
| 12 | **Payoff Sender A** | 当 receiver 选择 A 时 sender 获得的 payoff | number |
| 13 | **Payoff Sender B1** | 当 receiver 选 B 且 True State=1 时 sender 的 payoff | number |
| 14 | **Payoff Sender B2** | 当 receiver 选 B 且 True State=2 时 sender 的 payoff | number |
| 15 | **Payoff Receiver A** | 当 receiver 选择 A 时 receiver 获得的 payoff | number |
| 16 | **Payoff Receiver B1** | 当 receiver 选 B 且 True State=1 时 receiver 的 payoff | number |
| 17 | **Payoff Receiver B2** | 当 receiver 选 B 且 True State=2 时 receiver 的 payoff | number |
| 18 | **Require Participant Click** | 超时未点击时是否将 payoff 设为 0 | `true` / `false` |
| 19 | **Default Sender Choice Config** | Sender 超时时的默认选项策略 | `recommend_A` / `recommend_B` / `random` |
| 20 | **Show Payoff Feedback** | 每轮后是否展示 payoff 反馈 | `true` / `false` |
| 21 | **Enable Truthfulness Feature** | 是否启用 truthfulness 概率功能 | `true` / `false` |

---

### 分组 C: 系统随机参数（列 22-27）

这 6 列**每轮不同**，由系统基于 seeded RNG 预确定，不受参与者行为影响。

| # | 列名 | 操作性定义 | 生成方式 |
|---|------|-----------|---------|
| 22 | **Round** | 当前轮次编号，从 1 开始 | 顺序递增 |
| 23 | **True State** | 系统随机确定的真实状态，只有 sender 可见 | `1` 或 `2`。使用 `generateBalancedDefaults()` + seeded RNG，保证各 state 出现次数精确符合 `state1Probability` |
| 24 | **Default Sender Choice** | 当 sender 超时时系统预设的默认选项 | `A` 或 `B`。基于 config 的 `defaultSenderChoice` 策略，若为 `random` 则用 seeded RNG 平衡分配 |
| 25 | **Truthfulness Probability** | 该轮系统默认消息为 "Beta Market is quiet"（`senderButtonLabel2`，即 System Recommendation = `B`）的概率 / Probability that the default message says "Beta Market is quiet" | 从 `truthfulnessOptions` 数组（如 `[0, 0.5, 1]`）中取值：`0` = 总是 "Busy"，`0.5` = 50/50，`1` = 总是 "Quiet"。仅当 `enableTruthfulnessFeature=true` 时有值 |
| 26 | **Is Honest Round** | 已弃用 / Deprecated | 始终为 `false`（`computeTruthfulnessForRound` 不再使用该字段） |
| 27 | **System Recommendation** | 系统生成的推荐选项 | `A` 或 `B`。honest=推荐 receiver payoff 更高的选项；dishonest=反转。仅当 `enableTruthfulnessFeature=true` 时有值 |

**Seed 确定性**: 所有随机参数使用 `pairSeed = "${senderId}-${receiverId}-${stageId}"` 作为种子，确保同一对参与者在同一 stage 中每次运行结果一致。

---

### 分组 D: 参与者标识（列 28-29）

| # | 列名 | 操作性定义 |
|---|------|-----------|
| 28 | **Sender ID** | 被分配为 Sender 角色的参与者公开 ID |
| 29 | **Receiver ID** | 被分配为 Receiver 角色的参与者公开 ID |

---

### 分组 E: 用户行为（列 30-34）

这 5 列记录参与者在该轮的实际操作。

| # | 列名 | 操作性定义 | 特殊情况 |
|---|------|-----------|---------|
| 30 | **Sender Choice** | Sender 选择的按钮选项 | `A` 或 `B`。为空表示: (a) `allowButtonPress=false`（纯文字模式）, 或 (b) `requireParticipantClick=true` 且 sender 超时未点击 |
| 31 | **Sender Message** | Sender 发送的文字消息 | CSV 转义后的字符串。为空表示 `allowTextMessage=false` 或未输入。超时时可能是系统默认消息 |
| 32 | **Receiver Choice** | Receiver 选择的按钮选项 | `A` 或 `B`。为空表示 `requireParticipantClick=true` 且 receiver 超时未点击 |
| 33 | **Sender Timed Out** | Sender 是否因计时器到期而自动提交 | `true` = 计时器触发提交（sender 可能已点击确认但在等待计时器结束，见下文）; `false` = sender 主动提交（或无时间限制） |
| 34 | **Receiver Timed Out** | Receiver 是否因计时器到期而自动提交 | 同上 |

**Timed Out 的精确含义**:
- 有时间限制时，参与者点击"确认"不会立刻提交，而是锁定选择，等计时器到期才提交
- `Timed Out = true` 意味着参与者**没有点击确认按钮**，由计时器触发了提交
- `Timed Out = false` 意味着参与者**主动点击了确认按钮**（即使最终是计时器触发的网络请求）
- 判断逻辑: `isTimedOut = !hasConfirmedChoice`

---

### 分组 F: 收益（列 35-38）

| # | 列名 | 操作性定义 | 计算公式 |
|---|------|-----------|---------|
| 35 | **Sender Payoff** | Sender 本轮获得的收益 | 由 `calculatePayoffs()` 计算。若 receiver 选 A → `payoffSenderChoiceA`; 选 B 且 state=1 → `payoffSenderChoiceB1`; 选 B 且 state=2 → `payoffSenderChoiceB2`。若 `requireParticipantClick=true` 且 sender 未点击 → `0` |
| 36 | **Receiver Payoff** | Receiver 本轮获得的收益 | 同上逻辑，使用 receiver 的 payoff 配置。若 `requireParticipantClick=true` 且 receiver 未点击 → `0` |
| 37 | **Sender Cumulative Payoff** | Sender 从第 1 轮到当前轮的累计收益 | 按轮次累加 `senderPayoff` |
| 38 | **Receiver Cumulative Payoff** | Receiver 从第 1 轮到当前轮的累计收益 | 按轮次累加 `receiverPayoff` |

---

### 分组 G: 时间戳（列 39-44）

所有时间戳为 ISO 8601 格式（如 `2026-03-03T12:34:56.789Z`），由 **Firebase 服务器** 生成（`Timestamp.now()`），不受客户端时钟影响。

| # | 列名 | 操作性定义 | 何时设置 |
|---|------|-----------|---------|
| 39 | **Start Time** | 该轮正式开始的时间 | Round 1: 双方都点击 "Start Game" 后设置。Round 2+: `createNewRound()` 中立即设置（= 上一轮 `handleNextRound` 的服务器时间） |
| 40 | **Sender Unlocked Time** | Sender 的提交按钮被启用的时间 | 与 Start Time 同时设置（目前相等） |
| 41 | **Sender Submitted Time** | Sender 的操作提交到服务器的时间 | Sender 的信号/消息被后端 `handleSenderSignal()` 接收时的 `Timestamp.now()` |
| 42 | **Receiver Unlocked Time** | Receiver 的选择按钮被启用的时间 | = Sender Submitted Time（同一次 `handleSenderSignal()` 调用中设置） |
| 43 | **Receiver Saw Message Time** | Receiver 首次看到 Sender 消息的时间 | Receiver 的前端检测到 `WAITING_RECEIVER_DECIDE` 状态后自动触发 `receiver_saw_message` 动作 |
| 44 | **Receiver Submitted Time** | Receiver 的选择提交到服务器的时间 | Receiver 的选择被后端 `handleReceiverChoice()` 接收时的 `Timestamp.now()` |

**时间线图**:
```
Round 1:
  Both click "Start Game" ──→ [39] Start Time = [40] Sender Unlocked Time
  Sender submits            ──→ [41] Sender Submitted Time = [42] Receiver Unlocked Time
  Receiver sees message     ──→ [43] Receiver Saw Message Time
  Receiver submits          ──→ [44] Receiver Submitted Time

Round 2+:
  createNewRound()          ──→ [39] Start Time = [40] Sender Unlocked Time (服务器端)
  (Sender 的前端需要等 Firestore listener 推送更新才能看到新一轮，有 ~100ms-1s 延迟)
  后续流程同上
```

---

### 分组 H: 反应时（列 45-50）

#### 四种决策反应时（列 45-48）

系统使用**双重计时机制**来保障数据质量:

| # | 列名 | 操作性定义 | 计算方式 | 计时端 |
|---|------|-----------|---------|--------|
| 45 | **Sender Reaction Time (s)** | Sender 从决策按钮启用到提交的总耗时（秒） | `senderSubmittedTime - senderUnlockedTime` (毫秒差 / 1000) | **服务器端** (Firestore Timestamp) |
| 46 | **Receiver Reaction Time (s)** | Receiver 从选择按钮启用到提交的总耗时（秒） | `receiverSubmittedTime - receiverUnlockedTime` (毫秒差 / 1000) | **服务器端** (Firestore Timestamp) |
| 47 | **Sender Active Time (s)** | Sender 从看到 UI 到点击确认/超时的实际页面活跃时间（秒） | `(decisionClickTimestamp \|\| Date.now()) - pageRenderTimestamp` / 1000 | **客户端** (JavaScript Date.now()) |
| 48 | **Receiver Active Time (s)** | Receiver 从看到 UI 到点击确认/超时的实际页面活跃时间（秒） | 同上 | **客户端** (JavaScript Date.now()) |

**两者关系 & 为什么需要双重计时**:
```
正常情况:
  Server RT ≈ Client AT + Firestore 传播延迟 (~100ms-1s)

刷新/重载页面后:
  Server RT >> Client AT (因为 Client AT 从页面重新渲染后重新开始计时)

具体例子:
  Server RT = 18s (从服务器 unlock 到 submit，跨越了页面刷新)
  Client AT = 3s  (页面刷新后重新渲染到 submit，只有 3 秒)
  → 差值 = 15s >> 5s tolerance → 标记为 possible_refresh
```

#### 注意力检查反应时（列 49-50）

| # | 列名 | 操作性定义 | 触发条件 |
|---|------|-----------|---------|
| 49 | **Sender Attention Check RT (ms)** | Sender 从看到注意力检查弹窗到点击确认的反应时（毫秒） | 在第 3, 6, 9 轮的 `SHOW_FEEDBACK` 阶段出现弹窗，sender点击 "I am here" 后记录 |
| 50 | **Receiver Attention Check RT (ms)** | Receiver 从看到注意力检查弹窗到点击确认的反应时（毫秒） | 同上，receiver 的独立记录 |

**数据流**: 前端 `sr_attention_check.ts` 中 `Date.now() - this.shownAt` → 存入 `this.attentionCheckReactionTimeMs` → 随 `next_round` action 的 payload 发送到后端 → 后端根据 `isSender/isReceiver` 写入对应字段

---

### 分组 I: 数据质量（列 51-52）

| # | 列名 | 操作性定义 | 取值 |
|---|------|-----------|------|
| 51 | **Sender Anomaly Flag** | Sender 数据质量标记 | 见下表 |
| 52 | **Receiver Anomaly Flag** | Receiver 数据质量标记 | 见下表 |

| 标记值 | 含义 | 判定条件 |
|--------|------|---------|
| `no_timeout` | 不适用（参与者未超时） | `timedOut === false` |
| `normal` | 正常（服务器计时与客户端计时一致） | `Server RT - Client AT ≤ 5 seconds` |
| `possible_refresh` | 疑似刷新页面 | `Server RT - Client AT > 5 seconds` |
| `data_missing` | 缺少计时数据，无法判断 | `Server RT === null \|\| Client AT === null` |

**用途**: 在数据分析时过滤掉 `possible_refresh` 的行，因为这些行的 Active Time 不准确。

---

## 4. 反应时系统详解

### 4.1 Server-side Reaction Time（权威来源）

```
代码位置: functions/src/stages/sender_receiver.utils.ts:169-175

export function calculateReactionTime(
  unlockedTime: FirebaseFirestore.Timestamp | null,
  submittedTime: FirebaseFirestore.Timestamp,
): number | null {
  if (!unlockedTime) return null;
  return (submittedTime.toMillis() - unlockedTime.toMillis()) / 1000;
}
```

- **Sender**: 调用点在 `handleSenderSignal()` (endpoints.ts:225)
  - `unlockedTime` = `roundData.senderUnlockedTime` (之前设置的服务器时间)
  - `submittedTime` = `Timestamp.now()` (当前服务器时间)

- **Receiver**: 调用点在 `handleReceiverChoice()` (endpoints.ts:282)
  - `unlockedTime` = `roundData.receiverUnlockedTime`
  - `submittedTime` = `Timestamp.now()`

### 4.2 Client-side Active Time（行为来源）

```
代码位置: sender_receiver_participant_view.ts:485-491

private getActiveTimeSeconds(): number {
    if (this.pageRenderTimestamp === 0) return 0;
    return (
      ((this.decisionClickTimestamp || Date.now()) - this.pageRenderTimestamp) /
      1000
    );
}
```

- `pageRenderTimestamp`: 当 `isMyTurn` 且 round/status 组合首次出现时设置 (line 166)
- `decisionClickTimestamp`: 参与者点击确认按钮时设置 (line 279)
- 如果参与者**已点击确认**: AT = `clickTime - pageRenderTime` (精确的决策时间)
- 如果参与者**未点击(超时)**: AT = `Date.now() - pageRenderTime` (≈ 时间限制)

### 4.3 Round 1 vs Round 2+ 的时间差异

| | Round 1 | Round 2+ |
|---|---------|---------|
| `senderUnlockedTime` 设置时机 | 双方都点击 "Start Game" 后 | `createNewRound()` 中 `Timestamp.now()` |
| Sender 实际看到 UI 的时机 | 点击 Start Game 后立即 | Firestore listener 推送后（延迟 ~100ms-1s） |
| Server RT 包含的额外时间 | 无 | Firestore 传播延迟 |
| Client AT 包含的额外时间 | 无 | 无（从页面渲染开始计） |

这意味着 Round 2+ 的 `Server RT - Client AT` 可能 > 0（但通常 < 1s），在 5s tolerance 内属于正常。

---

## 5. 数据流全链路追踪

### 5.1 一个完整 round 的数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: Round 创建                                                  │
│ 后端 createNewRound() → 写入 Firestore:                            │
│   trueState, defaultSenderChoice, truthfulness 字段                 │
│   startTime, senderUnlockedTime (Round 2+ 立即设置)                 │
└──────────────────────┬──────────────────────────────────────────────┘
                       ↓ Firestore listener 推送到前端
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Sender 决策                                                 │
│ 前端: pageRenderTimestamp = Date.now()                              │
│ 前端: 用户选择选项、输入消息、点击确认                                │
│ 前端: decisionClickTimestamp = Date.now()                           │
│ 前端: 计时器到期 → handleTimeoutSubmit()                            │
│ 前端 → 后端: sender_signal {senderChoice, senderMessage,           │
│               activeTimeSeconds, isTimedOut}                        │
│ 后端: senderSubmittedTime = Timestamp.now()                        │
│       senderReactionTimeSeconds = calculateReactionTime(...)        │
│       senderActiveTimeSeconds = payload.activeTimeSeconds           │
│       receiverUnlockedTime = Timestamp.now() (同时设置)             │
│       status → WAITING_RECEIVER_DECIDE                              │
└──────────────────────┬──────────────────────────────────────────────┘
                       ↓ Firestore listener
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Receiver 看到消息                                           │
│ 前端: 检测到 status=WAITING_RECEIVER_DECIDE → 自动发送              │
│ 前端 → 后端: receiver_saw_message                                   │
│ 后端: receiverSawMessageTime = Timestamp.now()                     │
└──────────────────────┬──────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: Receiver 决策                                               │
│ (流程类似 STEP 2)                                                   │
│ 后端: receiverSubmittedTime, receiverReactionTimeSeconds,           │
│       receiverActiveTimeSeconds, senderPayoff, receiverPayoff       │
│       status → SHOW_FEEDBACK                                        │
└──────────────────────┬──────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: Feedback + Attention Check + Next Round                     │
│ 前端: 在第 3,6,9 轮弹出注意力检查                                   │
│ 前端: 用户点击 "I am here" → 记录 attentionCheckReactionTimeMs      │
│ 前端: 双方点击 "Next" →                                             │
│ 前端 → 后端: next_round {attentionCheckReactionTimeMs}              │
│ 后端: 写入 senderAttentionCheckReactionTimeMs 或                    │
│       receiverAttentionCheckReactionTimeMs (根据角色)                │
│ 后端: 双方都 ready → createNewRound() → 进入下一轮                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 CSV 导出数据流

```
用户点击 "Download" ──→ experiment.manager.ts
                         ↓
                       ExperimentDownload (从 Firestore 获取所有数据)
                         ↓
                       getSenderReceiverData() [file.utils.ts:1430]
                         - 遍历所有 cohort → stage → round
                         - 从 stageConfig 提取系统设置
                         - 从 roundMap 提取每轮数据
                         - 计算 cumulative payoff
                         - 计算 anomaly flags
                         - 返回 SenderReceiverRoundCSVData[]
                         ↓
                       getSenderReceiverCSV() [file.utils.ts:1580]
                         - 生成 headers (52 列)
                         - 将每个 data object 转为 string[]
                         - 返回 string[][] (rows)
                         ↓
                       写入 ZIP 文件 → 浏览器下载
```

---

## 6. 修改的文件和代码位置

### 文件 1: `utils/src/stages/sender_receiver_stage.ts`

| 行号 | 修改内容 |
|------|---------|
| 128 | `attentionCheckReactionTimeMs` 添加 deprecated 注释 |
| 129 | **新增** `senderAttentionCheckReactionTimeMs: number \| null` |
| 130 | **新增** `receiverAttentionCheckReactionTimeMs: number \| null` |

### 文件 2: `functions/src/stages/sender_receiver.endpoints.ts`

| 行号 | 修改内容 |
|------|---------|
| 132 | `handleNextRound` 调用增加 `payload` 参数 |
| 290-341 | `handleNextRound` 函数重写: (a) 签名增加 `payload`; (b) 添加 attention check RT 存储逻辑 (313-320); (c) 修复 `shouldAdvance=true` 时 updates 合并 (326-340) |

### 文件 3: `functions/src/stages/sender_receiver.utils.ts`

| 行号 | 修改内容 |
|------|---------|
| 123-124 | `createNewRound()` 中初始化 `senderAttentionCheckReactionTimeMs: null` 和 `receiverAttentionCheckReactionTimeMs: null` |

### 文件 4: `frontend/.../sender_receiver_participant_view.ts`

| 行号 | 修改内容 |
|------|---------|
| 172 | `round.status` 从 `'SHOW_FEEDBACK'` 改为 `'WAITING_RECEIVER_DECIDE'` |

### 文件 5: `frontend/src/shared/file.utils.ts`

| 行号范围 | 修改内容 |
|----------|---------|
| 1366-1428 | `SenderReceiverRoundCSVData` 接口完全重写：新增 10 个字段，按 7 个分组重排 |
| 1447-1465 | `getSenderReceiverData()` 中新增 10 个 stage config 变量提取 |
| 1488-1572 | `rounds.push()` 完全重写：按新 interface 组织，新增 truthfulness、payoff config 等字段 |
| 1580-1735 | `getSenderReceiverCSV()` 完全重写：52 列 headers + 52 个数据值，按 7 组排列 |

---

## 7. 检查清单

### 你明天可以逐项验证的事项:

**Bug 修复验证**:

- [ ] **Bug 1 (CSV 列错位)**: 打开 `file.utils.ts:1584-1646` (headers) 和 `1650-1731` (data)，逐列对比 header 和 data 是否一一对应。一共 52 列。
- [ ] **Bug 2 (attention check RT)**: 检查 `endpoints.ts:132` 确认 `payload` 被传入 `handleNextRound`。检查 `endpoints.ts:313-320` 确认按角色存储。
- [ ] **Bug 3 (receiverSawMessageTime)**: 检查 `sender_receiver_participant_view.ts:172` 确认条件是 `WAITING_RECEIVER_DECIDE`（不是 `SHOW_FEEDBACK`）。
- [ ] **Bug 3 续**: 检查 `endpoints.ts:253` 确认后端 guard 也是 `WAITING_RECEIVER_DECIDE`（确保前后端一致）。

**数据完整性验证**:

- [ ] 在 `file.utils.ts` 的 interface (`SenderReceiverRoundCSVData`) 中确认包含: `payoffSenderChoiceA/B1/B2`, `payoffReceiverChoiceA/B1/B2`, `requireParticipantClick`, `defaultSenderChoiceConfig`, `showPayoffFeedback`, `enableTruthfulnessFeature`, `truthfulnessProbability`, `isHonestRound`, `systemRecommendation`, `senderAttentionCheckReactionTimeMs`, `receiverAttentionCheckReactionTimeMs`
- [ ] 在 `getSenderReceiverData()` 中确认这些字段都被正确提取（stage config 从 `stageConfig?.xxx` 取，per-round 从 `r.xxx` 取）

**handleNextRound updates 合并验证**:

- [ ] 检查 `endpoints.ts:322-340`：`shouldAdvance=true` 时不再返回 `{currentRound: ...}` 新对象，而是向 `updates` 对象添加 `currentRound` 和 `roundMap` 然后返回 `updates`。这保证了之前添加的 `senderReadyNext/receiverReadyNext` 和 `attentionCheckReactionTimeMs` 不会丢失。

**编译验证**:

- [ ] `npm run build --workspace=utils` 成功
- [ ] `npm run build --workspace=frontend` 成功
- [ ] `npm run build --workspace=functions` 成功

（以上三项已在 2026-03-03 验证通过）
