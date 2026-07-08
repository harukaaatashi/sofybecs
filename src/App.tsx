import { useEffect, useMemo, useState } from "react";
import { PageHeading } from "smarthr-ui";
import type { Item } from "./types";
import {
  PAGE_SIZE,
  applyFilters,
  filtersFromSearch,
  filtersToSearch,
  verKey,
  type Filters,
} from "./lib";
import { FilterSidebar } from "./components/FilterSidebar";
import { SummaryBar } from "./components/SummaryBar";
import { ReviewList } from "./components/ReviewList";

export function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  // 初期状態はURLクエリから復元（絞り込み条件をURLで共有できる）
  const [filters, setFiltersRaw] = useState<Filters>(() =>
    filtersFromSearch(window.location.search),
  );
  const [shown, setShown] = useState(PAGE_SIZE);

  // 絞り込み状態をURLに反映（履歴は汚さない）
  useEffect(() => {
    const next = window.location.pathname + filtersToSearch(filters);
    window.history.replaceState(null, "", next);
  }, [filters]);

  useEffect(() => {
    fetch("./items.json", { cache: "no-cache" })
      .then((r) => r.json())
      .then((data: Item[]) => {
        // データ側に重複IDが混入してもReactのkey衝突にならないよう防御的に除去
        const seen = new Set<string>();
        setItems(
          data.filter((d) => {
            const key = `${d.source}:${d.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }),
        );
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, []);

  // フィルター変更時はページングを先頭に戻す
  const setFilters = (next: Filters) => {
    setFiltersRaw(next);
    setShown(PAGE_SIZE);
  };
  const clearFilters = () =>
    setFilters({ ...filtersFromSearch(""), query: filters.query });

  const versions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of items) counts[verKey(d)] = (counts[verKey(d)] || 0) + 1;
    return Object.keys(counts).sort((a, b) => {
      if (a === "不明") return 1;
      if (b === "不明") return -1;
      return b.localeCompare(a, undefined, { numeric: true });
    });
  }, [items]);

  const data = useMemo(() => applyFilters(items, filters), [items, filters]);
  const latestDate = items[0] ? items[0].created_at.slice(0, 10) : "-";

  return (
    <>
      <header className="site-header">
        <div className="wrap">
          {/* autoPageTitle を切り、document.title に "｜SmartHR" が付くのを防ぐ */}
          <PageHeading size="L" autoPageTitle={false} className="site-title">
            ソフィBe 口コミ一覧
          </PageHeading>
        </div>
      </header>
      <div className="wrap">
        <div className="layout">
          <FilterSidebar
            items={items}
            filters={filters}
            versions={versions}
            onChange={setFilters}
            onClear={clearFilters}
          />
          <main className="results">
            <SummaryBar
              total={items.length}
              shownCount={data.length}
              latestDate={latestDate}
              loadState={loadState}
              filters={filters}
              versions={versions}
              onChange={setFilters}
              onClear={clearFilters}
            />
            <ReviewList data={data} shown={shown} onMore={() => setShown(shown + PAGE_SIZE)} />
          </main>
        </div>
      </div>
    </>
  );
}
