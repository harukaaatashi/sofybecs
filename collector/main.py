"""ソフィBe 口コミ収集 → Slack通知 のエントリポイント。

使い方:
    python -m collector.main            # 通常実行
    DRY_RUN=1 python -m collector.main  # Slackに投げず標準出力に表示
"""

import sys
import traceback
from datetime import datetime, timedelta, timezone

from . import config, slack, state as state_mod, store
from .models import Item
from .sources import app_store, google_play


def _dedupe_new(items: list[Item], seen_ids: list[str]) -> list[Item]:
    seen = set(seen_ids)
    return [i for i in items if i.id not in seen]


def _parse_iso8601(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _should_skip_run(state: dict) -> tuple[bool, str]:
    if config.FORCE_RUN or config.MIN_COLLECT_INTERVAL_HOURS <= 0:
        return False, ""
    last_run_at = _parse_iso8601(state.get("_meta", {}).get("last_run_at", ""))
    if not last_run_at:
        return False, ""
    next_run_at = last_run_at + timedelta(hours=config.MIN_COLLECT_INTERVAL_HOURS)
    now = datetime.now(timezone.utc)
    if now < next_run_at:
        return True, next_run_at.isoformat()
    return False, ""


def run() -> int:
    state = state_mod.load()
    skip, next_run_at = _should_skip_run(state)
    if skip:
        print(
            "[guard] 直近で収集済みのためスキップ"
            f"（次回目安: {next_run_at} / FORCE_RUN=1 で上書き）"
        )
        return 0
    collected: list[Item] = []
    to_post: list[Item] = []
    errors: list[str] = []

    # --- App Store / Google Play（レビューは全件が対象、フィルタ不要） ---
    review_sources = []
    if config.APP_STORE_ENABLED:
        review_sources.append(("app_store", app_store.fetch))
    else:
        print("[app_store] APP_STORE_ENABLED=0 のためスキップ")
    if config.GOOGLE_PLAY_ENABLED:
        review_sources.append(("google_play", google_play.fetch))
    else:
        print("[google_play] GOOGLE_PLAY_ENABLED=0 のためスキップ")
    for name, fetch in review_sources:
        try:
            items = fetch()
        except Exception:
            errors.append(f"{name}: 取得失敗\n{traceback.format_exc()}")
            continue
        src_state = state[name]
        first_run = not src_state["seen_ids"]
        new_items = _dedupe_new(items, src_state["seen_ids"])
        # 古い順に通知されるよう並べ替え（RSS/取得結果は新しい順）
        new_items.reverse()
        if first_run:
            new_items = new_items[-config.FIRST_RUN_POSTS_PER_SOURCE :]
        src_state["seen_ids"].extend(i.id for i in items)
        collected.extend(items)
        to_post.extend(new_items)
        print(f"[{name}] 取得 {len(items)} 件 / 新着 {len(new_items)} 件"
              + ("（初回のため直近のみ通知）" if first_run else ""))

    # --- 蓄積と一覧生成 ---
    data = store.merge(collected)
    store.write_markdown(data)
    print(f"[store] 累計 {len(data)} 件を {store.DATA_FILE} / {store.REVIEWS_MD} に反映")

    # --- Slack通知（Webhook設定時のみ） ---
    if config.SLACK_WEBHOOK_URL or config.DRY_RUN:
        if len(to_post) > config.MAX_POSTS_PER_RUN:
            print(f"[slack] {len(to_post)} 件中 {config.MAX_POSTS_PER_RUN} 件のみ通知（上限）")
            to_post = to_post[-config.MAX_POSTS_PER_RUN :]
        slack.post(to_post)
        print(f"[slack] {len(to_post)} 件通知")
    else:
        print(f"[slack] SLACK_WEBHOOK_URL 未設定のためスキップ（新着 {len(to_post)} 件は一覧に反映済み）")

    state["_meta"]["last_run_at"] = datetime.now(timezone.utc).isoformat()
    state_mod.save(state)

    if errors:
        print("\n".join(errors), file=sys.stderr)
        # 一部ソースの失敗は state 保存後に非ゼロ終了で気付けるようにする
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(run())
