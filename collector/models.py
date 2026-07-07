"""収集アイテムの共通形式。"""

from dataclasses import dataclass, field


@dataclass
class Item:
    source: str  # "app_store" | "google_play"
    id: str
    body: str
    url: str
    created_at: str  # ISO8601 か表示用文字列
    author: str = ""
    title: str = ""
    rating: int | None = None  # レビューのみ
    extra: dict = field(default_factory=dict)
