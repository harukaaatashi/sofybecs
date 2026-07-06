"""収集した口コミの蓄積（data/items.json）と一覧（REVIEWS.md）の生成。"""

import json
import os
from datetime import datetime, timezone

from .models import Item

DATA_FILE = os.environ.get("DATA_FILE", "data/items.json")
REVIEWS_MD = os.environ.get("REVIEWS_MD", "REVIEWS.md")
MD_MAX_ITEMS = int(os.environ.get("MD_MAX_ITEMS", "300"))

SOURCE_LABEL = {
    "app_store": "App Store",
    "google_play": "Google Play",
    "x": "X",
}


def _sort_key(d: dict) -> str:
    """ISO8601をUTCに正規化して降順ソートに使う。解釈不能なら末尾へ。"""
    try:
        return datetime.fromisoformat(d["created_at"]).astimezone(timezone.utc).isoformat()
    except (ValueError, KeyError):
        return ""


def load() -> list[dict]:
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, encoding="utf-8") as f:
        return json.load(f)


def merge(items: list[Item]) -> list[dict]:
    """既存データに追記して保存。全件（新しい順）を返す。"""
    data = load()
    known = {(d["source"], d["id"]) for d in data}
    for i in items:
        if (i.source, i.id) in known:
            continue
        data.append(
            {
                "source": i.source,
                "id": i.id,
                "title": i.title,
                "body": i.body,
                "rating": i.rating,
                "author": i.author,
                "created_at": i.created_at,
                "url": i.url,
                "version": i.extra.get("version", ""),
            }
        )
    data.sort(key=_sort_key, reverse=True)
    os.makedirs(os.path.dirname(DATA_FILE) or ".", exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    return data


def _stars(rating) -> str:
    if not rating:
        return ""
    return "★" * int(rating) + "☆" * (5 - int(rating))


def render_markdown(data: list[dict]) -> str:
    counts = {}
    for d in data:
        counts[d["source"]] = counts.get(d["source"], 0) + 1
    count_line = " / ".join(
        f"{SOURCE_LABEL.get(k, k)} {v}件" for k, v in sorted(counts.items())
    )
    latest = data[0]["created_at"][:10] if data else "-"

    lines = [
        "# ソフィBe 口コミ一覧",
        "",
        f"全 {len(data)} 件（{count_line}）・最新の口コミ日: {latest}",
        "",
        f"※ 表示は直近 {MD_MAX_ITEMS} 件まで。全件は [`data/items.json`](data/items.json) にあります。",
        "",
    ]
    current_date = None
    for d in data[:MD_MAX_ITEMS]:
        date = d["created_at"][:10] or "日付不明"
        if date != current_date:
            current_date = date
            lines += [f"## {date}", ""]
        meta = [f"**{SOURCE_LABEL.get(d['source'], d['source'])}**"]
        if d.get("rating"):
            meta.append(_stars(d["rating"]))
        if d.get("version"):
            meta.append(f"v{d['version']}")
        if d.get("author"):
            meta.append(d["author"])
        title = f" — {d['title']}" if d.get("title") else ""
        lines.append("- " + " ".join(meta) + title + f" [↗]({d['url']})")
        body = (d.get("body") or "").strip()
        if body:
            quoted = "\n".join(f"  > {ln}" for ln in body.splitlines())
            lines += [quoted, ""]
        else:
            lines.append("")
    return "\n".join(lines) + "\n"


def write_markdown(data: list[dict]) -> None:
    with open(REVIEWS_MD, "w", encoding="utf-8") as f:
        f.write(render_markdown(data))
