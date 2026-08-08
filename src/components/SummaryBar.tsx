import { Button, Cluster, Text } from "smarthr-ui";
import type { Item } from "../types";
import {
  FEATURES,
  SOURCE_LABEL,
  THEMES,
  formatCount,
  hasActiveFilter,
  hasPeriodFilter,
  itemsToMarkdown,
  periodLabel,
  toggled,
  type Filters,
} from "../lib";
import { CopyButton } from "./CopyButton";

type Props = {
  /** 絞り込み結果。まとめてコピーの対象 */
  data: Item[];
  total: number;
  shownCount: number;
  latestDate: string;
  loadState: "loading" | "ready" | "error";
  filters: Filters;
  versions: string[];
  onChange: (next: Filters) => void;
  onClear: () => void;
};

/** 結果件数 + 適用中フィルターの削除可能ボタン + すべてクリア。sticky。 */
export function SummaryBar({
  data,
  total,
  shownCount,
  latestDate,
  loadState,
  filters,
  versions,
  onChange,
  onClear,
}: Props) {
  const active: Array<{ label: string; remove: () => void }> = [];
  if (hasPeriodFilter(filters)) {
    active.push({
      label: periodLabel(filters, latestDate),
      remove: () => onChange({ ...filters, from: "", to: "" }),
    });
  }
  if (filters.source !== "all") {
    active.push({
      label: SOURCE_LABEL[filters.source],
      remove: () => onChange({ ...filters, source: "all" }),
    });
  }
  for (const r of [5, 4, 3, 2, 1].filter((r) => filters.ratings.has(r))) {
    active.push({
      label: `星${r}`,
      remove: () => onChange({ ...filters, ratings: toggled(filters.ratings, r) }),
    });
  }
  for (const f of FEATURES.filter((f) => filters.features.has(f))) {
    active.push({
      label: f,
      remove: () => onChange({ ...filters, features: toggled(filters.features, f) }),
    });
  }
  for (const t of THEMES.filter((t) => filters.themes.has(t.key))) {
    active.push({
      label: t.label,
      remove: () => onChange({ ...filters, themes: toggled(filters.themes, t.key) }),
    });
  }
  for (const v of versions.filter((v) => filters.versions.has(v))) {
    active.push({
      label: v === "不明" ? v : `v${v}`,
      remove: () => onChange({ ...filters, versions: toggled(filters.versions, v) }),
    });
  }

  return (
    <Cluster gap="XS" align="center" className="summary" as="div">
      {/* 絞り込み結果の変化を支援技術にも通知する */}
      <Text size="S" color="TEXT_GREY" aria-live="polite" className="summary-count">
        {loadState === "loading" && "読み込み中…"}
        {loadState === "error" && "データの読み込みに失敗しました"}
        {/* 絞り込みなしのときに「1241 件中 1241 件」と繰り返さない */}
        {loadState === "ready" &&
          `${
            shownCount === total
              ? `${formatCount(total)} 件`
              : `${formatCount(total)} 件中 ${formatCount(shownCount)} 件`
          } ・ データ最終更新 ${latestDate}`}
      </Text>
      {loadState === "ready" && shownCount > 0 && (
        <CopyButton
          variant="secondary"
          label="Markdownでコピー"
          ariaLabel={`絞り込み結果 ${formatCount(shownCount)} 件を Markdown でコピー`}
          getText={() => {
            // 何で絞った結果かを見出しに残す。貼り先で文脈が失われないように
            const conditions = active.length ? `（${active.map((a) => a.label).join(" / ")}）` : "";
            return itemsToMarkdown(
              data,
              `ソフィBe 口コミ${conditions} ${formatCount(shownCount)} 件 ・ データ最終更新 ${latestDate}`,
            );
          }}
        />
      )}
      {active.map((item) => (
        <Button
          key={item.label}
          // skeleton は暗背景用（白文字）で明るい地では読めない。secondary で枠付きにする
          variant="secondary"
          size="S"
          suffix={<span aria-hidden="true">×</span>}
          aria-label={`${item.label} の絞り込みを解除`}
          onClick={item.remove}
          className="summary-chip"
        >
          {item.label}
        </Button>
      ))}
      {hasActiveFilter(filters) && (
        <Button variant="text" size="S" onClick={onClear}>
          すべてクリア
        </Button>
      )}
    </Cluster>
  );
}
