"""既読管理。state/seen.json をGitHub Actionsがコミットして永続化する。"""

import json
import os

from . import config

EMPTY = {
    "_meta": {"last_run_at": ""},
    "app_store": {"seen_ids": []},
    "google_play": {"seen_ids": []},
}


def load() -> dict:
    if not os.path.exists(config.STATE_FILE):
        return json.loads(json.dumps(EMPTY))
    with open(config.STATE_FILE, encoding="utf-8") as f:
        data = json.load(f)
    for key, default in EMPTY.items():
        data.setdefault(key, json.loads(json.dumps(default)))
    return data


def save(state: dict) -> None:
    for src in state.values():
        if "seen_ids" in src:
            src["seen_ids"] = src["seen_ids"][-config.SEEN_IDS_KEEP :]
    os.makedirs(os.path.dirname(config.STATE_FILE) or ".", exist_ok=True)
    with open(config.STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=1)
        f.write("\n")
