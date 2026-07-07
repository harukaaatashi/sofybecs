# ソフィBe 口コミウォッチャー

ユニ・チャームの生理管理アプリ「ソフィBe」の口コミを収集するツール。

- **閲覧ページ**: 静的サイトを内部向けに配信可能（検索・ソース/評価/バージョンフィルタ付き）
- **一覧**: [REVIEWS.md](REVIEWS.md) に日付順で蓄積される（GitHub上でそのまま閲覧可。生データは `data/items.json`）
- **通知（任意）**: `SLACK_WEBHOOK_URL` を設定すると、新着だけSlackチャンネルにも流れる

## 収集ソースとコスト

| ソース | 取得方法 | コスト |
|---|---|---|
| App Store（[id6480158120](https://apps.apple.com/jp/app/id6480158120)） | Apple公式RSSフィード | 無料 |
| Google Play（`jp.sofy.be`） | [google-play-scraper](https://pypi.org/project/google-play-scraper/) | 無料 |
| 定期実行 | GitHub Actions cron（1日1回・JST 6時） | 無料枠内 |
| 通知 | Slack Incoming Webhook | 無料 |

App Store + Google Play だけで動きます。

## 安全寄りの運用メモ

- App Store は Apple の公式RSSを利用
- Google Play は現状 `google-play-scraper` を利用するため、App Store より規約・安定性の面でグレー寄り
- X は収集対象から外している
- そのため、短時間の再実行を避けるガードとして `MIN_COLLECT_INTERVAL_HOURS` のデフォルトを `24` にしている
- `GOOGLE_PLAY_ENABLED=0` を指定すると、Google Play 収集を簡単に止められる
- `FORCE_RUN=1` を指定したときだけ、実行間隔ガードを上書きできる
- 公開サイトはデフォルトで無効。GitHub Pages は `ENABLE_PUBLIC_SITE=1` を明示したときだけ配信する
- Vercel で社内限定にする場合は、Vercel 側の Deployment Protection を有効にしたうえで `INTERNAL_SITE_EXPORT=1` を設定する

Google Play には、アプリ所有者向けの公式な Google Play Developer API の `reviews.list` / `reviews.get` / `reviews.reply` があります。現状のこのリポジトリは未対応で、Play Console 権限や認証設定なしで動かすためにスクレイパーを使っています。

## 仕組み

```
GitHub Actions (cron)
  → collector/main.py
      ├ sources/app_store.py    … RSSフィードから最新レビュー取得
      ├ sources/google_play.py  … 最新レビュー取得
      ├ features.py             … 機能タグ分類（HOME/記録/チャット/カレンダー/レポート/コンテンツ/設定/その他）
      │                            ANTHROPIC_API_KEY があればClaude Haikuが文脈で判定、無ければキーワード
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
   - `ANTHROPIC_API_KEY`（機能タグ分類を Claude で補助したい場合）
4. Actions タブから `collect-reviews` を **Run workflow** で手動実行して動作確認

### 内部向けサイト配信

- GitHub Pages を使う場合は、リポジトリ変数 `ENABLE_PUBLIC_SITE=1` を明示したときだけ配信します
- `INTERNAL_SITE_EXPORT` 未設定のデプロイは、データを含まない案内ページだけを出します

#### Vercel（Hobbyプランでの内部限定化）

Vercel Hobby では Password Protection / Deployment Protection の本番保護が使えないため、`middleware.js`（Edge Middleware）で全アクセスに Basic 認証（合言葉）をかけて内部限定化しています。noindex だけでは URL を知る人が閲覧できてしまうため、この合言葉ゲートが実質的なアクセス制御です。

環境変数（Vercel の Settings → Environment Variables）:

| 変数 | 意味 | 必須 |
|---|---|---|
| `SITE_PASSWORD` | 閲覧用の合言葉。**未設定のときは安全側に倒して全アクセスを拒否**する | 必須 |
| `SITE_USER` | ログインユーザー名。既定は `sofybe` | 任意 |
| `INTERNAL_SITE_EXPORT` | `1` のときだけ実データを書き出す | データ表示時のみ |

チームへの共有は、URL と `SITE_USER` / `SITE_PASSWORD` を渡すだけ。ブラウザのログインダイアログで入力すれば閲覧できます。

## ローカルでの動作確認

```sh
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
DRY_RUN=1 .venv/bin/python -m collector.main   # Slackに投げず標準出力に表示
```

## 環境変数

| 変数 | 意味 | デフォルト |
|---|---|---|
| `SLACK_WEBHOOK_URL` | 通知先Webhook。未設定ならSlack通知をスキップ（一覧のみ更新） | なし |
| `ANTHROPIC_API_KEY` | Claudeでの機能タグ分類。未設定ならキーワード分類のみ | なし |
| `APP_STORE_ENABLED` | `0` で App Store 収集を止める | `1` |
| `GOOGLE_PLAY_ENABLED` | `0` で Google Play 収集を止める | `1` |
| `DRY_RUN` | `1` でSlack投稿せず表示のみ | なし |
| `FORCE_RUN` | `1` で最短実行間隔ガードを無視して実行 | なし |
| `MAX_POSTS_PER_RUN` | 1回の実行で通知する最大件数 | 20 |
| `FIRST_RUN_POSTS_PER_SOURCE` | 初回実行時に通知する件数/ソース | 3 |
| `MIN_COLLECT_INTERVAL_HOURS` | 連続実行を避ける最短間隔。`0` で無効化 | 24 |
| `GOOGLE_PLAY_FETCH_COUNT` | Google Play で取りにいく最大件数 | 50 |
| `INTERNAL_SITE_EXPORT` | `1` のときだけ静的サイトに実データを書き出す | なし |
