# DESIGN.md — ソフィBe 口コミビューワー

対象: `web/index.html`（GitHub Pagesで配信する閲覧専用ページ）

## 1. Visual Theme

- プロファイル: dashboard（閲覧専用・情報密度中）
- ムード: ミニマル・クリーン。装飾より読みやすさ優先
- コンテンツ言語: 日本語中心
- 対象端末: モバイル / デスクトップ両対応
- レイアウト: ヘッダー（タイトル）は画面上部にsticky固定（高さ64px、モバイル56px）。本文はヘッダー下で2カラム（左サイドバー=検索・フィルタ／右メイン=結果一覧、サイドバーはヘッダー分オフセットしたsticky、max-width 1080px）。768px以下は1カラムに縦積み
- ダークモード: なし
- ※ ユーザー指示は「みんなで見れるのが大事」（= おまかせ）。デフォルト構成で生成

## 2. Design Tokens

色は下記トークン経由のみ。hex直書き禁止。

| トークン | 値 | 用途 |
|---|---|---|
| `--color-bg` | `#faf9f7` | ページ背景 |
| `--color-surface` | `#ffffff` | カード背景 |
| `--color-border` | `#e8e4e0` | 罫線 |
| `--color-text` | `#33302e` | 本文 |
| `--color-text-sub` | `#8a8480` | 補助テキスト |
| `--color-accent` | `#c94f7c` | アクセント（ソフィのピンク系） |
| `--color-accent-soft` | `#fbeef3` | アクセント淡色（選択状態の背景） |
| `--color-star` | `#e8a13d` | 星評価 |

- スペーシング: 4/8pxスケールのみ（4, 8, 12, 16, 24, 32…）
- 角丸: 8px（カード）、999px（チップ）
- フォント: system-ui スタック。数値は `tabular-nums`。本文 `line-height: 1.7`
- transition はプロパティ明示（`transition: background-color .15s, border-color .15s` 等）。`transition-all` 禁止

## 3. コンポーネント

- **フィルタチップ**: default=白地+罫線 / selected=accent-soft地+accent文字+accent罫線 / hover=border濃く / focus-visible=accentのoutline 2px。サイドバー内は縦積み・幅100%、モバイル1カラム時は横並びに戻す
- **レビューカード**: surface地、罫線、影なし。ソースバッジ + 星 + メタ行 + 機能タグ + 本文
- **機能タグ**: 白地 + border罫線 + text-sub文字の控えめなピル。フィルタチップ（accent系）とは視覚的に区別する
- **検索ボックス**: 罫線input、focus-visibleでaccent罫線

## 7. Do's / Don'ts

- Do: 日付降順固定。禁則処理（`overflow-wrap: anywhere`）。空状態メッセージを出す
- Don't: 絵文字をUIに使わない。外部CDN読み込み禁止（自己完結HTML）
