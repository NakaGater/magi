# 機能仕様書: Magi Phase1リリース - Specモード特化版

## 概要
現在90%完成のMVPにおいて、Buildモードの複雑な実装を後回しにし、Specモードを完全化してAI3ロール議論による要件定義自動化ツールとして先行リリースする。最小実装アプローチにより4週間でのリリースを実現し、SQLite永続化はPhase2で実装する。

## 画面仕様
### メイン画面
- 目的: モード選択とSpec議論の実行
- 構成要素: Specモードボタン、Buildモードボタン（Coming Soon表示）、議論進行状況表示エリア
- 振る舞い: Specモード選択時は議論を開始、Buildモード選択時はComing Soon画面を表示

### 議論進行画面
- 目的: AI3ロール議論の可視化と進捗管理
- 構成要素: ラウンド進捗バー、各ロール（PM/PD/Dev）の発言表示、ユーザー介入ボタン、エラー時の再試行ボタン
- 振る舞い: リアルタイムで議論進捗を更新、エラー時は前ラウンドからの再試行オプションを提供

### History画面
- 目的: 過去の議論履歴の閲覧
- 構成要素: 議論一覧テーブル、詳細表示エリア、生成物プレビュー（ADR、要件定義書、Mermaidダイアグラム）
- 振る舞い: `.magi/discussions/`から過去議論を読み込み、選択された議論の詳細と生成物を表示

### Coming Soon画面
- 目的: Buildモードの期待管理
- 構成要素: 「Coming Soon」メッセージ、Phase2タイムライン（2026年5月予定）、機能概要説明
- 振る舞い: ユーザーの期待を管理し、Phase2への継続利用を促進

## API仕様
### POST /api/discussions/start
- メソッド: POST
- リクエスト: `{ "topic": string, "requirements": string[] }`
- レスポンス: `{ "taskId": string, "status": "started" }`

### GET /api/discussions/{taskId}/status
- メソッド: GET
- リクエスト: taskId（パスパラメータ）
- レスポンス: `{ "taskId": string, "currentRound": number, "status": string, "lastUpdate": string }`

### POST /api/discussions/{taskId}/retry
- メソッド: POST
- リクエスト: taskId（パスパラメータ）
- レスポンス: `{ "taskId": string, "resumedFromRound": number, "status": "retrying" }`

### GET /api/discussions/history
- メソッド: GET
- リクエスト: なし
- レスポンス: `{ "discussions": [{ "id": string, "topic": string, "createdAt": string, "status": string }] }`

### GET /api/discussions/{id}/details
- メソッド: GET
- リクエスト: id（パスパラメータ）
- レスポンス: `{ "discussion": object, "adr": string, "requirements": string, "diagrams": string[] }`

## データモデル
```typescript
interface SessionState {
  taskId: string;
  currentStage: string;
  currentRound: number;
  lastSuccessfulRound: DiscussionRound;
  createdAt: string;
  topic: string;
  status: 'running' | 'completed' | 'error' | 'paused';
}

interface DiscussionRound {
  round: number;
  pmResponse: string;
  pdResponse: string;
  devResponse: string;
  consensus: boolean;
  timestamp: string;
}

interface DiscussionHistory {
  id: string;
  topic: string;
  rounds: DiscussionRound[];
  finalOutput: {
    adr: string;
    requirements: string;
    diagrams?: string[];
  };
  createdAt: string;
  completedAt?: string;
}
```

## エラーハンドリング
### LLM API失敗
- エラーケース: OpenAI/Anthropic API接続失敗、レート制限、認証エラー
- 対応: 5秒以内にエラー通知表示、「前ラウンドから再試行」ボタン提供、セッション状態は`.magi/sessions/{task-id}.json`に保存

### Git操作失敗
- エラーケース: ファイル書き込み権限エラー、.magiディレクトリ作成失敗
- 対応: エラーメッセージと推奨解決策を表示、手動でのディレクトリ作成ガイダンス提供

### セッション復旧エラー
- エラーケース: セッションファイル破損、不整合状態
- 対応: 新しい議論として開始オプション提供、破損ファイルの安全な削除機能

### ネットワークエラー
- エラーケース: インターネット接続断、タイムアウト
- 対応: オフライン状態の検知、再接続時の自動復旧、ローカルキャッシュ活用

## セキュリティ考慮
### APIキー管理
- 環境変数（`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`）での管理
- `.magi/config.json`でのローカル保存（gitignore対象）
- キー情報のログ出力禁止

### データ保護
- 議論データはローカル実行前提（`.magi/`ディレクトリ内）
- 機密情報の外部送信は明示的な同意後のみ
- Phase2でのアクセス制御機構検討（現Phase1では対象外）

### 入力検証
- ユーザー入力のサニタイゼーション
- LLM APIへの送信前のコンテンツフィルタリング
- ファイルパス操作時のディレクトリトラバーサル対策

### 実行環境
- ローカル実行のみサポート（Phase1）
- 外部サーバーへのデータ送信最小化
- ログファイルでの機密情報記録回避