# 機能仕様書: History機能の実装

## 概要
リポジトリに保存されている過去の議論内容をHistory画面に表示する機能を実装する。現在.magi/discussions/配下にデータは存在するが、読み込み処理が未実装のため空の画面が表示されている問題を解決し、ユーザーが過去の議論を時系列で振り返れるようにする。

## 画面仕様
### History一覧画面
- 目的: 過去に実行した議論の一覧を時系列で表示し、ユーザーが議論履歴を確認できるようにする
- 構成要素: 
  - 議論項目一覧（タイトル、作成日時、モード、ステータス、タスク概要）
  - 状態表示エリア（読み込み中/エラー/空状態/破損ファイル通知）
  - キーボードナビゲーション対応
- 振る舞い: 
  - 最新順（作成日時降順）で議論項目を表示
  - 読み込み状態、エラー状態、空状態の3パターンを適切に表示
  - 破損ファイルが検出された場合は件数を明示的に通知
  - 各項目に適切なaria-labelを設定

## API仕様
### /api/history
- メソッド: GET
- リクエスト: なし
- レスポンス: 
```json
{
  "discussions": [
    {
      "id": "string",
      "title": "string", 
      "createdAt": "ISO8601 datetime",
      "mode": "spec | build",
      "status": "string",
      "taskSummary": "string"
    }
  ],
  "corruptedCount": "number"
}
```

## データモデル
### meta.yaml構造
```yaml
id: string
title: string
createdAt: string (ISO8601)
mode: string (spec | build)
status: string
taskSummary: string # 新規追加フィールド（先頭50文字、30文字未満なら全文）
```

### インデックスファイル構造（.magi/discussions/index.json）
```json
{
  "lastUpdated": "ISO8601 datetime",
  "discussions": [
    {
      "id": "string",
      "title": "string",
      "createdAt": "ISO8601 datetime", 
      "mode": "spec | build",
      "status": "string",
      "taskSummary": "string"
    }
  ]
}
```

## エラーハンドリング
- YAMLパース失敗: 該当項目をスキップし、破損ファイルとしてカウント
- 個別ファイル読み込み失敗: 該当項目をスキップし、破損ファイルとしてカウント
- 破損ファイル数が0以外の場合: レスポンスのcorruptedCountで件数を通知
- Promise.allSettledを使用した並列処理で一部のエラーが全体処理を停止させない
- フロントエンド側で破損ファイル数を画面上部に表示（例: "3件の議論でデータ破損を検出"）

## セキュリティ考慮
- ファイルパス走査攻撃の防止:
  - Node.jsのpath.resolve()で正規化後、.magi/discussions/配下に収まるかboundary checkを実行
  - フォルダ名に`..`を含む場合は除外
  - シンボリックリンク攻撃、null byte injection等への対策を含む
- 入力値検証: ディレクトリ一覧取得時のファイル名検証を実装
- エラー情報の適切なサニタイズ: ファイルパス情報をクライアントに露出させない