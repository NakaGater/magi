# 要件精緻化 (Elaborate)

Stage: elaborate
Rounds: 2

### Round 1

Consensus: **disagreed**

#### 【PM】
_2026-03-16T06:57:13.646Z_

【PM】このHistoryの表示バグは、ユーザーが過去の議論を振り返れない状況を作っており、学習やナレッジ共有を阻害している重要な課題です。

⚠️ 懸念: 現在の実装状況を見ると、サーバーサイド（`/api/history`が空配列返し）とCLI（`magi history`がスタブ）の両方が未実装です。Web UIのHistory一覧ページも恐らくこのAPIに依存しているため、バックエンド修正が必須です。

MVP完成まで残り10%の時点で、この機能の優先度判断が重要です。Historyは「過去を見る機能」なので、新規ユーザーには即座に価値を提供しませんが、継続利用するユーザーには必須の機能です。

ビジネス的には、議論の蓄積と検索可能性がMagiの差別化要素の一つ（「なぜそう作ったか不明」→「議論の経緯がGitに残る」）なので、MVP範囲に含めるべきだと考えます。

ただし、実装スコープは最小限に絞り、単純な時系列一覧+基本検索のみでリリースすべきです。

#### 【PD】
_2026-03-16T06:57:25.024Z_

【PD】⚠️ 懸念: PMの指摘に同意しつつ、UX観点での課題を追加したい。

現在の状況で最も問題なのは、ユーザーが「議論が保存されている」と期待してHistory画面に行くと**空の画面**に遭遇することです。これは「システムが壊れている」という印象を与え、信頼を損なう典型的なパターンです。

エラーハンドリングの視点から：
- 空の場合の適切な状態表示（「まだ議論がありません」vs「読み込み中」vs「エラー」）
- ローディング状態の管理
- データが存在するのに表示されない場合のフォールバック

アクセシビリティの懸念：
- 過去の議論を参照できないことで、聴覚・視覚障害のあるユーザーが議論の文脈を掴みにくい
- スクリーンリーダー利用者が時系列ナビゲーションできない

開発の容易さとユーザビリティは別物：APIが空配列を返すのは実装しやすいが、ユーザーは「なぜ自分の議論が見えないのか」を理解できません。

最小限実装でも、せめて.magi/discussionsの一覧表示とタイトル+日付による識別は必要です。検索は後回しでも構いません。

#### 【Dev】
_2026-03-16T06:57:39.105Z_

【Dev】⚠️ 懸念: PM・PDの指摘は的確ですが、技術的な実現方法と制約を整理する必要があります。

現在の実装状況から見ると、データは確実に存在しています（.magi/discussions/配下にmeta.yaml, summary.md等が生成済み）。問題は「読み込み処理」が未実装なだけです。

技術的な課題分析：
1. **データ構造の一貫性**: .magi/discussions/の各フォルダにmeta.yamlがあるが、history表示に必要な情報（タイトル、日付、ステータス、モード）が十分揃っているか検証が必要
2. **パフォーマンス**: ディスカリ読み込みは初期は問題ないが、議論数が増えるとI/O負荷が課題になる
3. **同期の問題**: 実行中のタスクとHistory表示の整合性（実行中のものをHistoryに含めるか）

セキュリティリスク：
- ファイルパス走査攻撃への対策（../ 等での親ディレクトリアクセス）
- メタデータ読み込み時のYAMLパース例外処理

実装優先度の提案：
1. サーバー側：ContextLoader.buildReferenceContext()のロジックを参考にして.magi/discussions/スキャン機能を実装
2. 最小限のフィールド：タイトル、作成日時、モード（spec/build）、ステータス
3. CLI側も同じロジックを使用してDRY原則維持

MVPに含めるべきか？データ読み込み自体は1-2時間の実装ですが、エラーハンドリングとテストまで含めると工数が膨らみます。

### Round 2

Consensus: **agreed**

#### 【PM】
_2026-03-16T06:57:52.784Z_

【PM】✅ 合意: Dev指摘の「データは存在するが読み込み処理が未実装」という技術分析と、PDが言及した「空の画面がユーザー信頼を損なう」という課題認識に完全に合意します。

具体的な実装判断：
- **MVP範囲に含める** - Devの見積もり「1-2時間の実装」なら、残り工数10%内で十分対応可能
- **最小限スコープ**: Devの提案通り、タイトル・作成日時・モード・ステータスの基本4フィールドのみ
- **検索機能は除外** - リリース後のフィードバック次第で追加
- **エラーハンドリング必須** - PDの懸念通り、「データ読み込み失敗」と「データ未存在」の区別は重要

