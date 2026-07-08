import { useState } from "react";
import { Button, SearchInput, Stack } from "smarthr-ui";
import type { Item } from "../types";
import {
  FEATURES,
  SOURCE_LABEL,
  VERSION_LIMIT,
  activeFilterCount,
  hasActiveFilter,
  toggled,
  verKey,
  type Filters,
} from "../lib";
import { FilterGroup } from "./FilterGroup";

type Props = {
  items: Item[];
  filters: Filters;
  versions: string[];
  onChange: (next: Filters) => void;
  onClear: () => void;
};

export function FilterSidebar({ items, filters, versions, onChange, onClear }: Props) {
  const [open, setOpen] = useState(false); // モバイルの絞り込み開閉
  const [versionExpanded, setVersionExpanded] = useState(false);
  const active = hasActiveFilter(filters);
  const activeCount = activeFilterCount(filters);

  const sourceCounts: Record<string, number> = {};
  for (const d of items) sourceCounts[d.source] = (sourceCounts[d.source] || 0) + 1;

  const ratingCounts: Record<number, number> = {};
  for (const d of items) if (d.rating) ratingCounts[d.rating] = (ratingCounts[d.rating] || 0) + 1;

  const featCounts: Record<string, number> = {};
  for (const d of items)
    for (const f of d.features || ["その他"]) featCounts[f] = (featCounts[f] || 0) + 1;

  const verCounts: Record<string, number> = {};
  for (const d of items) verCounts[verKey(d)] = (verCounts[verKey(d)] || 0) + 1;

  const sourceOptions = [
    { value: "all", label: "すべて", count: items.length },
    ...(["app_store", "google_play"] as const)
      .filter((key) => sourceCounts[key])
      .map((key) => ({ value: key, label: SOURCE_LABEL[key], count: sourceCounts[key] })),
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
                count: verCounts[v],
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
