import type { Item } from "./types";

export const SOURCE_LABEL: Record<string, string> = {
  app_store: "App Store",
  google_play: "Google Play",
};

export const FEATURES = [
  "HOME",
  "記録",
  "チャット",
  "カレンダー",
  "レポート",
  "コンテンツ",
  "設定",
  "その他",
] as const;

export const PAGE_SIZE = 200;
export const VERSION_LIMIT = 8; // バージョン群の折りたたみ時に表示する最新件数
export const TREND_MONTHS = 12; // 傾向パネルの月次推移で見せる月数
export const MIN_RATE_SAMPLE = 10; // これ未満の母数では率を出さない（少数で順位が跳ねるため）

/** 日付はタイムゾーン付き・なしが混在するため、常に先頭10文字(YYYY-MM-DD)の文字列で扱う */
export const dayKey = (item: Item): string => (item.created_at || "").slice(0, 10);

export const isLowRating = (item: Item): boolean => item.rating != null && item.rating <= 2;

/** "4.16"(iOS) と "4.16.0"(Android) を同じリリースに束ねる */
export const verKey = (item: Item): string => {
  const v = (item.version || "").trim();
  if (!v) return "不明";
  return v.split(".").slice(0, 2).join(".");
};

/** 件数の桁区切り。4桁以上が並ぶので tabular-nums と合わせて読みやすさを保つ */
const numberFormat = new Intl.NumberFormat("ja-JP");
export const formatCount = (n: number): string => numberFormat.format(n);

export const stars = (rating: number): string =>
  "★".repeat(rating) + "☆".repeat(5 - rating);

export type Filters = {
  source: string; // "all" | source key（単一選択）
  ratings: Set<number>;
  versions: Set<string>;
  features: Set<string>;
  query: string;
  /** 期間の内部表現。YYYY-MM-DD、空文字は無制限。プリセットも月クリックもここに落とす */
  from: string;
  to: string;
};

export const hasPeriodFilter = (f: Filters): boolean => !!f.from || !!f.to;

export const hasActiveFilter = (f: Filters): boolean =>
  f.source !== "all" ||
  f.ratings.size > 0 ||
  f.versions.size > 0 ||
  f.features.size > 0 ||
  hasPeriodFilter(f);

export const activeFilterCount = (f: Filters): number =>
  (f.source !== "all" ? 1 : 0) +
  (hasPeriodFilter(f) ? 1 : 0) +
  f.ratings.size +
  f.versions.size +
  f.features.size;

export function applyFilters(items: Item[], f: Filters): Item[] {
  const q = f.query.trim().toLowerCase();
  const words = q ? q.split(/\s+/) : [];
  return items.filter((d) => {
    if (f.from || f.to) {
      const day = dayKey(d);
      if (!day) return false;
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
    }
    if (f.source !== "all" && d.source !== f.source) return false;
    if (f.ratings.size && !(d.rating != null && f.ratings.has(d.rating))) return false;
    if (f.versions.size && !f.versions.has(verKey(d))) return false;
    if (f.features.size && !(d.features || ["その他"]).some((x) => f.features.has(x))) return false;
    if (words.length) {
      const text = `${d.title || ""} ${d.body || ""} ${d.author || ""}`.toLowerCase();
      if (!words.every((w) => text.includes(w))) return false;
    }
    return true;
  });
}

/* ---- Markdown 書き出し（読んだ声をドキュメントやSlackに貼るため） ------------ */

/**
 * 1件を「出典 → 引用 → 元URL」の順で組む。
 * 引用だけ切り出すと出所をたどれなくなるので、必ず出典とURLを添える。
 */
