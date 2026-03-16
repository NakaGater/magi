# 機能仕様書: WebUI デザイン改善（段階的実装フレームワーク）

## 概要
エヴァンゲリオン MAGI システムをモチーフにした Web UI テーマ化は、技術的基盤（テスト・アクセシビリティ）とビジネス価値（要望出処・ユーザーニーズ）の検証を前置条件として、v1.1 フェーズで段階的に実装する。MVP リリース（Week 1-2）では基本機能の完成度と品質基盤の確立に注力し、テーマ化は v1.1 再評価後に条件付き実装とする。

---

## 画面仕様

### StatementCard コンポーネント
**目的**：議論ラウンド中の個別発言の表示・識別

**構成要素**：
- ロール別カラーボーダー（左側）：PM 青（#4A90D9）/ PD 橙（#E8A838）/ Dev 緑（#50C878）
- 発言者名・ロール表示
- Markdown レンダリング済みコンテンツ（見出し・リスト・コードブロック対応）
- dim 処理（参考発言の視覚的軽減）
- accessibility 属性（role, aria-label）

**振る舞い**：
- ロール別カラーが背景に埋没しないこと
- Markdown 見出し（h2-h4）がサイズで識別可能
- スクリーンリーダーが発言者名・ロール・内容を正確に読上
- ハイコントラスト表示モード下で視認可能

**受入基準**：
- ✅ ロール別カラーが初見で識別可能
- ✅ Markdown 見出し・リスト・コードブロックが正確に描画
- ✅ NVDA による読上テストで機能名・内容が正確に伝達

---

### StageProgress コンポーネント
**目的**：議論ステージの進捗表示（waiting / active / done）

**構成要素**：
- ステージ名表示
- 進捗インジケーター（テキスト + ビジュアル）
- 状態表示（待機中 / 進行中 / 完了）

**振る舞い**：
- waiting → active → done への状態遷移を表示
- 状態変化がリアルタイム反映
- アクセシブルなテキストラベル提供

**受入基準**：
- ✅ waiting / active / done 状態が正確に描画
- ✅ 状態変更がサーバーサイド更新と同期

---

### ConsensusMarker コンポーネント
**目的**：合意判定結果（agreed / partial / disagreed）の表示

**構成要素**：
- 判定状態を示すアイコン + テキスト
- 判定理由の簡潔説明
- ビジュアルインジケーター

**振る舞い**：
- 判定状態が明確に識別可能
- 色のみに依存しない情報伝達（テキスト併用）

**受入基準**：
- ✅ agreed / partial / disagreed がアイコン + テキストで区別可能
- ✅ 色覚異常ユーザーでも状態判別可能

---

## API仕様

### GET /api/discussions/{discussionId}/messages
**目的**：議論ステージのメッセージ一覧取得

**リクエスト**：
- パラメータ：
  - `discussionId` (string, 必須)：議論 ID
  - `stageId` (string, optional)：ステージ ID（省略時は最新ステージ）
  - `limit` (number, optional)：取得件数（デフォルト: 100）
  - `offset` (number, optional)：オフセット（デフォルト: 0）

**レスポンス**：
```json
{
  "messages": [
    {
      "id": "msg-001",
      "discussionId": "disc-001",
      "stageId": "stage-1",
      "role": "PM",
      "userName": "Alice",
      "rawContent": "This is a requirement",
      "renderedContent": "<h2>Requirements</h2><p>This is a requirement</p>",
      "isDim": false,
      "timestamp": "2024-03-16T10:00:00Z",
      "accessibility": {
        "role": "article",
        "ariaLabel": "Statement from Alice (PM)"
      }
    }
  ],
  "total": 150,
  "hasMore": true
}
```

---

### POST /api/discussions/{discussionId}/messages
**目的**：議論ステージへの新規メッセージ送信

**リクエスト**：
```json
{
  "discussionId": "disc-001",
  "stageId": "stage-1",
  "role": "PM",
  "userName": "Alice",
  "content": "# Requirements\n- Item 1\n- Item 2",
  "metadata": {
    "clientId": "client-uuid"
  }
}
```

