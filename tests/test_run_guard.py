"""実行間隔ガードの回帰テスト。

このガードは以前「前回実行から24時間」で判定していて、GitHub Actions の cron が
遅れるたびに翌日の実行がスキップされ、1日分の収集が静かに飛んでいた。
実測ケース（2026-08-07T00:59Z の次に 2026-08-07T21:30Z）を含めて固定する。
"""

from datetime import datetime, timezone

import pytest

from collector import config, main


def state(last_run_at: str) -> dict:
    return {"_meta": {"last_run_at": last_run_at}}


def utc(text: str) -> datetime:
    return datetime.fromisoformat(text).astimezone(timezone.utc)


@pytest.fixture(autouse=True)
def default_config(monkeypatch):
    monkeypatch.setattr(config, "FORCE_RUN", False)
    monkeypatch.setattr(config, "COLLECT_ONCE_PER_DAY", True)


def test_同じJSTの日ならスキップする():
    # どちらも JST では 2026-08-08
    skip, day = main._should_skip_run(
        state("2026-08-07T21:30:00+00:00"), now=utc("2026-08-07T23:59:00+00:00")
    )
    assert skip
    assert day == "2026-08-08"


def test_JSTの日付が変わっていれば実行する():
    skip, _ = main._should_skip_run(
        state("2026-08-07T21:30:00+00:00"), now=utc("2026-08-08T21:00:00+00:00")
    )
    assert not skip


def test_cronが遅れた翌日も実行する():
    """実測の取りこぼしケース。24時間ガードでは 20.5 時間差でスキップされていた。"""
    skip, _ = main._should_skip_run(
        state("2026-08-07T00:59:45+00:00"), now=utc("2026-08-07T21:30:00+00:00")
    )
    assert not skip  # JST では 8/7 → 8/8 で日付が変わっている


def test_日付をまたがない範囲の連打はスキップする():
    """cron の遅れは通すが、同じ日の手動再実行までは通さない。"""
    skip, _ = main._should_skip_run(
        state("2026-08-07T21:30:00+00:00"), now=utc("2026-08-07T21:35:00+00:00")
    )
    assert skip


def test_FORCE_RUNで上書きできる(monkeypatch):
    monkeypatch.setattr(config, "FORCE_RUN", True)
    skip, _ = main._should_skip_run(
        state("2026-08-07T21:30:00+00:00"), now=utc("2026-08-07T21:35:00+00:00")
    )
    assert not skip


def test_ガードを無効化できる(monkeypatch):
    monkeypatch.setattr(config, "COLLECT_ONCE_PER_DAY", False)
    skip, _ = main._should_skip_run(
        state("2026-08-07T21:30:00+00:00"), now=utc("2026-08-07T21:35:00+00:00")
    )
    assert not skip


def test_初回は前回実行がないので走る():
    assert main._should_skip_run(state(""), now=utc("2026-08-07T21:30:00+00:00"))[0] is False
    assert main._should_skip_run({}, now=utc("2026-08-07T21:30:00+00:00"))[0] is False


def test_壊れた日時は無視して走る():
    """state が壊れていても収集を止めない（止まると誰も気づけないため）。"""
    skip, _ = main._should_skip_run(state("not-a-date"), now=utc("2026-08-07T21:30:00+00:00"))
    assert not skip


def test_タイムゾーンなしの記録はUTCとみなす():
    """実行環境のローカル時刻に引きずられて判定が変わらないこと。"""
    skip, day = main._should_skip_run(
        state("2026-08-07T21:30:00"), now=utc("2026-08-07T23:00:00+00:00")
    )
    assert skip
    assert day == "2026-08-08"
