# DESIGN.md — ソフィBe 口コミビューワー

対象: `src/`（React + smarthr-ui。Vite でビルドし `_site/` に出力、内部限定配信）

## 1. Visual Theme

- プロファイル: dashboard（閲覧専用・情報密度中）
- ムード: ミニマル・クリーン。装飾より読みやすさ優先
- 技術基盤: **React + TypeScript + smarthr-ui**。UIは原則 smarthr-ui コンポーネント（`Base`/`Heading`/`Text`/`TextLink`/`Chip`/`Checkbox`/`RadioButton`/`Fieldset`/`Stack`/`Cluster`/`Button`/`SearchInput` 等）で組む。自作CSSはレイアウト・sticky・フローティング・レスポンシブに限定（§3参照）
- 配色: **ソフィBeプロダクトのSemantic Color**（Figmaカラーガイド準拠）。SmartHRの見た目にはせず、smarthr-uiは `createTheme` でソフィBeトークンにマップする（`src/theme.ts`）
- コンテンツ言語: 日本語中心
- 対象端末: モバイル / デスクトップ両対応
- レイアウト: ヘッダー（タイトル）は画面上部にsticky固定（高さ64px、モバイル56px）。本文はヘッダー下で2カラム（左サイドバー=検索・フィルタ／右メイン=結果一覧、max-width 1080px）。980px以下は1カラムに縦積み
- 左サイドバーは**浮いた白のフローティングパネル**（surface地・角丸16px・ソフトシャドウ）。本文カードの「影なし」原則とは別コンポーネントとして扱う。980px以下の1カラム時はパネル装飾（背景・影・角丸）を外して素の縦積みに戻す
- **sticky要素の余白原則**: sticky要素（サイドバー・サマリー行）の上余白は要素自身のpadding/marginで持ち、sticky `top` と一致させる。通常時とsticky時でヘッダーとの間隔が変わらないことを保証する
- ダークモード: なし

## 2. Design Tokens

ソフィBe Semantic Color 準拠。色はトークン経由のみ、hex直書き禁止。
定義は `src/tokens.css`（CSS変数）と `src/theme.ts`（smarthr-uiテーマ）の**2箇所**にあり、変更時は両方を更新すること。

| CSS変数 | Semantic | Primitive | 値 |
|---|---|---|---|
| `--color-text-primary` | Text.Base.Primary | Neutral.Gray.950 | `#242828` |
| `--color-text-secondary` | Text.Base.Secondary | Neutral.Gray.500 | `#606b69` |
| `--color-text-placeholder` | Text.Base.Placeholder | Neutral.Gray.400 | `#828e8c` |
| `--color-text-inactive` | Text.Base.Inactive | Neutral.Gray.300 | `#acb4b2` |
| `--color-text-link` | （独自） | SofyBeBlue.800 | `#486873` |
| `--color-accent-primary` | Accent.Primary | SofyBeBlue.950 | `#0c2a30` |
| `--color-accent-secondary` | Accent.Secondary | SofyBeBlue.300 | `#c5d9e5` |
| `--color-bg` | Background.Main | SofyBeBlue.50 | `#f7f9fa` |
| `--color-surface` | Surface.Base.Primary | Neutral.White | `#ffffff` |
| `--color-surface-secondary` | Surface.Base.Secondary | Neutral.Gray.50 | `#f5f6f6` |
| `--color-surface-emphasis` | Surface.Emphasis | SofyBeBlue.100 | `#e6eef3` |
| `--color-border` | Border.Main | Neutral.Gray.100 | `#e5e8e7` |
| `--color-alert` | Alert.CautionHigh | Red.600 | `#dc3826` |
| `--color-star` | （独自・星評価） | Orange.400 | `#ffb22e` |
| `--shadow-base` | Shadow.Base | #000000 / 12% | `0 2px 8px rgba(0,0,0,.12)` |
| `--shadow-panel` | Shadow.Base 拡張 | #000000 / 12% | `0 8px 24px rgba(0,0,0,.12)` |

