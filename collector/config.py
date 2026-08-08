"""ソフィBe 口コミ収集の設定。"""

import os

# --- 監視対象 ---
APP_STORE_APP_ID = "6480158120"  # ソフィBe (iOS, 日本ストア)
APP_STORE_COUNTRY = "jp"
APP_STORE_ENABLED = os.environ.get("APP_STORE_ENABLED", "1") != "0"
# 1ページ50件・RSSの上限は10ページ。定期実行は2で十分（バックフィル時は10を指定）
APP_STORE_RSS_PAGES = int(os.environ.get("APP_STORE_RSS_PAGES", "2"))

GOOGLE_PLAY_APP_ID = "jp.sofy.be"
GOOGLE_PLAY_ENABLED = os.environ.get("GOOGLE_PLAY_ENABLED", "1") != "0"
# 非公式スクレイパーのため、デフォルト件数は控えめにしておく
GOOGLE_PLAY_FETCH_COUNT = int(os.environ.get("GOOGLE_PLAY_FETCH_COUNT", "50"))

# --- 実行時設定（環境変数） ---
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
DRY_RUN = os.environ.get("DRY_RUN", "") == "1"
FORCE_RUN = os.environ.get("FORCE_RUN", "") == "1"
# 分類の定義を変えたときに、既存の全口コミを付け直す（1回きりのバックフィル用）
RECLASSIFY = os.environ.get("RECLASSIFY", "") == "1"

# 1回の実行でSlackに流す最大件数（初回や障害復帰時の洪水防止）
MAX_POSTS_PER_RUN = int(os.environ.get("MAX_POSTS_PER_RUN", "20"))
# 初回実行（state が空）のとき、過去分は何件だけ流すか
FIRST_RUN_POSTS_PER_SOURCE = int(os.environ.get("FIRST_RUN_POSTS_PER_SOURCE", "3"))
# 連続アクセスを避けるガード。同じJSTの日に2回目は走らせない。0 で無効化。
# 「前回から24時間」ではなく日付で見るのは、cron の遅れが翌日の判定に持ち越されて
# 1日分の収集が丸ごと飛ぶのを防ぐため（実測: 21:45Z → 00:59Z と遅れると次回が20.5時間後になる）
COLLECT_ONCE_PER_DAY = os.environ.get("COLLECT_ONCE_PER_DAY", "1") != "0"
# 「1日」の境界。JST（UTC+9）で数える
COLLECT_DAY_OFFSET_HOURS = 9

STATE_FILE = os.environ.get("STATE_FILE", "state/seen.json")
# 各ソースで記憶しておく既読IDの上限
SEEN_IDS_KEEP = 3000