ビジネス判断の根拠：
1. Magiの差別化価値「議論の経緯が残る」が機能しない状況は致命的
2. ユーザーが初回使用後に「前回の議論」を確認できないのは継続利用を阻害
3. 実装工数が軽微なら、品質向上の投資対効果が高い

実装順序の提案：
1. サーバー側 `/api/history` エンドポイント実装（ContextLoaderロジック流用）
2. Web UI側でエラー状態・空状態の適切な表示
3. CLI `magi history` の基本一覧表示
4. 簡単な手動テストでデータ表示確認

リスク管理：工数が予想を超えた場合は、Web UIのみ実装してCLIは次版に延期する判断も可能です。

#### 【PD】
_2026-03-16T06:58:04.424Z_

【PD】✅ 合意: PMの判断とDevの技術分析に合意します。特に「空の画面がユーザー信頼を損なう」問題は、Magiの核心価値である「議論の経緯を可視化する」という体験を根本から破綻させているため、MVP範囲での修正は必須です。

具体的なUX要件の補足：
- **状態表示の明確化**: 「議論がまだありません」「読み込み中」「エラーが発生しました」の3状態を明確に区別
- **時系列ナビゲーション**: 最新の議論から順に表示し、ユーザーが直感的に「前回やったこと」を見つけられる
- **最小限の識別情報**: タイトル・日付・モード（spec/build）があれば、ユーザーは目的の議論を特定可能

アクセシビリティ要件（最小限）：
- History一覧でのキーボードナビゲーション対応
- 各項目に適切なaria-labelを設定
- 日付フォーマットは画面リーダーで読み上げ可能な形式

実装優先度の合意：
1. サーバーサイドの基本読み込み（Devの提案通りContextLoaderロジック流用）
2. Web UIの状態管理とエラー表示
3. CLI実装は工数次第で次版延期も可

PMが指摘した「実装工数が軽微なら品質向上の投資対効果が高い」という判断は、ユーザー体験の観点から完全に正しいです。「使えるけど信頼できない」システムより「シンプルだが一貫して動く」システムの方が、長期的なユーザー満足度は高くなります。

#### 【Dev】
_2026-03-16T06:58:19.200Z_

【Dev】✅ 合意: PMの工数判断「1-2時間の実装で品質向上の投資対効果が高い」とPDの体験設計「状態表示の明確化で信頼を損なわない」という両方の判断に完全に合意します。

技術実装の具体案：

```typescript
// packages/core/src/context/loader.ts に追加
export async function loadDiscussionHistory(): Promise<DiscussionHistoryItem[]> {
  const discussionsDir = path.join(process.cwd(), '.magi', 'discussions');
  if (!fs.existsSync(discussionsDir)) return [];
  
  const folders = fs.readdirSync(discussionsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
    
  const history = await Promise.allSettled(
    folders.map(async folder => {
      const metaPath = path.join(discussionsDir, folder, 'meta.yaml');
      const meta = YAML.parse(fs.readFileSync(metaPath, 'utf8'));
      return {
        id: folder,
        title: meta.task || 'Untitled',
        createdAt: meta.created_at,
        mode: meta.mode || 'spec',
        status: meta.status || 'completed'
      };
    })
  );
  
  return history
    .filter((result): result is PromiseFulfilledResult<DiscussionHistoryItem> => 
      result.status === 'fulfilled')
    .map(result => result.value)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
```

セキュリティ対策：
- フォルダ名のパス走査チェック（`folder.includes('..')` で除外）
- YAMLパース例外のtry-catch処理
- Promise.allSettledで個別ファイル読み込み失敗を分離

テストケース（最小限）：
```typescript
// 正常ケース: meta.yamlが存在し適切な形式
// エラーケース: meta.yamlが存在しない/不正な形式
// エッジケース: .magiディレクトリ自体が存在しない
```

実装優先度の同意：
1. **Server側 `/api/history`** - 上記ロジックでContextLoaderパターン踏襲
2. **Web UI状態管理** - loading/error/empty の3状態対応
3. **CLI `magi history`** - 同じロジック使用、工数次第で次版延期可

PMの「MVP残り10%で品質向上の投資対効果が高い」とPDの「信頼を損なう空画面の修正は必須」という判断は、技術負債の観点からも正しいです。今修正しないと、ユーザー増加後により大きな工数が必要になります。

