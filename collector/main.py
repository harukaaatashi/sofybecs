"""ソフィBe 口コミ収集 → Slack通知 のエントリポイント。

使い方:
    python -m collector.main            # 通常実行
    DRY_RUN=1 python -m collector.main  # Slackに投げず標準出力に表示
"""

import sys
import traceback

from . import config, filter as flt, slack, state as state_mod, store
from .models import Item
from .sources import app_store, google_play, x_search


def _dedupe_new(items: list[Item], seen_ids: list[str]) -> list[Item]:
    seen = set(seen_ids)
    return [i for i in items if i.id not in seen]


def run() -> int:
    state = state_mod.load()
    collected: list[Item] = []
    to_post: list[Item] = []
    errors: list[str] = []

    # --- App Store / Google Play（レビューは全件が対象、フィルタ不要） ---
    for name, fetch in (("app_store", app_store.fetch), ("google_play", google_play.fetch)):
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

    # --- X ---
    if config.X_BEARER_TOKEN:
        try:
            x_state = state["x"]
            items, newest_id = x_search.fetch(since_id=x_state.get("since_id"))
            new_items = _dedupe_new(items, x_state["seen_ids"])
            new_items = flt.filter_x_items(new_items)
            collected.extend(new_items)
            new_items.reverse()
            x_state["seen_ids"].extend(i.id for i in items)
            if newest_id:
                x_state["since_id"] = newest_id
            to_post.extend(new_items)
            print(f"[x] 取得 {len(items)} 件 / フィルタ後の新着 {len(new_items)} 件")
        except Exception:
            errors.append(f"x: 取得失敗\n{traceback.format_exc()}")
    else:
        print("[x] X_BEARER_TOKEN 未設定のためスキップ")

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

    state_mod.save(state)

    if errors:
        print("\n".join(errors), file=sys.stderr)
        # 一部ソースの失敗は state 保存後に非ゼロ終了で気付けるようにする
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(run())