- 独自マッピングの根拠: リンク色はSemantic未定義のため、本文と区別しつつ同系のSofyBeBlue.800（白地コントラスト約6:1）+ 常時下線。星評価もSemantic未定義のためOrange.400（装飾扱い、`role="img"` + `aria-label` で読み上げ）
- 補助テキスト（Text.Secondary `#606b69`）は白地で約5.9:1 — WCAG AA（4.5:1）合格
- スペーシング: 4/8pxスケールのみ（4, 8, 12, 16, 24, 32…）
- 角丸: 8px（カード）、16px（フローティングパネル）、999px（チップ）
- 影: フローティングパネル（サイドバー）のみ。本文カードは影なしを維持
- フォント: system-ui スタック。数値は `tabular-nums`。本文 `line-height: 1.7`
- transition はプロパティ明示。`transition-all` 禁止

## 3. コンポーネント

UIは原則 **smarthr-ui コンポーネント**で組む。自作CSSはレイアウト・sticky・フローティング・レスポンシブなど smarthr-ui で表現できない部分に限る。用途とコンポーネントの対応:

| 用途 | コンポーネント |
|---|---|
| ページタイトル | `PageHeading`（`autoPageTitle={false}` で document.title を汚さない） |
| 日付グループ見出し | `Section` + `Heading type="blockTitle"`（SectioningContentで階層を明示、不推奨tag回避） |
| 本文・メタ・件数 | `Text`（`styleType`/`size`/`color="TEXT_GREY"`/`leading`。数値は tabular-nums） |
| レビューカード | `Base as="article" layer={0} radius="m"`（影なし=カード原則）。`content-visibility:auto` で200件表示を軽量化 |
| ソース・機能タグ | `Chip`（表示専用。ソース=`color="blue"` / 機能=`color="grey"`） |
| リンク（開く） | `TextLink target="_blank"`（外部アイコンと「別タブで開く」読み上げは smarthr-ui が自動付与。自前の注記は付けない） |
| フィルタ: ソース（単一選択） | `Fieldset` + `RadioButton`群（「すべて」を含む） |
| フィルタ: 評価/機能/バージョン（複数選択） | `Fieldset` + `Checkbox`群 |
| レイアウト | `Stack`（縦積みgap）/ `Cluster`（横並び折り返しgap） |
| ボタン・クリア・「さらに表示」・「すべて表示」 | `Button`（`variant="secondary" wide"` / `variant="text" size="S"` / `variant="skeleton"`） |
| 検索 | `SearchInput`（`spellCheck={false}`） |

- **選択状態**: Checkbox/RadioButton の標準UIで「選択中」を明示（旧トグルチップの色依存を廃止）。選択中の値は tabular-nums で件数を併記
- **フィルタサイドバーの原則**: sticky（デスクトップ）。**浮いた白のフローティングパネル**（`--color-surface` / 角丸16px / `--shadow-panel` / 内側padding 24px）。ヘッダー下に16pxの余白を空けて浮かせ、sticky `top` と `margin-top` を一致させる。内容は常にビューポート内に収まるよう設計し、保険として `max-height` と `overflow-y: auto` を持つ。選択肢が多い群（バージョン）は最新8件+「すべて表示」トグルで折りたたむ（選択中の値は折りたたみ中でも常に表示、`aria-expanded`）
- **適用中フィルターの可視化**: 結果一覧上部の sticky サマリー行に、適用中フィルターを削除可能ボタン（`Button variant="skeleton"` + `aria-label`、×は`aria-hidden`）で常時表示し、末尾に「すべてクリア」を置く。件数表示は `aria-live="polite"` で支援技術にも通知する
- **URL共有**: 絞り込み状態（検索語・ソース・評価・機能・バージョン）はURLクエリに反映する（`history.replaceState`、履歴は汚さない）。URLを開くと同じ絞り込み状態が復元される
- **クリアへのクイックアクセス**: デスクトップは検索ボックス直下、モバイル（≤980px）はフィルタパネル内末尾に「絞り込みをクリア」を設置（適用中のみ表示）。結果側サマリーのクリアと二重に導線を持つ
- **モバイル（≤980px）**: フィルター群は「絞り込み（N件適用中）」ボタンで開閉するディスクロージャー（`aria-expanded`、デフォルト閉、`touch-action: manipulation`）。検索ボックスは常時表示。Checkbox/RadioButton の行タップ領域は min-height 44px を確保

## 7. Do's / Don'ts

- Do: 日付降順固定。禁則処理（`overflow-wrap: anywhere`）。空状態メッセージを出す。データはビューワー側でも source+id で防御的にdedupeする
- Don't: 絵文字をUIに使わない。外部CDN読み込み禁止（アセットはすべてバンドル）。`tokens.css` と `theme.ts` の値の乖離
