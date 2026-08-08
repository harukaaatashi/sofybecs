import { describe, expect, it } from "vitest";
import type { Item } from "./types";
import {
  MIN_RATE_SAMPLE,
  applyFilters,
  featureBreakdown,
  filtersFromSearch,
  filtersToSearch,
  monthlyTrend,
  previousRange,
  themeBreakdown,
  themesOf,
  verKey,
  type Filters,
} from "./lib";

let seq = 0;
function item(over: Partial<Item> = {}): Item {
  return {
    source: "app_store",
    id: `id-${seq++}`,
    created_at: "2026-08-01T10:00:00Z",
    url: "https://example.test",
    rating: 1,
    ...over,
  };
}

const noFilter = (): Filters => filtersFromSearch("");
const filters = (over: Partial<Filters>): Filters => ({ ...noFilter(), ...over });

describe("applyFilters", () => {
  const items = [
    item({ created_at: "2026-06-15T00:00:00Z", rating: 5, features: ["記録"], topics: ["通知"] }),
    item({
      created_at: "2026-08-01T00:00:00+09:00",
      rating: 1,
      features: ["設定"],
      topics: ["ログイン"],
      body: "ログインできない",
      version: "4.16.0",
    }),
  ];

  it("期間は from/to を含む日付で絞る", () => {
    expect(applyFilters(items, filters({ from: "2026-07-01" })).length).toBe(1);
    expect(applyFilters(items, filters({ to: "2026-07-01" })).length).toBe(1);
    expect(applyFilters(items, filters({ from: "2026-06-15", to: "2026-06-15" })).length).toBe(1);
  });

  it("複数の条件はAND、同じ群の中はOR", () => {
    expect(applyFilters(items, filters({ features: new Set(["記録", "設定"]) })).length).toBe(2);
    expect(
      applyFilters(items, filters({ features: new Set(["記録"]), ratings: new Set([1]) })).length,
    ).toBe(0);
  });

  it("検索語はスペース区切りで全部を含むものだけ残す", () => {
    expect(applyFilters(items, filters({ query: "ログイン できない" })).length).toBe(1);
    expect(applyFilters(items, filters({ query: "ログイン 通知" })).length).toBe(0);
  });

  it("バージョンはマイナーまでで束ねて照合する", () => {
    expect(applyFilters(items, filters({ versions: new Set(["4.16"]) })).length).toBe(1);
  });

  it("機能タグを持たない口コミは「その他」として扱う", () => {
    expect(applyFilters([item({ features: [] })], filters({ features: new Set(["その他"]) })).length)
      .toBe(1);
  });
});

describe("verKey", () => {
  it("4.16 と 4.16.0 を同じリリースに束ねる", () => {
    expect(verKey(item({ version: "4.16" }))).toBe(verKey(item({ version: "4.16.0" })));
  });

  it("バージョンが無ければ「不明」", () => {
    expect(verKey(item({ version: "" }))).toBe("不明");
    expect(verKey(item({}))).toBe("不明");
  });
});

describe("themesOf", () => {
  it("収集側の分類があればそれを使う", () => {
    expect(themesOf(item({ topics: ["通知"], body: "重くて落ちる" }))).toEqual(["通知"]);
  });

  it("topics が無い古いデータだけ正規表現で当てる", () => {
    expect(themesOf(item({ body: "重くて落ちる" }))).toContain("動作・安定性");
  });

  it("定義にないタグは捨てる", () => {
    expect(themesOf(item({ topics: ["知らないタグ"] }))).toEqual([]);
  });
});

