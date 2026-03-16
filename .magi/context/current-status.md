# Magi — 現在の開発状況（2026-03-16時点）

## 全体進捗: MVP の約95%が完成

4パッケージ（core, server, web, cli）全てビルド成功。
Specモード・Buildモードともに議論→成果物生成→Git自動コミットまで動作する。
Specモードは複数回のデモ実行で実際に動作を確認済み。
Web UIはエヴァンゲリオンのMAGIシステム風デザインに刷新済み。

## 実装済み機能

### Core（95%完成）
- 3ロール議論エンジン（Round制、合意判定マーカーベース）
  - `evaluateConsensus()` は `✅ 合意` / `❌ 却下` / `⚠️ 懸念` の3マーカーを認識
  - `minRounds`（デフォルト2）で早期収束を防止
- Specパイプライン全5ステージ（elaborate→specify→decide→plan→sync）
  - 各ステージで成果物自動生成: requirements.md, spec.md, ADR, tasks.yaml, flow.mermaid
  - ステージ間でコンテキストを蓄積（前ステージの成果物を次に渡す）
  - plan完了後に成果物リコンシリエーション（全議論を反映してreq/spec/mermaidを再生成）
  - リコンシリエーション時にADR情報を注入し、延期・却下された技術を成果物に含めない
  - Mermaid生成時にもADR情報を参照し、延期・却下された機能を除外
- Buildパイプライン全5ステージ（analysis→design→implement→review→verify）
  - 議論ベース（コード生成は未実装）
  - design後の自動停止ゲート