**レスポンス**：
```json
{
  "success": true,
  "message": {
    "id": "msg-002",
    "discussionId": "disc-001",
    "stageId": "stage-1",
    "role": "PM",
    "userName": "Alice",
    "rawContent": "# Requirements\n- Item 1\n- Item 2",
    "renderedContent": "<h2>Requirements</h2><ul><li>Item 1</li><li>Item 2</li></ul>",
    "timestamp": "2024-03-16T10:05:00Z"
  }
}
```

**エラーハンドリング**：
- 400：無効なパラメータ（role が enum 外）
- 401：認証エラー
- 409：ステージ状態エラー（ステージが進行中でない）
- 413：コンテンツ長オーバー（max 10,000 文字）

---

### GET /api/discussions/{discussionId}/stages/{stageId}/progress
**目的**：ステージ進捗状況取得

**リクエスト**：
- パラメータ：
  - `discussionId` (string, 必須)
  - `stageId` (string, 必須)

**レスポンス**：
```json
{
  "stageId": "stage-1",
  "stageName": "Requirements Definition",
  "status": "active",
  "progress": {
    "current": 15,
    "total": 20,
    "percentage": 75
  },
  "consensus": {
    "status": "partial",
    "agreedCount": 2,
    "partialCount": 1,
    "disagreedCount": 0
  },
  "updatedAt": "2024-03-16T10:05:00Z"
}
```

---

### GET /api/discussions/{discussionId}/consensus
**目的**：最終合意判定結果取得

**リクエスト**：
- パラメータ：
  - `discussionId` (string, 必須)

**レスポンス**：
```json
{
  "discussionId": "disc-001",
  "finalConsensus": {
    "status": "agreed",
    "timestamp": "2024-03-16T10:30:00Z",
    "reasonSummary": "All 3 roles agreed on the requirement structure"
  },
  "breakdown": {
    "PM": { "status": "agreed", "confidence": 0.95 },
    "PD": { "status": "agreed", "confidence": 0.90 },
    "Dev": { "status": "agreed", "confidence": 0.92 }
  }
}
```

---

### GET /api/accessibility/baseline
**目的**：アクセシビリティベースライン測定結果取得

**リクエスト**：なし

**レスポンス**：
```json
{
  "timestamp": "2024-03-15T00:00:00Z",
  "lighthouse": {
    "accessibility": 85,
    "performance": 88,
    "bestPractices": 90,
    "seo": 92
  },
  "wcag": {
    "levelA": {
      "passed": 18,
      "total": 18,
      "status": "PASS"
    },
    "levelAA": {
      "passed": 23,
      "total": 25,
      "status": "PARTIAL"
    },
    "levelAAA": {
      "passed": 5,
      "total": 15,
      "status": "FAIL"
    }
  },
  "screenReader": {
    "nvdaCompatibility": "PASS",
    "readingOrder": "CORRECT",
    "ariaLabels": "COMPLETE"
  },
  "colorContrastRatios": {
    "primaryText": 7.2,
    "pmRole": 4.8,
    "pdRole": 5.1,
    "devRole": 5.0,
    "minimumRequired": 4.5
  }
}
```

---

### POST /api/spike/evangelion-theme
**目的**：テーマ化技術スパイク測定結果記録

**リクエスト**：
```json
{
  "buildTime": {
    "before": 87,
    "after": 95,
    "unit": "seconds"
  },
  "bundleSize": {
    "before": 152,
    "after": 165,
    "unit": "KB",
    "percentageIncrease": 8.6
  },
  "coreWebVitals": {
    "lcp": 125,
    "fid": 45,
    "cls": 0.05
  },
  "customColorCount": {
    "current": 6,
    "proposed": 15
  },
  "colorBlindSimulation": {
    "protanopia": { "pmBlue": "visible", "pdOrange": "visible", "devGreen": "visible" },
    "deuteranopia": { "pmBlue": "visible", "pdOrange": "visible", "devGreen": "visible" },
    "tritanopia": { "pmBlue": "visible", "pdOrange": "visible", "devGreen": "visible" }
  },
  "verdict": "FEASIBLE_WITH_CONSTRAINTS"
}
```

