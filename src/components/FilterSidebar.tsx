import { useMemo, useState } from "react";
import { Button, SearchInput, Stack } from "smarthr-ui";
import type { Item } from "../types";
import {
  FEATURES,
  PERIOD_PRESETS,
  SOURCE_LABEL,
  VERSION_LIMIT,
  activeFilterCount,
  activePeriodPreset,
  applyFilters,
  dayKey,
  hasActiveFilter,
  periodRange,
  toggled,
  verKey,
  type Filters,
} from "../lib";
import { FilterGroup } from "./FilterGroup";

type Props = {
  items: Item[];
  filters: Filters;
  versions: string[];
  /** データ内の最新レビュー日。「直近N日」の基準日に使う */
  latestDay: string;
  onChange: (next: Filters) => void;
  onClear: () => void;
};

export function FilterSidebar({
  items,
  filters,
  versions,
  latestDay,
  onChange,
  onClear,
}: Props) {
  const [open, setOpen] = useState(false); // モバイルの絞り込み開閉
  const [versionExpanded, setVersionExpanded] = useState(false);
  const active = hasActiveFilter(filters);
  const activeCount = activeFilterCount(filters);

  /**
   * 件数は「その選択肢を選んだら何件になるか」を示す。
   * 自分の群の条件だけ外した結果を母集団にする（他の絞り込みは効かせる）ため、
   * 表示中の件数と食い違わない。
   */
  const base = useMemo(() => {
    const without = (patch: Partial<Filters>) => applyFilters(items, { ...filters, ...patch });
    return {
      period: without({ from: "", to: "" }),
      source: without({ source: "all" }),
      ratings: without({ ratings: new Set<number>() }),
      features: without({ features: new Set<string>() }),
      versions: without({ versions: new Set<string>() }),
    };
  }, [items, filters]);

  const sourceCounts: Record<string, number> = {};
  for (const d of base.source) sourceCounts[d.source] = (sourceCounts[d.source] || 0) + 1;

  const ratingCounts: Record<number, number> = {};
  for (const d of base.ratings)
    if (d.rating) ratingCounts[d.rating] = (ratingCounts[d.rating] || 0) + 1;

  const featCounts: Record<string, number> = {};
  for (const d of base.features)
    for (const f of d.features?.length ? d.features : ["その他"])
      featCounts[f] = (featCounts[f] || 0) + 1;

  const verCounts: Record<string, number> = {};
  for (const d of base.versions) verCounts[verKey(d)] = (verCounts[verKey(d)] || 0) + 1;

  const periodOptions = PERIOD_PRESETS.map((p) => {
    const { from } = periodRange(p.value, latestDay);
    return {
      value: p.value,
      label: p.label,
      count: from ? base.period.filter((d) => dayKey(d) >= from).length : base.period.length,
    };
  });

  // 件数0でも選択肢は消さない（絞り込みのたびに項目が出入りすると位置を見失う）
  const sourceOptions = [
    { value: "all", label: "すべて", count: base.source.length },
    ...(["app_store", "google_play"] as const).map((key) => ({
      value: key,
      label: SOURCE_LABEL[key],
      count: sourceCounts[key] || 0,
    })),
  ];

  const clearButton = (extraClass: string) =>
    active ? (
      <Button variant="text" size="S" className={extraClass} onClick={onClear}>
        絞り込みをクリア
      </Button>
    ) : null;

  return (
    <aside className="sidebar" aria-label="検索と絞り込み">
      <Stack gap="S" as="div">
        <SearchInput
          className="search-field"
          name="search"
          tooltipMessage="キーワードで絞り込み"
          placeholder="キーワードで絞り込み（例: 記録 消えた）"
          aria-label="キーワード検索"
          spellCheck={false}
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
        />
        {/* デスクトップ: 検索直下のクイッククリア導線（≤980pxでは非表示） */}
        {clearButton("sidebar-clear-desktop")}
        <button
          type="button"
          className="filter-toggle"
          aria-expanded={open}
          aria-controls="filter-body"
          onClick={() => setOpen(!open)}
        >
          <span>絞り込み</span>
          <span className="filter-toggle-meta">
            {activeCount ? `${activeCount}件適用中` : "未適用"}
          </span>
        </button>
        <div className={"filter-body" + (open ? " open" : "")} id="filter-body">
          <Stack gap="M" as="div">
            <FilterGroup
              legend="期間"
              type="radio"
              name="period"
              options={periodOptions}
              selectedValues={[activePeriodPreset(filters, latestDay)]}
              onToggle={(value) =>
                onChange({ ...filters, ...periodRange(String(value), latestDay) })
              }
            />
            <FilterGroup
              legend="ソース"
              type="radio"
              name="source"
              options={sourceOptions}
              selectedValues={[filters.source]}
              onToggle={(value) => onChange({ ...filters, source: String(value) })}
            />
            <FilterGroup
              legend="評価"
              type="checkbox"
              name="rating"
              options={[5, 4, 3, 2, 1].map((r) => ({
                value: r,
                label: `星${r}`,
                count: ratingCounts[r] || 0,
              }))}
              selectedValues={[...filters.ratings]}
              onToggle={(value) =>
                onChange({ ...filters, ratings: toggled(filters.ratings, Number(value)) })
              }
            />
            <FilterGroup
              legend="機能"
              type="checkbox"
              name="feature"
              options={FEATURES.map((f) => ({ value: f, label: f, count: featCounts[f] || 0 }))}
              selectedValues={[...filters.features]}
              onToggle={(value) =>
                onChange({ ...filters, features: toggled(filters.features, String(value)) })
              }
            />
            <FilterGroup
              legend="バージョン"
              type="checkbox"
              name="version"
              options={versions.map((v) => ({
                value: v,
                label: v === "不明" ? v : `v${v}`,
                count: verCounts[v] || 0,
              }))}
              selectedValues={[...filters.versions]}
              onToggle={(value) =>
                onChange({ ...filters, versions: toggled(filters.versions, String(value)) })
              }
              collapse={{
                limit: VERSION_LIMIT,
                expanded: versionExpanded,
                onToggle: () => setVersionExpanded(!versionExpanded),
              }}
            />
            {/* モバイル: パネル内末尾のクリア導線（>980pxでは非表示） */}
            {clearButton("sidebar-clear-mobile")}
          </Stack>
        </div>
      </Stack>
    </aside>
  );
}
