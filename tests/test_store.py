"""蓄積（data/items.json）の回帰テスト。

重複追加と並び順が崩れると、閲覧ページの件数と日付グループが静かに狂う。
"""

import json

import pytest

from collector import config, store
from collector.models import Item


@pytest.fixture(autouse=True)
def isolated_files(tmp_path, monkeypatch):
    """本物の data/ と REVIEWS.md を触らずにテストする。"""
    monkeypatch.setattr(store, "DATA_FILE", str(tmp_path / "items.json"))
    monkeypatch.setattr(store, "REVIEWS_MD", str(tmp_path / "REVIEWS.md"))
    monkeypatch.setattr(config, "ANTHROPIC_API_KEY", "")  # 分類はキーワード経路に固定
    monkeypatch.setattr(config, "RECLASSIFY", False)


def review(id: str, created_at: str, source: str = "app_store", body: str = "重い") -> Item:
    return Item(
        source=source,
        id=id,
        body=body,
        url=f"https://example.test/{id}",
        created_at=created_at,
        rating=1,
        extra={"version": "4.16.0"},
    )


def test_同じidは二重に増えない():
    store.merge([review("1", "2026-08-01T10:00:00Z")])
    data = store.merge([review("1", "2026-08-01T10:00:00Z")])
    assert len(data) == 1


def test_ソースが違えば同じidでも別物として扱う():
    data = store.merge(
        [review("1", "2026-08-01T10:00:00Z"), review("1", "2026-08-01T10:00:00Z", "google_play")]
    )
    assert len(data) == 2


def test_日付の新しい順に並ぶ():
    data = store.merge(
        [
            review("old", "2026-07-01T10:00:00Z"),
            review("new", "2026-08-01T10:00:00Z"),
            review("mid", "2026-07-15T10:00:00Z"),
        ]
    )
    assert [d["id"] for d in data] == ["new", "mid", "old"]


def test_タイムゾーン表記が混在しても並びが崩れない():
    """+09:00 と Z が混ざるデータで、文字列比較だと逆転する組み合わせ。"""
    data = store.merge(
        [
            review("jst", "2026-08-01T08:00:00+09:00"),  # = 2026-07-31T23:00Z
            review("utc", "2026-08-01T00:00:00Z"),
        ]
    )
    assert [d["id"] for d in data] == ["utc", "jst"]


def test_未知のソースは取り込まない():
    assert store.merge([review("1", "2026-08-01T10:00:00Z", source="x")]) == []


def test_タグが付いていないものだけ分類する():
    store.merge([review("1", "2026-08-01T10:00:00Z")])
    data = store.merge([review("2", "2026-08-02T10:00:00Z", body="ログインできない")])
    tags = {d["id"]: d for d in data}
    assert "動作・安定性" in tags["1"]["topics"]
    assert "ログイン" in tags["2"]["topics"]


def test_付与済みのタグは上書きしない():
    store.merge([review("1", "2026-08-01T10:00:00Z")])
    with open(store.DATA_FILE, encoding="utf-8") as f:
        saved = json.load(f)
    saved[0]["features"] = ["レポート"]
    saved[0]["topics"] = ["通知"]
    with open(store.DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(saved, f, ensure_ascii=False)

    data = store.merge([])
    assert data[0]["features"] == ["レポート"]
    assert data[0]["topics"] == ["通知"]


def test_一覧Markdownに件数と日付見出しが出る():
    data = store.merge([review("1", "2026-08-01T10:00:00Z")])
    md = store.render_markdown(data)
    assert "全 1 件" in md
    assert "## 2026-08-01" in md
