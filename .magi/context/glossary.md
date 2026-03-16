# Magi — 用語集

| 用語 | 説明 |
|---|---|
| **Magi** | 本プロダクト。3つのAIロールが議論し成果物を生み出すシステム。エヴァンゲリオンのMAGIシステムがモチーフ |
| **3賢者** | PM・PD・Devの3つのAIロール。東方三博士になぞらえた呼称 |
| **MELCHIOR-1** | PMロールのMAGI名称。UI上での表示名 |
| **BALTHASAR-2** | PDロールのMAGI名称。UI上での表示名 |
| **CASPER-3** | DevロールのMAGI名称。UI上での表示名 |
| **OPERATOR** | UserロールのMAGI名称。UI上での表示名 |
| **magi-frame** | EVA風コーナーブラケット装飾。CSS疑似要素で左上・右下にL字ブラケットを描画 |
| **逆三角形配置** | ホーム画面のMAGIパネルレイアウト。上段中央にMELCHIOR-1、下段左右にBALTHASAR-2/CASPER-3 |
| **Specモード** | 仕様駆動モード。議論→仕様書+ADR+タスクリスト生成 |
| **Buildモード** | 実装駆動モード。議論→実装→レビュー→検証 |
| **ステージ** | パイプラインの各フェーズ。Specは5段階(elaborate→sync)、Buildも5段階(analysis→verify) |
| **ラウンド** | 1ステージ内での議論の1周。各ロールが1回ずつ発言する。最大3ラウンド（設定可能） |
| **合意(Consensus)** | ラウンド終了時の合意状況。agreed/partial/disagreed の3段階 |
| **ADR** | Architecture Decision Record。設計判断の記録。採用理由と却下した代替案を記載 |
| **ゲート** | ステージ間の承認ポイント。人間が成果物を確認してから次へ進む |
| **介入(Injection)** | ユーザーが議論の途中にメッセージを挿入する機能。次ラウンドで3賢者に見える |
| **コンテキスト** | .magi/context/ に配置するプロジェクト情報。議論開始時に自動読込 |
| **RoleEngine** | ロール定義を読み込み、LLMを使ってラウンド内の発言を生成するエンジン |
| **DiscussionProtocol** | 複数ラウンドの議論を管理するプロトコル。合意に達するか最大ラウンドまで実行 |
| **Pipeline** | ステージを順に実行し、各ステージで議論→成果物生成→Git commitを行う |
| **SSE** | Server-Sent Events。サーバーからWeb UIへリアルタイムにイベントを配信する仕組み |
| **MagiEvent** | パイプライン実行中に発行されるイベント。stage_start, statement, round_end, artifact等 |
| **activePipeline** | Magiクラスが現在実行中のパイプラインを追跡するフィールド。介入に使用 |
| **pendingMessages** | DiscussionProtocol内のユーザーメッセージキュー。ラウンド完了後にドレインされる |
| **AIDLC** | AI Development Life Cycle。MagiのSpecモード=Inception、Buildモード=Construction に対応 |
| **sanitize** | LLM出力から先頭/末尾のコードフェンス（` ```yaml ` 等）を除去する処理。SpecWriter.sanitize()で実装 |
| **minRounds** | 合意に達しても最低限実行するラウンド数（デフォルト2）。ラウンド1での安易な早期収束を防止 |
| **リコンシリエーション** | plan完了後にrequirements.md・spec.md・flow.mermaidを全議論とADR情報を反映して再生成する処理。ADRで延期・却下された技術を除外 |
| **コードベースコンテキスト** | ContextLoader.buildCodebaseContext()が既存コードからAPIエンドポイント・設定形式・依存関係を自動抽出し議論に提供する情報 |
| **adrContents** | ADR文書の配列。リコンシリエーション時にwriteRequirements/writeSpec/writeMermaidに渡され、延期・却下された技術を成果物に含めないよう制御 |
