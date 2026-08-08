"""キーワード分類（APIキーなしの経路）の回帰テスト。

LLM 分類は毎回同じ答えを返す保証がないので、テストで固定するのは
キーワード側だけにする。ここが壊れると API キーが無い環境で
タグが静かに変わり、傾向パネルの数字の意味だけが変わってしまう。
"""

from collector import config
from collector.features import APP_WIDE, OTHER, classify_keywords, classify_texts


def test_画面と症状の両軸が付く():
    tags = classify_keywords("アップデートしたら記録が消えた")
    assert "記録" in tags["features"]
    assert "同期・データ消失" in tags["topics"]


def test_予測の話はカレンダーと予測精度に落ちる():
    tags = classify_keywords("生理予定日の予測が全然当たらない")
    assert "カレンダー" in tags["features"]
    assert "予測精度" in tags["topics"]


def test_画面が特定できない不満はアプリ全体で受ける():
    """この受け皿が無いと、行き場のない不満が HOME に流れ込んで意味が壊れる。"""
    tags = classify_keywords("アプリの起動が重い")
    assert tags["features"] == [APP_WIDE]
    assert "動作・安定性" in tags["topics"]
    assert "HOME" not in tags["features"]


def test_他の画面が当たったらアプリ全体は落とす():
    tags = classify_keywords("アプリのカレンダーが見づらい")
    assert "カレンダー" in tags["features"]
    assert APP_WIDE not in tags["features"]


def test_どの画面にも当たらなければその他だけ():
    tags = classify_keywords("かわいくて気に入っています")
    assert tags["features"] == [OTHER]
    assert tags["topics"] == []


def test_症状は無理に当てはめない():
    """features と違い topics は空を許す（当てはまらないものを数えないため）。"""
    assert classify_keywords("ホーム画面が好きです")["topics"] == []


def test_全角と大文字を吸収する():
    """NFKC 正規化と小文字化が効いていること。"""
    assert "チャット" in classify_keywords("ＡＩに相談できるのがいい")["features"]


def test_APIキーがなければネットワークに出ずキーワードで分類する(monkeypatch):
    monkeypatch.setattr(config, "ANTHROPIC_API_KEY", "")
    result = classify_texts(["ログインできない", "広告が多すぎる"])
    assert result[0]["topics"] == ["ログイン"]
    assert "広告" in result[1]["topics"]


def test_空リストは空を返す():
    assert classify_texts([]) == []
