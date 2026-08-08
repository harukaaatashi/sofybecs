# CLAUDE.md — sofybecs（ソフィBe 口コミウォッチャー）

ユニ・チャーム「ソフィBe」のアプリストア口コミを収集・閲覧する内部向けツール。
詳細な仕組み・運用ポリシーは [README.md](README.md)、UI ルールは [DESIGN.md](DESIGN.md) を必ず先に読むこと。

## 構成

- `collector/` — Python 収集バッチ（`main.py` がエントリ。`sources/app_store.py` = Apple 公式 RSS、`sources/google_play.py` = google-play-scraper、`features.py` = 機能タグ分類）
- `src/` — 閲覧ページ（React 19 + Vite + smarthr-ui + styled-components）
- `scripts/build_site.mjs` — 静的サイトビルド（`npm run build` の実体、出力は `_site/`）
- `middleware.js` — Vercel Edge Middleware（合言葉ゲートで内部限定公開）
- `tests/` — 収集バッチの pytest / `src/lib.test.ts` — 閲覧ページの vitest
- `data/items.json` — 生データ / `REVIEWS.md` — 日付順の閲覧用一覧（どちらも自動生成、手編集しない）
- `state/` — 収集の実行状態（自動生成）
- `.github/workflows/` — `collect-reviews`（cron・1日1回 JST 6時に収集）と `test`（push / PR）

## コマンド

```bash
npm run dev        # Vite 開発サーバ（閲覧ページ）
npm run build      # 静的サイト生成 → _site/
npm run typecheck  # tsc --noEmit
npm test           # vitest（src/lib.ts の集計・絞り込みロジック）
# 収集（Python、.venv 使用）
.venv/bin/python collector/main.py
.venv/bin/python -m pytest   # collector の実行ガード・分類・蓄積
```

変更時は `npm test` / `.venv/bin/python -m pytest` / `npm run typecheck` / `npm run build` を検証として実行する（CI: `.github/workflows/test.yml`）。

## 守るべき運用ルール（README「安全寄りの運用メモ」の要約）

- Google Play 収集はグレー寄りのスクレイパー依存。`COLLECT_ONCE_PER_DAY`（同じJSTの日に2回目を走らせない）を弱めない（上書きは `FORCE_RUN=1` のみ）
- 公開サイトはデフォルト無効。`ENABLE_PUBLIC_SITE=1` / `INTERNAL_SITE_EXPORT=1` の意味を変えない
- X（Twitter）は収集対象に加えない
- `SLACK_WEBHOOK_URL` などのシークレットはコードに直書きしない（GitHub Secrets / Vercel 環境変数）

## UI 作業

- DESIGN.md が唯一の正。smarthr-ui のコンポーネントとソフィBe Semantic Color を使い、hex 直書き・`transition-all` は禁止（グローバル `~/.claude/CLAUDE.md` の UI ルールも適用）
- `REVIEWS.md` / `data/items.json` は収集バッチの出力なので、UI 側の都合で書き換えない
