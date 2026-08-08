"""口コミを2つの軸でタグ付けする分類器。

- features（画面）: どの画面・機能の話か
- topics（症状）: どういう困りごとか

軸を分けたのは、1軸だと画面に紐づかない不満（重い・移行・広告など）の行き場が
なくなり、受け皿として HOME に流れ込んで意味が壊れたため。実際、旧体系では
HOME タグ329件のうち本文に「ホーム/画面」を含むのは28%しかなく、
「重い・落ちる」112件のうち68件が HOME になっていた。この状態で
「不満が集まっている機能」を見ると HOME が首位に出るが、中身は起動の遅さで、
ホーム画面のデザイン問題だと読み違える。

ANTHROPIC_API_KEY があれば Claude Haiku に文脈を読ませて分類し、
無い場合・失敗時はキーワード分類にフォールバックする。
一度付いたタグは保持される（store.py 側で未分類のものだけ渡す）。
"""

import json
import unicodedata

from . import config
from .http_util import post_json

CLASSIFY_MODEL = "claude-haiku-4-5"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
BATCH_SIZE = 40

OTHER = "その他"
APP_WIDE = "アプリ全体"
FEATURE_NAMES = [
    "HOME", "記録", "チャット", "カレンダー", "レポート", "コンテンツ", "設定", APP_WIDE, OTHER,
]

# 機能の定義。LLMプロンプトとキーワードフォールバックの両方で使う
FEATURE_DEFS: dict[str, dict] = {
    "HOME": {
        # 旧定義の「画面デザイン全般」を外した。この一語があるために
        # 画面を特定しない不満がすべて HOME に吸い込まれていた
        "desc": "ホーム画面に固有の話。今日の体調・ホルモン状態の表示、ホームの導線やウィジェット",
        "keywords": ["ホーム", "home", "トップ画面", "ウィジェット"],
    },
    "記録": {
        "desc": "生理日・体温・体重・症状・気分などの入力/記録。記録操作の手間、記録データの消失",
        "keywords": ["記録", "入力", "基礎体温", "体温", "体重", "メモ", "つけ忘れ"],
    },
    "チャット": {
        "desc": "AIチャットでの相談・質問機能",
        "keywords": ["チャット", "ai", "相談", "質問"],
    },
    "カレンダー": {
        "desc": "カレンダー表示、生理日・排卵日の予測とその精度、生理周期のズレ",
        "keywords": ["カレンダー", "生理日", "予定日", "周期", "予測"],
    },
    "レポート": {
        "desc": "ホルモングラフ、体調の分析・振り返りレポート",
        "keywords": ["レポート", "グラフ", "ホルモン", "分析"],
    },
    "コンテンツ": {
        "desc": "コラム・記事・動画などの読み物コンテンツ",
        "keywords": ["コラム", "記事", "動画", "コンテンツ"],
    },
    "設定": {
        "desc": "ログイン・アカウント、通知設定、機種変更・引き継ぎ、外部機器連携（体温計等）、同期・バックアップ",
        "keywords": [
            "設定", "ログイン", "アカウント", "通知", "引き継ぎ", "引継ぎ",
            "パスワード", "機種変更", "連携", "同期", "データ移行", "バックアップ",
        ],
    },
    APP_WIDE: {
        # 特定画面に紐づかない話の受け皿。これを明示しないと HOME に流れ込む
        "desc": "特定の画面ではなくアプリ全体の話。起動・動作速度・クラッシュ、アプリ全体のUIや世界観、広告、課金",
        "keywords": ["アプリ", "起動", "重い", "落ちる", "広告", "課金"],
    },
}

# 症状・観点の定義（features とは独立した2軸目）
TOPIC_DEFS: dict[str, dict] = {
    "動作・安定性": {
        "desc": "重い・遅い・もっさりする、フリーズ、落ちる・強制終了、起動しない・開かない",
        "keywords": ["重い", "遅い", "もっさり", "固まる", "落ちる", "強制終了", "開かない", "起動しない", "フリーズ"],
    },
    "旧アプリ移行": {
        "desc": "リニューアル前の旧アプリと比べた不満、前の版に戻してほしい、移行時のつまずき",
        "keywords": ["前のアプリ", "旧アプリ", "元のアプリ", "以前のアプリ", "戻して", "戻したい", "リニューアル", "アップデート前"],
    },
    "同期・データ消失": {
        "desc": "記録やデータが消えた、同期されない、機種変更の引き継ぎ、バックアップ",
        "keywords": ["消え", "同期", "引き継", "引継", "バックアップ", "機種変更", "データ移行"],
    },
    "予測精度": {
        "desc": "生理日・排卵日の予測が当たらない、周期がずれる、予測の根拠が分からない",
        "keywords": ["予測", "ずれ", "ズレ", "当たらない", "周期"],
    },
    "ログイン": {
        "desc": "ログインできない、アカウント作成・パスワード、会員登録の手間",
        "keywords": ["ログイン", "パスワード", "アカウント", "会員登録"],
    },
    "通知": {
        "desc": "通知が来ない・多すぎる・タイミングがずれる、通知設定",
        "keywords": ["通知", "お知らせ", "リマインド"],
    },
    "広告": {
        "desc": "アプリ内広告、他アプリでのCM・宣伝への不満",
        "keywords": ["広告", "cm", "コマーシャル", "宣伝"],
    },
    "課金・特典": {
        "desc": "課金・有料プラン、ポイント・プレゼント・応募キャンペーン",
        "keywords": ["課金", "有料", "ポイント", "プレゼント", "応募", "キャンペーン"],
    },
    "使い勝手・UI": {
        "desc": "操作が分かりにくい・手数が多い、画面がごちゃごちゃ、見た目やデザインの好き嫌い",
        "keywords": ["使いにく", "使いづら", "分かりにく", "わかりにく", "ごちゃ", "見づらい", "見にくい", "操作"],
    },
    "表現・言葉づかい": {
        "desc": "アプリ内の言い回し・用語・トーンへの違和感、表現が不快・恥ずかしい",
        "keywords": ["言葉", "表現", "言い方", "用語", "呼び方"],
    },
}
TOPIC_NAMES = list(TOPIC_DEFS)

