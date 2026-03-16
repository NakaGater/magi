# Magi — デザインシステム・UI方針

## デザインテーマ

**エヴァンゲリオンのMAGIシステム**を模した、CRTターミナル風のダークUIを採用。
3台のスーパーコンピュータ（MELCHIOR/BALTHASAR/CASPER）が合議するモチーフ。

## デザイン原則

- **MAGIシステム風の世界観** — CRTスキャンライン、グロー効果、コーナーブラケット装飾
- **グリーンターミナル基調** — 緑色のアクセントカラーでレトロコンピュータ感を演出
- **モノスペースフォント統一** — 'Courier New', 'SF Mono', 'Menlo' でターミナル風
- **ロール別カラーコーディング** — MELCHIOR(青)/BALTHASAR(橙)/CASPER(緑)で即座に識別

## カラーパレット

### ベースカラー（グリーンターミナル風ダークテーマ）
| 用途 | CSS変数 | 値 |
|---|---|---|
| 背景 | --color-bg | #0a0a0a |
| サーフェス | --color-surface | #0d1117 |
| サーフェス2 | --color-surface-2 | #161b22 |
| ボーダー | --color-border | #1a3a2a（緑みのあるボーダー） |
| テキスト | --color-text | #c0e8c0（緑がかったテキスト） |
| テキスト薄 | --color-text-dim | #4a7a5a |
| アクセント | --color-accent | #58f2a5（MAGIグリーン） |

### ロールカラー（MAGI名称）
| MAGI名 | ロール | カラー | アイコン | 用途 |
|---|---|---|---|---|
| MELCHIOR-1 | PM | #4A9AF5（青） | I | ビジネス視点の発言 |
| BALTHASAR-2 | PD | #F5A623（橙） | II | ユーザー視点の発言 |
| CASPER-3 | Dev | #58F2A5（緑） | III | 技術視点の発言 |
| OPERATOR | User | #A78BFA（紫） | >> | ユーザー介入の発言 |

### 合意ステータス
| ステータス | カラー | アイコン | ラベル |
|---|---|---|---|
| agreed | #58F2A5 | >> | GRANTED |
| partial | #F5A623 | >> | PARTIAL |
| disagreed | #F25858 | >> | DENIED |

## CSS効果・装飾

### CRTスキャンライン
`body::after` で画面全体に半透明の水平線を重ねて、CRTモニター感を演出。

### magi-frame（コーナーブラケット）
`::before`/`::after` 疑似要素で左上・右下にアクセントカラーのL字ブラケットを描画。EVA劇中のUI枠を再現。

### magi-glow / magi-glow-strong
`text-shadow` によるテキストグロー効果。glow-strongは二重シャドウ。

### magi-pulse
`@keyframes` でopacity 0.7〜1.0のパルスアニメーション。ステータス表示に使用。

## UIコンポーネント

### ホーム画面（MAGIパネル）
- 逆三角形配置: 上段中央にMELCHIOR-1、下段左右にBALTHASAR-2/CASPER-3
- 各パネル: `w-[300px]`, `p-6`, `magi-frame`装飾
- パネル内: ユニット名（text-lg, magi-glow）、サブタイトル、ステータス（magi-pulse）
- タスクフォーム: Specモードのみ有効（BUILDボタンはdisabled）

### StatementCard
- 左ボーダーにロールカラー
- ローマ数字アイコン（I/II/III/>>）+ MAGI名ラベル
- コンテンツは `whitespace-pre-wrap` で表示
- Markdown記法のブロックレベル対応表示

### StageProgress
- 水平パイプライン表示（PROC.01〜05 / EXEC.01〜05）
- ステージ間を線で接続
- waiting: 空丸、active: 塗り丸+pulse、done: チェックマーク

### ConsensusMarker
- ラウンド末尾に配置
- GRANTED/PARTIAL/DENIEDステータス表示

### DiscussionLive（議論ビュー）
- ラウンドヘッダー（ステージ名 + Round番号）
- StatementCard群
- ConsensusMarker
- 成果物リスト
- コミットリスト
- ゲート表示
- 下部にメッセージ入力フォーム（running中のみ）

### StatusBadge
- connecting: グレー
- running: アクセントカラー + pulse
- completed: 緑
- error: 赤

## レイアウト

- ヘッダー: 固定トップバー、"MAGI" + "SYSTEM v2.5"、ナビリンク（TASK, SPECS, LOG）
- メインコンテンツ: `max-w-4xl mx-auto` で中央寄せ
- 議論フィード: `max-h-[calc(100vh-280px)] overflow-y-auto` でスクロール可能領域

## 将来の画面計画

- Web UIオンボーディング画面（非エンジニア向け: 名前+ロール入力のみ）
- 仕様書・ADR個別閲覧画面
- Mermaidダイアグラムのレンダリング表示
- HTMLプロトタイプのiframeプレビュー
- 議論の全文検索・フィルタ機能
