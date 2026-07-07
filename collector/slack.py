"""Slack Incoming Webhook への投稿。"""

from . import config
from .http_util import post_json
from .models import Item

SOURCE_LABEL = {
    "app_store": ":apple: App Store レビュー",
    "google_play": ":robot_face: Google Play レビュー",
}


def _stars(rating: int | None) -> str:
    if not rating:
        return ""
    return "★" * rating + "☆" * (5 - rating) + f" ({rating})"


def format_item(item: Item) -> str:
    header = SOURCE_LABEL.get(item.source, item.source)
    lines = [f"*{header}*"]
    meta = []
    if item.rating:
        meta.append(_stars(item.rating))
    if item.extra.get("version"):
        meta.append(f"v{item.extra['version']}")
    if item.author:
        meta.append(item.author)
    if item.created_at:
        meta.append(item.created_at[:10])
    if meta:
        lines.append(" ・ ".join(meta))
    if item.title:
        lines.append(f"*{item.title}*")
    body = item.body.strip()
    if len(body) > 700:
        body = body[:700] + "…"
    if body:
        lines.append(f">{body}".replace("\n", "\n>"))
    lines.append(f"<{item.url}|開く>")
    return "\n".join(lines)


def post(items: list[Item]) -> None:
    for item in items:
        text = format_item(item)
        if config.DRY_RUN or not config.SLACK_WEBHOOK_URL:
            print("---- [dry-run] Slack投稿 ----")
            print(text)
            continue
        post_json(config.SLACK_WEBHOOK_URL, {
            "text": text,
            "unfurl_links": False,
        })
