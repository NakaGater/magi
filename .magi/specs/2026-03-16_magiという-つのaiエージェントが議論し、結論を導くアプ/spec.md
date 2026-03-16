# 機能仕様書: Magi AI議論システムMVP Phase0検証

## 概要
ビジネスパーソンの意思決定支援を目的とした、2体のAIエージェントによる構造化議論システムの開発可否を判断するための検証フェーズ。技術実現可能性とユーザーニーズの両面から、3つの異なるアプローチパターンを検証し、Phase1開発の要否を決定する。

## 画面仕様
### 検証用プロトタイプ画面
- 目的: 3つの議論パターンのユーザビリティ比較検証
- 構成要素: 
  - テーマ入力フィールド（最大500文字）
  - パターン選択タブ（Simple/Sequential/Contextual）
  - AI応答表示エリア（視覚的区別：色・アイコン・位置）
  - 理解度確認ボタン
  - フィードバック入力フィールド
- 振る舞い: 
  - パターン切り替え時に同一テーマでの出力比較表示
  - 5分以内の理解度測定タイマー表示
  - エラー時の graceful degradation メッセージ表示

### ユーザーヒアリング管理画面
- 目的: Phase0検証データの収集・分析
- 構成要素:
  - ユーザーセッション一覧
  - パターン別満足度グラフ
  - フィードバック集計表示
  - 検証指標ダッシュボード
- 振る舞い:
  - リアルタイムでの検証データ更新
  - CSV出力機能

## API仕様
### POST /api/v0/verify-pattern
- メソッド: POST
- リクエスト: 
  ```json
  {
    "theme": "string (max: 500)",
    "pattern": "simple|sequential|contextual",
    "user_id": "string"
  }
  ```
- レスポンス:
  ```json
  {
    "result": {
      "pattern": "string",
      "responses": [
        {
          "agent": "analytical|intuitive",
          "content": "string",
          "timestamp": "ISO8601"
        }
      ],
      "processing_time": "number",
      "cost_estimate": "number"
    }
  }
  ```

### POST /api/v0/feedback
- メソッド: POST
- リクエスト:
  ```json
  {
    "session_id": "string",
    "understanding_time": "number",
    "satisfaction_score": "1-5",
    "preferred_pattern": "string",
    "willingness_to_pay": "boolean",
    "comments": "string"
  }
  ```
- レスポンス:
  ```json
  {
    "status": "success|error",
    "message": "string"
  }
  ```

### GET /api/v0/verification-metrics
- メソッド: GET
- リクエスト: N/A
- レスポンス:
  ```json
  {
    "total_sessions": "number",
    "pattern_performance": {
      "simple": {
        "avg_understanding_time": "number",
        "avg_satisfaction": "number",
        "cost_per_session": "number"
      },
      "sequential": { /* 同上 */ },
      "contextual": { /* 同上 */ }
    },
    "payment_willingness_rate": "number"
  }
  ```

## データモデル
```sql
-- 検証セッション
CREATE TABLE verification_sessions (
    id UUID PRIMARY KEY,
    user_id VARCHAR(255),
    theme TEXT,
    pattern VARCHAR(50),
    created_at TIMESTAMP,
    processing_time INTEGER,
    cost_estimate DECIMAL(10,4)
);

-- AI応答
CREATE TABLE ai_responses (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES verification_sessions(id),
    agent_type VARCHAR(50),
    content TEXT,
    timestamp TIMESTAMP
);

-- ユーザーフィードバック
CREATE TABLE user_feedback (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES verification_sessions(id),
    understanding_time INTEGER,
    satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5),
    preferred_pattern VARCHAR(50),
    willingness_to_pay BOOLEAN,
    comments TEXT,
    submitted_at TIMESTAMP
);
```

## エラーハンドリング
- **AI API障害時**: 「現在サービスが一時的に利用できません。しばらく経ってから再度お試しください」と表示し、検証継続
- **応答時間超過時（3分以上）**: 「処理に時間がかかっています。別のパターンでお試しいただくか、テーマを簡潔にしてください」
- **不適切な入力検知時**: 「申し訳ございませんが、このテーマは処理できません。別の内容でお試しください」
- **レート制限到達時**: 「アクセスが集中しています。30秒後に再度お試しください」

## セキュリティ考慮
- **入力サニタイゼーション**: SQLインジェクション・XSS対策の実装
- **プロンプトインジェクション検知**: 基本的なキーワードフィルタリング（"ignore previous instructions"等）
- **データ暗号化**: ユーザーセッションIDと入力テーマの暗号化保存
- **ログ分離**: 個人識別情報と検証メトリクスの分離管理
- **アクセス制御**: 検証期間中のIP制限とセッション管理
- **データ保持期間**: 検証終了後30日でデータ自動削除