export function itemToMarkdown(item: Item): string {
  const meta = [
    SOURCE_LABEL[item.source] || item.source,
    // 貼り先では ★3 のほうが ★★★☆☆ より短く読み違えにくい
    item.rating ? `★${item.rating}` : null,
    item.version ? `v${item.version}` : null,
    dayKey(item),
  ]
    .filter(Boolean)
    .join(" ");
  const features = item.features?.length ? ` ・ ${item.features.join(" / ")}` : "";

  // 見出しと本文の間を空行で割る。詰めると Markdown 上で1段落に繋がってしまう
  const quoted = [item.title ? `**${item.title}**` : null, item.body]
    .filter(Boolean)
    .join("\n\n")
    .split("\n")
    .map((line) => `> ${line}`.trimEnd())
    .join("\n");

  return [`**${meta}**${features}`, quoted, `[口コミを開く](${item.url})`]
    .filter(Boolean)
    .join("\n");
}

/** 絞り込み結果をまとめて書き出す。先頭に何で絞った結果かを残す */
export function itemsToMarkdown(items: Item[], heading: string): string {
  return [`# ${heading}`, ...items.map(itemToMarkdown)].join("\n\n");
}

export function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** 絞り込み状態をURLクエリに反映する（チームでの共有用）。 */
export function filtersToSearch(f: Filters): string {
  const p = new URLSearchParams();
  if (f.query.trim()) p.set("q", f.query);
  if (f.source !== "all") p.set("source", f.source);
  if (f.ratings.size) p.set("ratings", [...f.ratings].sort((a, b) => b - a).join(","));
  if (f.features.size) p.set("features", [...f.features].join(","));
  if (f.versions.size) p.set("versions", [...f.versions].join(","));
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  const s = p.toString();
  return s ? `?${s}` : "";
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const asDay = (value: string | null): string => (value && DAY_PATTERN.test(value) ? value : "");

export function filtersFromSearch(search: string): Filters {
  const p = new URLSearchParams(search);
  return {
    query: p.get("q") || "",
    source: p.get("source") || "all",
    ratings: new Set(
      (p.get("ratings") || "")
        .split(",")
        .filter(Boolean)
        .map(Number)
        .filter((n) => n >= 1 && n <= 5),
    ),
    features: new Set((p.get("features") || "").split(",").filter(Boolean)),
    versions: new Set((p.get("versions") || "").split(",").filter(Boolean)),
    from: asDay(p.get("from")),
    to: asDay(p.get("to")),
  };
}

/* ---- 期間プリセット ------------------------------------------------------ */

export type PeriodPreset = { value: string; label: string; days: number | null };

/** days=null は全期間。「直近N日」の基準日は今日ではなくデータ内の最新レビュー日 */
export const PERIOD_PRESETS: PeriodPreset[] = [
  { value: "all", label: "全期間", days: null },
  { value: "30d", label: "直近30日", days: 30 },
  { value: "90d", label: "直近90日", days: 90 },
  { value: "365d", label: "直近12ヶ月", days: 365 },
];

/** YYYY-MM-DD から days 日さかのぼった YYYY-MM-DD を返す */
export function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** プリセット値 → from/to。基準日 latestDay が無いときは全期間扱い */
export function periodRange(preset: string, latestDay: string): { from: string; to: string } {
  const found = PERIOD_PRESETS.find((p) => p.value === preset);
  if (!found || found.days == null || !latestDay) return { from: "", to: "" };
  return { from: shiftDay(latestDay, -(found.days - 1)), to: "" };
}

/** 現在の from/to がどのプリセットに一致するか（月クリック時はどれにも一致しない） */
export function activePeriodPreset(f: Filters, latestDay: string): string {
  if (!hasPeriodFilter(f)) return "all";
  for (const p of PERIOD_PRESETS) {
    if (p.days == null) continue;
    const r = periodRange(p.value, latestDay);
    if (r.from === f.from && r.to === f.to) return p.value;
  }
  return "";
}

/** 適用中の期間の表示ラベル（サマリー行のチップ用） */
export function periodLabel(f: Filters, latestDay: string): string {
  const preset = activePeriodPreset(f, latestDay);
  const found = PERIOD_PRESETS.find((p) => p.value === preset);
  if (found && found.days != null) return found.label;
  if (f.from && f.to && f.from.slice(0, 7) === f.to.slice(0, 7)) return f.from.slice(0, 7);
  if (f.from && f.to) return `${f.from} 〜 ${f.to}`;
  return f.from ? `${f.from} 以降` : `${f.to} 以前`;
}

/** その月の1日〜末日を YYYY-MM から作る */
export function monthRange(month: string): { from: string; to: string } {
  const from = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

/* ---- 傾向パネル用の集計 -------------------------------------------------- */

export type MonthStat = { month: string; total: number; low: number };

/**
 * 直近 months ヶ月の件数と★1-2件数。データが1件も無い月も0として埋め、
 * 「静かになった月」が抜け落ちて見えないようにする。
 */
export function monthlyTrend(items: Item[], months = TREND_MONTHS): MonthStat[] {
  const counts = new Map<string, MonthStat>();
  let latest = "";
  for (const d of items) {
    const day = dayKey(d);
    if (!day) continue;
    if (day > latest) latest = day;
    const month = day.slice(0, 7);
    const stat = counts.get(month) || { month, total: 0, low: 0 };
    stat.total += 1;
    if (isLowRating(d)) stat.low += 1;
    counts.set(month, stat);
  }
  if (!latest) return [];

  const [ly, lm] = latest.slice(0, 7).split("-").map(Number);
  const out: MonthStat[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ly, lm - 1 - i, 1));
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push(counts.get(month) || { month, total: 0, low: 0 });
  }
  return out;
}

