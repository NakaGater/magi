# Magi — 現在の開発状況（2026-03-16時点）

## 全体進捗: MVP の約90%が完成

4パッケージ（core, server, web, cli）全てビルド成功。
Specモード・Buildモードともに議論→成果物生成→Git自動コミットまで動作する。
Specモードは複数回のデモ実行で実際に動作を確認済み。

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

### Server（95%完成）
- Hono.js REST API（12エンドポイント）
- SSEによるリアルタイムイベント配信
- Spec/Build両モードのCRUD
- ユーザーメッセージ介入エンドポイント（POST /api/{spec|tasks}/:id/message）
- 実行中Magiインスタンスの追跡と管理
- 未実装: `/api/history` が空配列を返すのみ

### Web UI（90%完成）
- タスク投入フォーム（Spec/Buildモード選択）
- 議論ライブビュー（SSE接続、自動スクロール、再接続リトライ）
- ステージ進捗バー（waiting/active/done状態）
- StatementCard（ロール別カラー: PM青、PD橙、Dev緑、User紫）
- ConsensusMarker（合意/部分合意/不一致表示）
- 成果物・コミット・ゲート表示
- ユーザーメッセージ入力フォーム（running中のみ表示、Enter送信）
- Spec一覧ページ、History一覧ページ
- ダークテーマ
- Markdown記法の薄色表示（`##`, `**`, `` ` ``, `- ` 等の記法トークンを `text-text-dim` で薄色化。HTMLレンダリングは行わない）

### CLI（60%完成）
- `magi spec <task>` — Specモード実行（--sync, --rounds, --roles-dir オプション）
- `magi build <task>` — Buildモード実行（--quick, --deep, --pause-after, --roles-dir オプション）
- `magi init` — .magi/ディレクトリ初期化
- リッチなターミナル出力（色分け、スピナー、ロールアイコン）
- スタブ: `magi history` — プレースホルダーメッセージのみ
- スタブ: `magi why` — プレースホルダーメッセージのみ

## 未実装・未完成の機能

### 高優先度（MVP完成に必要）
1. **Web UIのフルMarkdownレンダリング** — Phase 1（記法の薄色表示）は完了。Phase 2以降で見出しサイズ変更やリストインデント等の視覚的レンダリングを検討
2. **Buildモードのコード生成** — 現在は議論のみで実際のコード生成・ファイル編集を行わない
3. **LSP統合** — vscode-languageserver-protocolによるシンボルレベルのコード操作（計画にはあるが未着手）
4. **Syncステージの実質的な動作** — 現在はゲートイベントを発行するだけで自動承認。GitHub Projects連携は未実装
5. **`magi history` / `magi why` コマンド** — .magi/discussions/ を読み込んでの検索・一覧（現在はスタブ）
6. **サーバーの `/api/history` エンドポイント** — .magi/discussions/ からの読込（現在は空配列を返す）
7. **テストの追加** — テストファイルが一切存在しない

### 中優先度（MVP後）
8. **Spec→Build連携** — `magi build --spec .magi/specs/xxx/` で仕様書を読み込んで実装
9. **HTMLプロトタイプ生成** — PD視点のUI視覚化（spec.tsのspecifyステージで生成予定）
10. **`magi publish`** — 議論・仕様の静的サイト生成（Next.js Static Export）
11. **`magi sync`** — GitHub Projects APIへのタスク連携
12. **Web UIオンボーディング** — 非エンジニア向けの名前・ロール入力画面
13. **コスト管理・トークン表示** — totalTokens/totalCostは型定義にあるが常に0

### 低優先度（将来拡張）
14. マルチLLM（ロールごとに異なるLLM）
15. Git分岐の自動検出・並行実装比較
16. IDE統合、MCP統合、Hooks
17. Jira/Linear等の他タスク管理ツール連携

## コードベース統計

- ソースファイル数: 31ファイル
- 総コード行数: 約4,500行
- パッケージ数: 4（core: 14ファイル, server: 1, web: 15, cli: 1）
- Webコンポーネント数: 6（Header, TaskForm, DiscussionLive, StageProgress, StatementCard, ConsensusMarker）
- Webページ数: 4（home, discussion/[id], specs, history）
- Webライブラリ: 6ファイル（api.ts, use-magi-events.ts, types.ts, constants.ts, markdown-dim.tsx, layout.tsx）
- APIエンドポイント数: 12（うち1つスタブ）
- ロール定義: 3（PM, PD, Dev）
- テストファイル数: 0
- 実行済みSpec議論: 2件（.magi/specs/、.magi/discussions/に記録）

## 既知の課題・改善ポイント

- Buildモードは議論のみで実質的な実装を行わない — LSP統合が必要
- サーバーはインメモリ管理 — 再起動でタスク状態が消失
- Web UIのNext.js rewriteがSSEをバッファする問題 — 現在はバックエンド直接接続で回避
- totalTokens/totalCostが常に0 — LLMProvider.chat()の戻り値は取れているが集計未実装
- テストが一切ない — ユニットテスト、E2Eテストともに未着手
- Web UIのMarkdown表示はPhase 1（記法薄色表示）のみ — フルレンダリング（見出しサイズ、リストインデント等）は未実装