describe("monthlyTrend", () => {
  it("口コミが1件も無い月も0で埋める（静かになった月を見落とさないため）", () => {
    const trend = monthlyTrend(
      [item({ created_at: "2026-08-01T00:00:00Z" }), item({ created_at: "2026-06-01T00:00:00Z" })],
      3,
    );
    expect(trend.map((m) => m.month)).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(trend.map((m) => m.total)).toEqual([1, 0, 1]);
  });

  it("基準は今日ではなくデータ内の最新月", () => {
    const trend = monthlyTrend([item({ created_at: "2024-03-10T00:00:00Z" })], 2);
    expect(trend.at(-1)?.month).toBe("2024-03");
  });

  it("★1-2だけを low に数える", () => {
    const trend = monthlyTrend([item({ rating: 2 }), item({ rating: 3 }), item({ rating: null })], 1);
    expect(trend[0]).toMatchObject({ total: 3, low: 1 });
  });
});

describe("previousRange", () => {
  it("直前に並ぶ同じ長さの期間を返す", () => {
    // 08-01〜08-10 は両端を含めて10日。前の10日は 07-22〜07-31
    expect(previousRange(filters({ from: "2026-08-01", to: "2026-08-10" }), "")).toEqual({
      from: "2026-07-22",
      to: "2026-07-31",
    });
  });

  it("to が空なら最新日までを今の期間とみなす", () => {
    // 08-01〜08-05 の5日に対して、前の5日は 07-27〜07-31
    expect(previousRange(filters({ from: "2026-08-01" }), "2026-08-05")).toEqual({
      from: "2026-07-27",
      to: "2026-07-31",
    });
  });

  it("期間で絞っていなければ比較対象は無い", () => {
    expect(previousRange(noFilter(), "2026-08-05")).toBeNull();
  });
});

describe("breakdown", () => {
  const many = (n: number, over: Partial<Item>) => Array.from({ length: n }, () => item(over));

  it("母数が MIN_RATE_SAMPLE 未満のグループは率が跳ねるので出さない", () => {
    const items = [
      ...many(MIN_RATE_SAMPLE, { features: ["記録"], topics: ["通知"], rating: 1 }),
      ...many(MIN_RATE_SAMPLE - 1, { features: ["設定"], topics: ["ログイン"], rating: 1 }),
    ];
    expect(featureBreakdown(items).map((f) => f.feature)).toEqual(["記録"]);
    expect(themeBreakdown(items).map((t) => t.key)).toEqual(["通知"]);
  });

  it("★1-2率の高い順に並ぶ", () => {
    const items = [
      ...many(10, { features: ["記録"], rating: 1 }),
      ...many(5, { features: ["設定"], rating: 1 }),
      ...many(5, { features: ["設定"], rating: 5 }),
    ];
    expect(featureBreakdown(items).map((f) => [f.feature, f.rate])).toEqual([
      ["記録", 1],
      ["設定", 0.5],
    ]);
  });

  it("1件が複数タグを持つので合計は全件数と一致しない", () => {
    const items = many(10, { features: ["記録", "設定"], rating: 1 });
    expect(featureBreakdown(items).reduce((n, f) => n + f.total, 0)).toBe(20);
  });

  it("どのテーマにも当たらない口コミはどこにも数えない", () => {
    expect(themeBreakdown(many(10, { topics: [] }))).toEqual([]);
  });
});

describe("URL共有", () => {
  it("絞り込み状態がURL経由で往復しても変わらない", () => {
    const original = filters({
      query: "ログイン",
      source: "google_play",
      ratings: new Set([1, 2]),
      features: new Set(["設定"]),
      versions: new Set(["4.16"]),
      themes: new Set(["ログイン"]),
      from: "2026-07-01",
      to: "2026-07-31",
    });
    expect(filtersFromSearch(filtersToSearch(original))).toEqual(original);
  });

  it("絞り込みが無ければクエリを付けない", () => {
    expect(filtersToSearch(noFilter())).toBe("");
  });

  it("壊れた値は落として画面を白くしない", () => {
    const f = filtersFromSearch("?ratings=9,abc,1&from=2026-13&themes=知らないタグ");
    expect([...f.ratings]).toEqual([1]);
    expect(f.from).toBe("");
    expect(f.themes.size).toBe(0);
  });
});
