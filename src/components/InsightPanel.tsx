import { useMemo, useState } from "react";
import { Base, Checkbox, Cluster, Heading, Section, Stack, Text } from "smarthr-ui";
import type { Item } from "../types";
import {
  MIN_RATE_SAMPLE,
  applyFilters,
  formatCount,
  featureBreakdown,
  lowRatingRate,
  monthRange,
  monthlyTrend,
  toggled,
  versionBreakdown,
  type Filters,
} from "../lib";

type Props = {
  items: Item[];
  /** 現在の絞り込み結果。見出しの全体値はこれを使う（一覧の件数と食い違わないように） */
  data: Item[];
  filters: Filters;
  onChange: (next: Filters) => void;
};

type Axis = "month" | "version";

const pct = (rate: number) => `${Math.round(rate * 100)}%`;

type RowProps = {
  label: string;
  total: number;
  low: number;
  /** 全体の★1-2率。バー上に基準線として引き、平均より高いか低いかを読めるようにする */
  baseline: number;
  selected: boolean;
  actionLabel: string;
  onClick: () => void;
};

/** 母数が十分なら★1-2率のバー、足りなければ率を出さず件数だけ（DESIGN.md §7） */
function InsightRow({ label, total, low, baseline, selected, actionLabel, onClick }: RowProps) {
  const enough = total >= MIN_RATE_SAMPLE;
  const rate = total ? low / total : 0;
  const detail =
    total === 0
      ? "口コミなし"
      : enough
        ? `${formatCount(total)}件中 星1・2 が ${formatCount(low)}件（${pct(rate)}）`
        : `${formatCount(total)}件（率を出すには件数が足りません）`;

  return (
    <li>
      <button
        type="button"
        className={"insight-row" + (selected ? " selected" : "")}
        disabled={total === 0}
        aria-pressed={selected}
        aria-label={`${label} ${detail}。${actionLabel}`}
        onClick={onClick}
      >
        <span className="insight-label">{label}</span>
        <span className="insight-bar" aria-hidden="true">
          {enough && (
            <>
              <span className="insight-bar-fill" style={{ width: `${rate * 100}%` }} />
              <span className="insight-bar-mark" style={{ left: `${baseline * 100}%` }} />
            </>
          )}
        </span>
        <span className="insight-value">
          <span className="insight-rate">{enough ? pct(rate) : "—"}</span>
          <span className="insight-sub">{formatCount(total)}件</span>
        </span>
      </button>
    </li>
  );
}

/**
 * 「どこに不満が集まっているか」の入口。
 * 月別／バージョン別と機能別の★1-2率を並べ、行クリックで一覧の絞り込みへ着地させる。
 * 行はトグル（複数選択可）で、選択状態はサイドバーの絞り込みと同じ値を指す。
 */