export type VersionStat = { version: string; total: number; low: number };

/**
 * バージョン別の件数と★1-2件数。「どのリリースで不満が出たか」を追うため、
 * 率順ではなく新しい順に並べる（月次推移と同じく時系列で読む）。
 */
export function versionBreakdown(items: Item[], limit = TREND_MONTHS): VersionStat[] {
  const counts = new Map<string, VersionStat>();
  for (const d of items) {
    const version = verKey(d);
    const stat = counts.get(version) || { version, total: 0, low: 0 };
    stat.total += 1;
    if (isLowRating(d)) stat.low += 1;
    counts.set(version, stat);
  }
  return [...counts.values()]
    .sort((a, b) => {
      if (a.version === "不明") return 1;
      if (b.version === "不明") return -1;
      return b.version.localeCompare(a.version, undefined, { numeric: true });
    })
    .slice(0, limit)
    .reverse(); // 古い→新しい。上から下へ時間が進む月次推移と向きを揃える
}

export type FeatureStat = { feature: string; total: number; low: number; rate: number };

/**
 * 機能タグ別の★1-2率。母数 MIN_RATE_SAMPLE 未満は率が跳ねるので除外する。
 * 1件のレビューが複数タグを持つため、合計は全件数と一致しない。
 */
export function featureBreakdown(items: Item[]): FeatureStat[] {
  const counts = new Map<string, FeatureStat>();
  for (const d of items) {
    for (const f of d.features?.length ? d.features : ["その他"]) {
      const stat = counts.get(f) || { feature: f, total: 0, low: 0, rate: 0 };
      stat.total += 1;
      if (isLowRating(d)) stat.low += 1;
      counts.set(f, stat);
    }
  }
  return [...counts.values()]
    .filter((s) => s.total >= MIN_RATE_SAMPLE)
    .map((s) => ({ ...s, rate: s.low / s.total }))
    .sort((a, b) => b.rate - a.rate || b.total - a.total);
}

/** 全体の★1-2率（機能別ランキングの比較基準） */
export function lowRatingRate(items: Item[]): { total: number; low: number; rate: number } {
  const total = items.length;
  const low = items.filter(isLowRating).length;
  return { total, low, rate: total ? low / total : 0 };
}
