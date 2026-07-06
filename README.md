# ソフィBe 口コミウォッチャー

ユニ・チャームの生理管理アプリ「ソフィBe」の口コミを収集するツール。

- **閲覧ページ**: https://spago-official.github.io/sofybecs/ （検索・ソース/評価フィルタ付き。GitHub Pagesで自動更新）
- **一覧**: [REVIEWS.md](REVIEWS.md) に日付順で蓄積される（GitHub上でそのまま閲覧可。生データは `data/items.json`）
- **通知（任意）**: `SLACK_WEBHOOK_URL` を設定すると、新着だけSlackチャンネルにも流れる

## 収集ソースとコスト

| ソース | 取得方法 | コスト |
|---|---|---|
| App Store（[id6480158120](https://apps.apple.com/jp/app/id6480158120)） | Apple公式RSSフィード | 無料 |
| Google Play（`jp.sofy.be`） | [google-play-scraper](https://pypi.org/project/google-play-scraper/) | 無料 |
| X（`"ソフィBe"` 完全一致検索・RT除外） | X API v2 recent search（従量課金） | 月数百円目安 |
| 関連性フィルタ（X投稿のみ・任意） | Claude Haiku | ほぼゼロ（月数十円未満） |
| 定期実行 | GitHub Actions cron（1日1回・JST 6時） | 無料枠内 |
| 通知 | Slack Incoming Webhook | 無料 |

X・Claudeのキーが無くても、App Store + Google Play だけで動きます（該当ソースは自動スキップ）。

## 仕組み

```
GitHub Actions (cron)
  → collector/main.py
      ├ sources/app_store.py    … RSSフィードから最新レビュー取得
      ├ sources/google_play.py  … 最新レビュー取得
      ├ sources/x_search.py     … since_id 以降の言及のみ取得（課金節約）
      ├ filter.py               … X投稿をキーワード + Claude Haiku で関連判定
      ├ store.py                … data/items.json に蓄積し REVIEWS.md を生成
      ├ state/seen.json         … 通知済みIDを記録（Actionsがコミットして永続化）
      └ slack.py                … Webhook設定時のみ、新着を通知
```

- 初回実行は過去分の洪水を避けるため各ソース直近3件だけ通知し、残りは既読化します。
- 1回の実行あたりの通知上限は20件（`MAX_POSTS_PER_RUN` で変更可）。

## セットアップ

1. **GitHubリポジトリ作成**（プライベート可）とpush
2. **Slack Incoming Webhook 作成**
   - https://api.slack.com/apps → Create New App → Incoming Webhooks を有効化 → 通知先チャンネルを選んでWebhook URLを取得
3. **リポジトリの Settings → Secrets and variables → Actions** に登録（すべて任意）:
   - `SLACK_WEBHOOK_URL`（Slack通知したい場合）
   - `X_BEARER_TOKEN`（Xも収集する場合。X開発者コンソールでアプリ作成しBearer Token取得。従量課金のクレジットをチャージ）
   - `ANTHROPIC_API_KEY`（X投稿のノイズ除去用）
4. Actions タブから `collect-reviews` を **Run workflow** で手動実行して動作確認

## ローカルでの動作確認

```sh
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
DRY_RUN=1 .venv/bin/python -m collector.main   # Slackに投げず標準出力に表示
```

## 環境変数

| 変数 | 意味 | デフォルト |
|---|---|---|
| `SLACK_WEBHOOK_URL` | 通知先Webhook。未設定ならSlack通知をスキップ（一覧のみ更新） | なし |
| `X_BEARER_TOKEN` | X API v2 のBearer Token。未設定ならXをスキップ | なし |
| `ANTHROPIC_API_KEY` | Claudeでの関連性判定。未設定ならキーワードのみ | なし |
| `DRY_RUN` | `1` でSlack投稿せず表示のみ | なし |
| `MAX_POSTS_PER_RUN` | 1回の実行で通知する最大件数 | 20 |
| `FIRST_RUN_POSTS_PER_SOURCE` | 初回実行時に通知する件数/ソース | 3 |
