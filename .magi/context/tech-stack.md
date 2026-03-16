# Magi — 技術スタック・アーキテクチャ

## モノレポ構成

pnpm workspaces + Turborepo によるモノレポ。

```
magi/
├── packages/
│   ├── core/     # ビジネスロジック（TypeScript, tsup）
│   ├── server/   # HTTP API（Hono, SSE）
│   ├── web/      # フロントエンド（Next.js 15, React 19, Tailwind v4）
│   └── cli/      # CLIクライアント（Commander.js, chalk, ora）
├── roles/        # ロール定義YAML（pm.yaml, pd.yaml, dev.yaml）
└── .magi/        # 議論ログ・仕様・コンテキスト
```

## 技術選定

| レイヤー | 技術 | バージョン |
|---|---|---|
| Core | TypeScript + tsup | TS 5.9, tsup 8.5 |
| LLM | Anthropic SDK (Claude Sonnet) | SDK 0.39 |
| API Server | Hono + @hono/node-server | Hono 4.7 |
| Web UI | Next.js + Tailwind CSS | Next 15.5, Tailwind 4.0 |
| CLI | Commander.js + chalk + ora | Commander 13 |
| Git | simple-git | 3.27 |
| Build | Turborepo + pnpm | Turbo 2.8, pnpm 10.29 |

## Core パッケージの内部構造

```
packages/core/src/
├── types.ts              # 全型定義 + DEFAULT_CONFIG
├── magi.ts               # Magiファサードクラス
├── llm/provider.ts       # Anthropic SDK ラッパー
├── roles/engine.ts       # ロール読込 + ラウンド実行 + 合意判定
├── discussion/protocol.ts # 議論ループ + ユーザー介入キュー
├── pipeline/
│   ├── spec.ts           # Specパイプライン (elaborate→specify→decide→plan→sync)
│   └── runner.ts         # Buildパイプライン (analysis→design→implement→review→verify)
├── spec/
│   ├── writer.ts         # 仕様書・ADR・Mermaid生成（LLM使用）
│   └── planner.ts        # タスクリスト生成（LLM使用）
├── context/
│   ├── loader.ts         # .magi/context/ からMD読込
│   └── reference.ts      # 過去議論のキーワードマッチ参照
├── git/manager.ts        # Git操作（commit, branch, push）
└── logger/writer.ts      # 議論ログのMarkdown生成
```

## サーバーアーキテクチャ

- Hono.js の単一ファイルサーバー（`packages/server/src/index.ts`）
- インメモリでタスク状態を管理（`activeTasks: Map`）
- SSE（Server-Sent Events）でリアルタイムイベント配信
- `activeMagiInstances: Map` で実行中のMagiインスタンスを追跡
- ユーザーメッセージ介入: `POST /api/{spec|tasks}/:id/message`
- デフォルトポート: 3400

## Web UI アーキテクチャ

- Next.js 15 App Router + React 19
- SSEクライアント (`use-magi-events.ts`) で `useReducer` ベースの状態管理
- バックエンドSSEに直接接続（Next.js rewriteはSSEをバッファするため回避）
- Tailwind v4 でダークテーマ
- コンポーネント: TaskForm, DiscussionLive, StageProgress, StatementCard, ConsensusMarker, Header

## データフロー

```
ユーザー → Web UI / CLI → Server (Hono)
  → Magi.spec() or Magi.build()
    → DiscussionProtocol.discuss()
      → RoleEngine.runRound() × maxRounds
        → LLMProvider.chat() (Anthropic API)
    → SpecWriter / SpecPlanner (成果物生成)
    → GitManager.commit() (自動コミット)
    → MagiEvent emit → SSE broadcast → Web UI更新
```

## 規約

- ビルド: `pnpm build` (Turborepo経由で全パッケージビルド)
- 開発: `pnpm dev` (各パッケージのdevサーバー起動)
- コミットプレフィックス: spec時は `{stage}: {task}`, build時は `{analysis|design|feat|fix|test}: {task}`
- 日本語UI・日本語プロンプト