export function InsightPanel({ items, data, filters, onChange }: Props) {
  const [axis, setAxis] = useState<Axis>("month");
  const [open, setOpen] = useState(false); // モバイルの開閉（デスクトップでは常時表示）

  /**
   * 評価の絞り込みは常に外す。★1-2率を測る母集団から★3-5を除いてしまうと
   * どの行も100%になり、傾向がまったく読めなくなるため。
   * そのうえで各ブロックは「自分の軸だけ外した母集団」を見る（サイドバーの件数と同じ考え方）。
   * そうしないと、選択中の行だけが絞り込み前の件数のまま残って誤読を招く。
   */
  const rated = useMemo(() => ({ ...filters, ratings: new Set<number>() }), [filters]);
  const periodBase = useMemo(
    () => applyFilters(items, { ...rated, from: "", to: "" }),
    [items, rated],
  );
  const versionBase = useMemo(
    () => applyFilters(items, { ...rated, versions: new Set<string>() }),
    [items, rated],
  );
  const featureBase = useMemo(
    () => applyFilters(items, { ...rated, features: new Set<string>() }),
    [items, rated],
  );
  const ratingNeutral = useMemo(() => applyFilters(items, rated), [items, rated]);

  const months = useMemo(() => monthlyTrend(periodBase), [periodBase]);
  const versions = useMemo(() => versionBreakdown(versionBase), [versionBase]);
  const features = useMemo(() => featureBreakdown(featureBase), [featureBase]);

  // 基準線は各ブロックの母集団の値。見出しの数字は一覧と揃えるため絞り込み後の値を使う
  const axisBaseline = useMemo(
    () => lowRatingRate(axis === "month" ? periodBase : versionBase).rate,
    [axis, periodBase, versionBase],
  );
  const featureBaseline = useMemo(() => lowRatingRate(featureBase).rate, [featureBase]);
  const overall = useMemo(() => lowRatingRate(ratingNeutral), [ratingNeutral]);

  if (!data.length) return null;

  const lowOnly = filters.ratings.size === 2 && filters.ratings.has(1) && filters.ratings.has(2);

  return (
    <Base as="section" layer={0} radius="m" padding="M" className="insight">
      {/* 見出し階層を H1→H2→H3 でつなぐ。視覚的にはブロック見出しとモバイルのトグルが役目を果たすため隠す */}
      <Heading type="blockTitle" className="visually-hidden">
        傾向
      </Heading>
      {/* モバイルは既定で畳む。畳んでいても要点（★1-2の割合）は見えるようにする */}
      <button
        type="button"
        className="insight-toggle"
        aria-expanded={open}
        aria-controls="insight-body"
        onClick={() => setOpen(!open)}
      >
        <span>傾向</span>
        <span className="insight-toggle-meta">
          星1・2 {pct(overall.rate)}
        </span>
      </button>
      <Stack gap="S" as="div" className={"insight-body" + (open ? " open" : "")} id="insight-body">
        <Cluster gap="S" align="center" justify="space-between" as="div">
          <Text size="S" className="insight-lede">
            {/* 評価で絞っているときは、傾向の母集団が一覧と違うことを明示する */}
            {filters.ratings.size ? "星の絞り込みを除いた " : ""}
            {formatCount(overall.total)} 件のうち、星1・2 は{" "}
            <strong className="insight-lede-strong">
              {formatCount(overall.low)} 件（{pct(overall.rate)}）
            </strong>
            。バーは星1・2 の割合、縦線が全体の割合です
          </Text>
          <Checkbox
            checked={lowOnly}
            onChange={() =>
              onChange({ ...filters, ratings: lowOnly ? new Set() : new Set([1, 2]) })
            }
          >
            <Text size="S">星1・2 だけ表示</Text>
          </Checkbox>
        </Cluster>

        <div className="insight-grid">
          <Section className="insight-block">
            <Stack gap="XXS" as="div">
              <Cluster gap="XS" align="center" as="div">
                <Heading type="blockTitle" className="insight-head">
                  不満の割合
                </Heading>
                <div className="insight-axis" role="group" aria-label="集計の軸">
                  {(
                    [
                      ["month", "月別"],
                      ["version", "バージョン別"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={"insight-axis-btn" + (axis === value ? " selected" : "")}
                      aria-pressed={axis === value}
                      onClick={() => setAxis(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Cluster>

              <ul className="insight-rows">
                {axis === "month"
                  ? months.map((m) => {
                      const range = monthRange(m.month);
                      const selected = filters.from === range.from && filters.to === range.to;
                      return (
                        <InsightRow
                          key={m.month}
                          label={m.month}
                          total={m.total}
                          low={m.low}
                          baseline={axisBaseline}
                          selected={selected}
                          actionLabel={selected ? "この月の絞り込みを解除" : "この月に絞り込む"}
                          onClick={() =>
                            onChange({
                              ...filters,
                              ...(selected ? { from: "", to: "" } : range),
                            })
                          }
                        />
                      );
                    })
                  : versions.map((v) => {
                      const selected = filters.versions.has(v.version);
                      return (
                        <InsightRow
                          key={v.version}
                          label={v.version === "不明" ? v.version : `v${v.version}`}
                          total={v.total}
                          low={v.low}
                          baseline={axisBaseline}
                          selected={selected}
                          actionLabel={
                            selected ? "このバージョンの絞り込みを解除" : "このバージョンを追加"
                          }
                          onClick={() =>
                            onChange({
                              ...filters,
                              versions: toggled(filters.versions, v.version),
                            })
                          }
                        />
                      );
                    })}
              </ul>
            </Stack>
          </Section>

          <Section className="insight-block">
            <Stack gap="XXS" as="div">
              <Heading type="blockTitle" className="insight-head">
                不満が集まっている機能
              </Heading>
              {features.length ? (
                <ul className="insight-rows">
                  {features.map((f) => {
                    const selected = filters.features.has(f.feature);
                    return (
                      <InsightRow
                        key={f.feature}
                        label={f.feature}
                        total={f.total}
                        low={f.low}
                        baseline={featureBaseline}
                        selected={selected}
                        actionLabel={selected ? "この機能の絞り込みを解除" : "この機能を追加"}
                        onClick={() =>
                          onChange({
                            ...filters,
                            features: toggled(filters.features, f.feature),
                          })
                        }
                      />
                    );
                  })}
                </ul>
              ) : (
                <Text size="S" color="TEXT_GREY">
                  この条件では、率を出せるだけの件数（{MIN_RATE_SAMPLE}件以上）がある機能がありません
                </Text>
              )}
            </Stack>
          </Section>
        </div>
      </Stack>
    </Base>
  );
}