**レスポンス**：
```json
{
  "success": true,
  "spikeId": "spike-001",
  "recorded": true,
  "timestamp": "2024-03-15T18:00:00Z"
}
```

---

## データモデル

### Message スキーマ
```
{
  id: UUID (PK)
  discussionId: UUID (FK → Discussion)
  stageId: UUID (FK → Stage)
  role: ENUM ['PM', 'PD', 'Dev'] (NOT NULL)
  userName: String (NOT NULL, max: 100)
  rawContent: String (NOT NULL, max: 10000)
  renderedContent: String (NOT NULL, max: 50000)
  isDim: Boolean (default: false)
  timestamp: DateTime (default: NOW, NOT NULL)
  createdAt: DateTime (NOT NULL)
  updatedAt: DateTime (NOT NULL)
  
  Indexes:
    - discussionId, stageId
    - discussionId, timestamp DESC
    - role
}
```

---

### Stage スキーマ
```
{
  id: UUID (PK)
  discussionId: UUID (FK → Discussion)
  name: String (NOT NULL, max: 200)
  status: ENUM ['waiting', 'active', 'done'] (default: 'waiting', NOT NULL)
  messageCount: Integer (default: 0)
  startedAt: DateTime
  completedAt: DateTime
  createdAt: DateTime (NOT NULL)
  updatedAt: DateTime (NOT NULL)
  
  Indexes:
    - discussionId, status
    - discussionId, createdAt
}
```

---

### Consensus スキーマ
```
{
  id: UUID (PK)
  discussionId: UUID (FK → Discussion)
  stageId: UUID (FK → Stage)
  role: ENUM ['PM', 'PD', 'Dev'] (NOT NULL)
  status: ENUM ['agreed', 'partial', 'disagreed'] (NOT NULL)
  confidence: Float (0.0 - 1.0, range: [0, 1])
  reasonText: String (max: 1000)
  recordedBy: String (NOT NULL, max: 100)
  timestamp: DateTime (NOT NULL)
  createdAt: DateTime (NOT NULL)
  updatedAt: DateTime (NOT NULL)
  
  Indexes:
    - discussionId, stageId
    - discussionId, role
}
```

---

### AccessibilityBaseline スキーマ
```
{
  id: UUID (PK)
  version: String (NOT NULL, e.g., "1.0.0", max: 50)
  measurementDate: DateTime (NOT NULL)
  
  lighthouseScores: {
    accessibility: Integer (0-100),
    performance: Integer (0-100),
    bestPractices: Integer (0-100),
    seo: Integer (0-100)
  }
  
  wcagCompliance: {
    levelA: { passed: Integer, total: Integer, status: String },
    levelAA: { passed: Integer, total: Integer, status: String },
    levelAAA: { passed: Integer, total: Integer, status: String }
  }
  
  screenReaderTests: {
    nvdaCompatibility: ENUM ['PASS', 'PARTIAL', 'FAIL'],
    readingOrder: ENUM ['CORRECT', 'ISSUE'],
    ariaLabels: ENUM ['COMPLETE', 'INCOMPLETE', 'MISSING']
  }
  
  colorContrastRatios: {
    primaryText: Float,
    pmRole: Float,
    pdRole: Float,
    devRole: Float,
    minimumRequired: Float
  }
  
  createdAt: DateTime (NOT NULL)
  updatedAt: DateTime (NOT NULL)
  
  Indexes:
    - version
    - measurementDate DESC
}
```

---

### SpikeReport スキーマ
```
{
  id: UUID (PK)
  spikeType: String (e.g., "evangelion-theme", NOT NULL, max: 100)
  
  buildMetrics: {
    timeBefore: Float (seconds),
    timeAfter: Float (seconds),
    delta: Float,
    deltaNormalized: Float (percentage)
  }
  
  bundleMetrics: {
    sizeBefore: Float (KB),
    sizeAfter: Float (KB),
    delta: Float,
    deltaNormalized: Float (percentage),
    threshold: Float (max allowed increase in KB or percentage)
  }
  
  coreWebVitals: {
    lcp: Integer (milliseconds),
    fid: Integer (milliseconds),
    cls: Float (unitless)
  }
  
  customColors: {
    current: Integer,