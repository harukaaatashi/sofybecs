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

# 1回の実行でSlackに流す最大件数（初回や障害復帰時の洪水防止）
MAX_POSTS_PER_RUN = int(os.environ.get("MAX_POSTS_PER_RUN", "20"))
# 初回実行（state が空）のとき、過去分は何件だけ流すか
FIRST_RUN_POSTS_PER_SOURCE = int(os.environ.get("FIRST_RUN_POSTS_PER_SOURCE", "3"))
# 連続アクセスを避けるための最短実行間隔。0 で無効化
MIN_COLLECT_INTERVAL_HOURS = int(os.environ.get("MIN_COLLECT_INTERVAL_HOURS", "24"))

STATE_FILE = os.environ.get("STATE_FILE", "state/seen.json")
# 各ソースで記憶しておく既読IDの上限
SEEN_IDS_KEEP = 3000
