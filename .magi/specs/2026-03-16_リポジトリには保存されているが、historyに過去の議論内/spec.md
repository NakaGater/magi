# 機能仕様書: History機能の実装

## 概要
保存された議論データの読み込み処理を実装し、ユーザーが過去の議論を適切に確認できる状態を提供する。既存のContextLoaderパターンを流用し、Web UIとCLI両方でHistory機能を提供する。

## 画面仕様
### History一覧画面（Web UI）
- 目的: 過去の議論一覧を時系列で表示し、各議論の基本情報を提供
- 構成要素: 
  - 議論一覧テーブル（id・タイトル・作成日時・モード・ステータス）
  - 状態表示エリア（読み込み中・エラー・空状態）
  - 破損ファイル通知エリア
- 振る舞い: 
  - 議論を作成日時の降順でソート表示
  - 読み込み中はスケルトン表示
  - 空状態では「まだ議論がありません。新しいタスクを作成してみましょう」の誘導メッセージ表示
  - 破損ファイルが存在する場合は件数を通知

### CLI履歴表示
- 目的: コマンドラインから過去の議論一覧を確認
- 構成要素: 基本的な議論情報のテキスト一覧
- 振る舞い: `magi history`コマンドで議論一覧を時系列で表示

## API仕様
### /api/history
- メソッド: GET
- リクエスト: なし
- レスポンス: 
```typescript
{
  discussions: Array<{
    id: string,
    title: string,
    createdAt: string,
    mode: 'spec' | 'build',
    status: string
  }>,
  corruptedCount?: number
}
```

## データモデル
### DiscussionHistoryItem
```typescript
interface DiscussionHistoryItem {
  id: string;           // フォルダ名
  title: string;        // meta.yamlのtaskフィールド
  createdAt: string;    // meta.yamlのcreated_atフィールド
  mode: 'spec' | 'build'; // meta.yamlのmodeフィールド
  status: string;       // meta.yamlのstatusフィールド
}
```

### meta.yamlファイル構造（既存）
```yaml
task: string          # 議論タイトル
created_at: string    # 作成日時
mode: string         # 実行モード
status: string       # ステータス
# taskSummaryフィールド未対応（後方互換性維持）
```

## エラーハンドリング
- **meta.yamlファイル読み込み失敗**: 該当議論をスキップし、破損ファイル数をカウント
- **YAMLパース失敗**: 該当議論をスキップし、破損ファイル数をカウント
- **.magi/discussionsディレクトリ不存在**: 空配列を返却
- **フォルダアクセス失敗**: 該当フォルダをスキップ
- **破損ファイル存在**: レスポンスにcorruptedCountを含めて通知

## セキュリティ考慮
- **ファイルパス**: 既存のpath.joinパターンを使用し、.magi/discussions/配下のアクセスに制限
- **ディレクトリトラバーサル**: フォルダ名に`..`を含む場合は除外
- **ファイル読み込み**: fs.readFileSync使用時のエラーハンドリングでアプリケーション停止を防止