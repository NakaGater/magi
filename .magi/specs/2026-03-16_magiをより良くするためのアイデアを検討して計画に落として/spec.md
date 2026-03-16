# 機能仕様書: Magi システム改善のための現状分析・調査プラットフォーム

## 概要
Magi システムの真の課題を特定し、データドリブンな改善計画を策定するための現状分析プラットフォーム。ユーザー体験、技術的課題、ビジネスインパクトを総合的に分析し、優先度の高い改善項目を特定する調査・分析システムを構築する。

## 画面仕様
### 調査ダッシュボード画面
- 目的: 現状分析プロジェクトの進捗とKPI可視化
- 構成要素: 
  - プロジェクト進捗ステータス（調査フェーズ、分析フェーズ、優先順位付けフェーズ）
  - アナリティクスデータ概要（離脱率、利用頻度、ユーザー行動パターン）
  - ユーザビリティテスト進捗（参加者数、タスク完了率、主要な発見）
  - 技術監査ステータス（パフォーマンス、セキュリティ、コード品質）
- 振る舞い: リアルタイムデータ更新、フィルタリング機能、CSVエクスポート機能

### アナリティクス分析画面
- 目的: ユーザー行動データの詳細分析と離脱ポイント特定
- 構成要素:
  - ファンネル分析チャート
  - ヒートマップ表示
  - セッション録画再生機能
  - 離脱ポイント詳細テーブル
- 振る舞い: 期間フィルタ、セグメント別表示、異常値アラート機能

### 課題優先順位付け画面
- 目的: 特定された課題の多軸評価と優先順位決定
- 構成要素:
  - 課題一覧テーブル（ビジネスインパクト、実装コスト、技術的実現性、ユーザビリティインパクトの4軸評価）
  - 優先度マトリクス表示
  - ROI計算機能
  - 改善提案入力フォーム
- 振る舞い: ドラッグ&ドロップによる優先順位調整、評価軸重み付け変更機能

## API仕様
### GET /api/analytics/funnel
- メソッド: GET
- リクエスト: `{ "startDate": "2024-01-01", "endDate": "2024-01-31", "segment": "new_users" }`
- レスポンス: `{ "funnelData": [{"step": "landing", "users": 1000, "dropoffRate": 0.2}], "status": "success" }`

### POST /api/usability-test/session
- メソッド: POST
- リクエスト: `{ "participantId": "P001", "taskId": "T001", "completionTime": 120, "success": true, "feedback": "操作が直感的でない" }`
- レスポンス: `{ "sessionId": "S001", "status": "recorded", "nextTask": "T002" }`

### GET /api/performance/metrics
- メソッド: GET
- リクエスト: `{ "metric": "core-web-vitals", "timeRange": "7d" }`
- レスポンス: `{ "lcp": 2.1, "fid": 85, "cls": 0.08, "trend": "improving", "status": "good" }`

### POST /api/issues/prioritize
- メソッド: POST
- リクエスト: `{ "issueId": "I001", "businessImpact": 8, "implementationCost": 6, "technicalFeasibility": 9, "usabilityImpact": 7 }`
- レスポンス: `{ "priorityScore": 7.5, "rank": 3, "recommendedAction": "implement", "estimatedROI": 2.8 }`

## データモデル
```sql
-- 調査プロジェクト管理
CREATE TABLE investigation_projects (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phase ENUM('planning', 'data_collection', 'analysis', 'prioritization', 'completed'),
  start_date DATE,
  target_completion_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 特定された課題
CREATE TABLE identified_issues (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES investigation_projects(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category ENUM('usability', 'performance', 'security', 'business'),
  business_impact_score INT CHECK (business_impact_score BETWEEN 1 AND 10),
  implementation_cost_score INT CHECK (implementation_cost_score BETWEEN 1 AND 10),
  technical_feasibility_score INT CHECK (technical_feasibility_score BETWEEN 1 AND 10),
  usability_impact_score INT CHECK (usability_impact_score BETWEEN 1 AND 10),
  priority_rank INT,
  estimated_roi DECIMAL(5,2),
  status ENUM('identified', 'analyzing', 'prioritized', 'approved', 'in_progress'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ユーザビリティテストセッション
CREATE TABLE usability_test_sessions (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES investigation_projects(id),
  participant_id VARCHAR(50),
  task_id VARCHAR(50),
  completion_time_seconds INT,
  success BOOLEAN,
  feedback TEXT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## エラーハンドリング
- **データ収集エラー**: アナリティクスAPI接続失敗時は過去データで代替表示、エラーログ記録
- **ユーザビリティテストエラー**: セッション録画失敗時は手動入力フォールバック、参加者への通知機能
- **パフォーマンス監視エラー**: 監視ツールタイムアウト時はSynthetic監視で補完、アラート通知
- **優先順位計算エラー**: 評価軸データ不足時はデフォルト値適用、確認プロンプト表示
- **権限エラー**: 役割別アクセス制御、不正アクセス試行の監査ログ記録

## セキュリティ考慮
- **データプライバシー**: ユーザー行動データの匿名化処理、GDPR準拠のデータ保持期間設定
- **アクセス制御**: PM/PD/開発者の役割別権限管理、多要素認証の実装
- **データ暗号化**: 保存データのAES-256暗号化、転送データのTLS 1.3使用
- **監査ログ**: すべてのデータアクセスと変更操作のログ記録、改ざん検知機能
- **APIセキュリティ**: レート制限、入力値検証、SQLインジェクション対策の実装