CLASSIFY_PROMPT = """あなたはユニ・チャームの生理・ホルモン管理アプリ「ソフィBe」のレビュー分析を担当しています。
以下のレビューそれぞれに、2種類のタグを付けてください。

【軸1】features = どの画面・機能の話か
{feature_defs}

【軸2】topics = どういう困りごと・観点か
{topic_defs}

ルール:
- 2つの軸は独立している。同じレビューに features と topics の両方を付ける
- どちらも複数該当すれば複数付ける
- features: 画面が特定できないアプリ全般の話（起動が遅い、広告が多い等）は
  「{app_wide}」を使う。HOME は「ホーム画面そのもの」の話にだけ使い、
  行き場のないものの受け皿にしない
- features: 「使いやすい」「可愛い」など特定の画面にも全体にも触れていない
  感想だけなら「{other}」のみ
- topics: 該当する困りごとが無ければ空配列でよい（無理に当てはめない）
- 生理・妊活・ホルモンの話題でも、どの機能の話かを文脈で判断する
  （例:「予測が当たらない」→ features:カレンダー / topics:予測精度、
    「アップデートで記録が消えた」→ features:記録,設定 / topics:同期・データ消失、
    「起動に2分かかる」→ features:アプリ全体 / topics:動作・安定性）
- 出力はJSONのみ。形式:
  {{"0": {{"features": ["記録"], "topics": ["同期・データ消失"]}}, "1": {{"features": ["アプリ全体"], "topics": []}}}}
  features は {feature_names} のいずれか、topics は {topic_names} のいずれかに限る

レビュー:
{reviews}"""


def _normalize(text: str) -> str:
    return unicodedata.normalize("NFKC", text or "").lower()


Tags = dict[str, list[str]]


def classify_keywords(text: str) -> Tags:
    """APIキーが無いときの代替。精度は落ちるが費用ゼロで動く。"""
    t = _normalize(text)
    features = [
        name for name, d in FEATURE_DEFS.items()
        if any(w in t for w in d["keywords"])
    ]
    # アプリ全体はどのレビューにも当たりやすいので、他が付いたときは落とす
    if len(features) > 1 and APP_WIDE in features:
        features = [f for f in features if f != APP_WIDE]
    topics = [
        name for name, d in TOPIC_DEFS.items()
        if any(w in t for w in d["keywords"])
    ]
    return {"features": features or [OTHER], "topics": topics}


def _defs_block(defs: dict[str, dict]) -> str:
    return "\n".join(f"- {name}: {d['desc']}" for name, d in defs.items())


def _classify_batch_llm(texts: list[str]) -> list[Tags]:
    reviews = "\n".join(f"{i}: {t[:300]}" for i, t in enumerate(texts))
    prompt = CLASSIFY_PROMPT.format(
        feature_defs=_defs_block(FEATURE_DEFS),
        topic_defs=_defs_block(TOPIC_DEFS),
        other=OTHER,
        app_wide=APP_WIDE,
        feature_names=" / ".join(FEATURE_NAMES),
        topic_names=" / ".join(TOPIC_NAMES),
        reviews=reviews,
    )
    res = post_json(
        ANTHROPIC_URL,
        {
            "model": CLASSIFY_MODEL,
            "max_tokens": 4000,
            "messages": [{"role": "user", "content": prompt}],
        },
        headers={
            "x-api-key": config.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        },
        timeout=120,
    )
    text = json.loads(res)["content"][0]["text"]
    start, end = text.find("{"), text.rfind("}")
    parsed = json.loads(text[start : end + 1])
    result = []
    for i, t in enumerate(texts):
        got = parsed.get(str(i)) or {}
        # 旧形式（配列のみ = features）で返ってきても壊れないようにする
        if isinstance(got, list):
            got = {"features": got, "topics": []}
        features = [x for x in got.get("features", []) if x in FEATURE_NAMES]
        topics = [x for x in got.get("topics", []) if x in TOPIC_NAMES]
        if not features:
            result.append(classify_keywords(t))
        else:
            result.append({"features": features, "topics": topics})
    return result


def classify_texts(texts: list[str]) -> list[Tags]:
    """テキスト群を features / topics に分類。LLM優先・キーワードフォールバック。"""
    if not texts:
        return []
    if not config.ANTHROPIC_API_KEY:
        return [classify_keywords(t) for t in texts]
    result: list[Tags] = []
    for i in range(0, len(texts), BATCH_SIZE):
        chunk = texts[i : i + BATCH_SIZE]
        try:
            result.extend(_classify_batch_llm(chunk))
        except Exception as e:
            print(f"[features] LLM分類失敗、キーワードで代替: {e}")
            result.extend(classify_keywords(t) for t in chunk)
    return result
