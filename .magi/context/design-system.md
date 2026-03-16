# Magi — デザインシステム・UI方針

## デザイン原則

- **シンプル、クリーン、情報が自然に読める** — 装飾よりも情報密度
- **ダークテーマ前提** — 長時間の議論閲覧に適した暗色UI
- **ロール別カラーコーディング** — 発言者を即座に識別

## カラーパレット

### ベースカラー（ダークテーマ）
| 用途 | CSS変数 | 値 |
|---|---|---|
| 背景 | --color-bg | #0F1117 |
| サーフェス | --color-surface | #1A1D27 |
| ボーダー | --color-border | #2A2D37 |
| テキスト | --color-text | #E8E8ED |
| テキスト薄 | --color-text-dim | #8888A0 |
| アクセント | --color-accent | #6C8EEF |

### ロールカラー
| ロール | カラー | アイコン | 用途 |
|---|---|---|---|
| PM | #4A90D9（青） | 📊 | ビジネス視点の発言 |
| PD | #E8A838（橙） | 🎨 | ユーザー視点の発言 |
| Dev | #50C878（緑） | ⚙️ | 技術視点の発言 |
| User | #A78BFA（紫） | 👤 | ユーザー介入の発言 |

### 合意ステータス
| ステータス | カラー | アイコン | ラベル |
|---|---|---|---|
| agreed | #50C878 | ✅ | 合意 |
| partial | #E8A838 | 🔶 | 部分合意 |
| disagreed | #E85050 | ❌ | 不一致 |

## UIコンポーネント

### StatementCard
- 左ボーダーにロールカラー
- ロールアイコン + ラベル
- コンテンツは `whitespace-pre-wrap` で表示
- Markdown記法（`##`, `**`, `` ` ``, `- ` 等）を `text-text-dim` で薄色表示（`dimMarkdown()` ユーティリティ使用）

### StageProgress
- 水平パイプライン表示
- ステージ間を線で接続
- waiting: 空丸、active: 塗り丸+pulse、done: チェックマーク

### ConsensusMarker
- ラウンド末尾に配置
- ステータスアイコン + テキスト

### DiscussionLive（議論ビュー）
- ラウンドヘッダー（ステージ名 + Round番号）
- StatementCard群
- ConsensusMarker
- 成果物リスト（📄アイコン）
- コミットリスト（📝アイコン）
- ゲート表示（🚦アイコン）
- 下部にメッセージ入力フォーム（running中のみ）

### StatusBadge
- connecting: グレー
- running: アクセントカラー + pulse
- completed: 緑
- error: 赤

## レイアウト

- ヘッダー: 固定トップバー、ロゴ + ナビリンク（Task, Specs, History）
- メインコンテンツ: `max-w-4xl mx-auto` で中央寄せ
- 議論フィード: `max-h-[calc(100vh-280px)] overflow-y-auto` でスクロール可能領域

## 将来の画面計画

- Web UIオンボーディング画面（非エンジニア向け: 名前+ロール入力のみ）
- 仕様書・ADR個別閲覧画面
- Mermaidダイアグラムのレンダリング表示
- HTMLプロトタイプのiframeプレビュー
- 議論の全文検索・フィルタ機能