- 永続コンテキスト読込（.magi/context/*.md）
- コードベースコンテキスト自動抽出（APIエンドポイント、設定ファイル形式、LLMプロバイダー）
- 過去議論の自動参照（キーワードマッチ）
- Git自動コミット（ステージ完了ごと）
- 議論ログのMarkdown生成（meta.yaml, summary.md含む、空ラウンドのステージには説明文）
- ユーザーメッセージ介入（pendingMessagesキュー、ラウンド間でドレイン）
- LLM出力のコードフェンス自動除去（`SpecWriter.sanitize()`）
- バリデーション（成果物品質チェック、validation_warningイベント発行）
- コンテキスト同期（ステージ完了時にcurrent-status.md等を更新、context_syncedイベント発行）

### Server（98%完成）
- Hono.js REST API（12エンドポイント）
- SSEによるリアルタイムイベント配信
- Spec/Build両モードのCRUD
- ユーザーメッセージ介入エンドポイント（POST /api/{spec|tasks}/:id/message）
- 実行中Magiインスタンスの追跡と管理
- `/api/history` — ディスクベースの過去議論一覧・詳細取得
- `/api/specs` — インメモリ実行中 + ディスクベース完了済みのマージ表示
- APIキー検証（ANTHROPIC_API_KEY未設定時に503を返す）

### Web UI（95%完成）
- **MAGIシステム風デザイン**（エヴァンゲリオン劇中再現）
  - ホーム画面: 3台のMAGIコンピュータパネルを逆三角形配置（上段中央: MELCHIOR-1、下段左右: BALTHASAR-2/CASPER-3）
  - パネルサイズ: 各300px幅、p-6パディング
  - CRTスキャンラインオーバーレイ（body::after）
  - magi-frameコーナーブラケット装飾（EVA風）
  - magi-glow / magi-glow-strong テキストグロー効果
  - magi-pulse アニメーション（ステータス表示）
  - ロール名をMAGI名称に変更: PM→MELCHIOR-1、PD→BALTHASAR-2、Dev→CASPER-3、User→OPERATOR
  - ロールアイコンをローマ数字に変更: I, II, III, >>
  - ステージ名にPROC.01〜05 / EXEC.01〜05プレフィックス
  - 合意ステータスをGRANTED/PARTIAL/DENIEDに変更
  - グリーン基調のターミナル風カラーパレット（アクセント: #58f2a5）
  - ヘッダー: "MAGI SYSTEM v2.5"表記、ナビはTASK/SPECS/LOG
- タスク投入フォーム（Specモードのみ有効、**BUILDボタンはdisabled**）
- 議論ライブビュー（SSE接続、自動スクロール、再接続リトライ）
- ステージ進捗バー（waiting/active/done状態）
- StatementCard（ロール別カラー: MELCHIOR青、BALTHASAR橙、CASPER緑、OPERATOR紫）
- ConsensusMarker（GRANTED/PARTIAL/DENIED表示）
- 成果物・コミット・ゲート表示
- ユーザーメッセージ入力フォーム（running中のみ表示、Enter送信）
- Spec一覧ページ（実行中→ライブビュー、完了→履歴詳細へリンク）
- History一覧ページ、History詳細ページ
- ダークテーマ（グリーンターミナル風）
- Markdown記法のブロックレベル対応表示
- 404ページ、エラーバウンダリページ
- 課題バナー表示

### CLI（85%完成）
- `magi start` — サーバー+Web UI一括起動（--dev, --no-open, ポート指定対応）
- `magi spec <task>` — Specモード実行（--sync, --rounds, --roles-dir オプション）
- `magi build <task>` — Buildモード実行（--quick, --deep, --pause-after, --roles-dir オプション）
- `magi init` — .magi/ディレクトリ初期化
- `magi history [keyword]` — 過去の議論履歴一覧（キーワードフィルタ対応）
- `magi why <keyword>` — 判断理由検索（ContextReferenceEngine利用）
- リッチなターミナル出力（色分け、スピナー、ロールアイコン）
- クロスプラットフォームのブラウザ起動（macOS/Linux/Windows）

## 未実装・未完成の機能

### 高優先度（MVP完成に必要）
1. **Web UIのフルMarkdownレンダリング** — ブロックレベル対応は完了。フルHTMLレンダリング（見出しサイズ、リストインデント等）は未実装
2. **Buildモードのコード生成** — 現在は議論のみで実際のコード生成・ファイル編集を行わない。Web UIのBUILDボタンもdisabled状態
3. **LSP統合** — vscode-languageserver-protocolによるシンボルレベルのコード操作（計画にはあるが未着手）
4. **Syncステージの実質的な動作** — 現在はゲートイベントを発行するだけで自動承認。GitHub Projects連携は未実装
5. **テストの追加** — テストファイルが一切存在しない

### 中優先度（MVP後）
6. **Spec→Build連携** — `magi build --spec .magi/specs/xxx/` で仕様書を読み込んで実装
7. **HTMLプロトタイプ生成** — PD視点のUI視覚化（spec.tsのspecifyステージで生成予定）
8. **`magi publish`** — 議論・仕様の静的サイト生成（Next.js Static Export）
9. **`magi sync`** — GitHub Projects APIへのタスク連携
10. **Web UIオンボーディング** — 非エンジニア向けの名前・ロール入力画面
11. **コスト管理・トークン表示** — totalTokens/totalCostは型定義にあるが常に0

### 低優先度（将来拡張）
12. マルチLLM（ロールごとに異なるLLM）
13. Git分岐の自動検出・並行実装比較
14. IDE統合、MCP統合、Hooks
15. Jira/Linear等の他タスク管理ツール連携

## コードベース統計

- ソースファイル数: 34ファイル
- 総コード行数: 約5,000行
- パッケージ数: 4（core: 14ファイル, server: 1, web: 18, cli: 1）
- Webコンポーネント数: 6（Header, TaskForm, DiscussionLive, StageProgress, StatementCard, ConsensusMarker）
- Webページ数: 7（home, discussion/[id], specs, history, history/[id], not-found, error）
- Webライブラリ: 6ファイル（api.ts, use-magi-events.ts, types.ts, constants.ts, markdown.tsx, layout.tsx）
- APIエンドポイント数: 12
- ロール定義: 3（PM, PD, Dev）
- テストファイル数: 0
- 実行済みSpec議論: 複数件（.magi/specs/、.magi/discussions/に記録）

## 既知の課題・改善ポイント

- Buildモードは議論のみで実質的な実装を行わない — LSP統合が必要
- サーバーはインメモリ管理 — 再起動でタスク状態が消失（ただし/api/specsはディスクからも読み込み）
- Web UIのNext.js rewriteがSSEをバッファする問題 — 現在はバックエンド直接接続で回避
- totalTokens/totalCostが常に0 — LLMProvider.chat()の戻り値は取れているが集計未実装
- テストが一切ない — ユニットテスト、E2Eテストともに未着手
