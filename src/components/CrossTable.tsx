import { useMemo, useState, type CSSProperties } from "react";
import { Section, Stack, Text } from "smarthr-ui";
import type { Item } from "../types";
import { crossBreakdown, formatCount, type Filters } from "../lib";

type Props = {
  /** 機能・テーマの絞り込みを外した母集団（他のブロックと同じ考え方） */
  base: Item[];
  filters: Filters;
  onChange: (next: Filters) => void;
};

// 濃淡の上限。これ以上濃くすると本文色とのコントラストが落ちる（DESIGN.md §3）
const MAX_TINT = 60;
const MIN_TINT = 8;

/**
 * 機能（画面）× テーマ（症状）のクロス表。
 *
 * 1軸のランキングでは「記録の不満が多い」までしか分からないので、
 * それが何の症状なのかを1画面で読めるようにする。
 * セルを押すと両方の軸を同時に絞り込んで一覧へ着地する。
 */
export function CrossTable({ base, filters, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const cross = useMemo(() => crossBreakdown(base), [base]);

  if (!cross.top) return null;

  return (
    <Section className="cross">
      {/* 既定は閉。閉じていても最多セルだけはトグル行に出す（開かなくても1行ぶんは読める） */}
      <button
        type="button"
        className="cross-toggle"
        aria-expanded={open}
        aria-controls="cross-body"
        onClick={() => setOpen(!open)}
      >
        <span>機能 × テーマ</span>
        <span className="cross-toggle-meta">
          最多: {cross.top.feature} × {cross.top.label} {formatCount(cross.top.low)}件
        </span>
      </button>

      <Stack gap="XXS" as="div" className={"cross-body" + (open ? " open" : "")} id="cross-body">
        <Text size="XS" color="TEXT_GREY">
          数字は星1・2の件数。押すと機能とテーマの両方で絞り込みます
          {cross.uncategorized > 0 &&
            `（テーマに当てはまらない ${formatCount(cross.uncategorized)}件はこの表に出ません）`}
        </Text>
        <div className="cross-scroll">
          <table className="cross-table">
            <caption className="visually-hidden">
              機能とテーマの組み合わせごとの星1・2の件数
            </caption>
            <thead>
              <tr>
                <td />
                {cross.features.map((feature) => (
                  <th key={feature} scope="col">
                    {feature}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cross.rows.map((row) => (
                <tr key={row.theme}>
                  <th scope="row">{row.label}</th>
                  {row.cells.map((cell) => {
                    const selected =
                      filters.features.has(cell.feature) && filters.themes.has(cell.theme);
                    // 0件は色を付けない。1件でも入ったら最低限の濃さを持たせて空欄と区別する
                    const tint = cell.low
                      ? MIN_TINT + Math.round(((MAX_TINT - MIN_TINT) * cell.low) / cross.max)
                      : 0;
                    return (
                      <td key={cell.feature}>
                        <button
                          type="button"
                          className={"cross-cell" + (selected ? " selected" : "")}
                          style={tint ? ({ "--tint": `${tint}%` } as CSSProperties) : undefined}
                          disabled={cell.total === 0}
                          aria-pressed={selected}
                          aria-label={
                            `${cell.feature} × ${row.label} 星1・2が${formatCount(cell.low)}件` +
                            `（全${formatCount(cell.total)}件）。` +
                            (selected ? "この絞り込みを解除" : "この2つで絞り込む")
                          }
                          onClick={() =>
                            onChange({
                              ...filters,
                              features: new Set(selected ? [] : [cell.feature]),
                              themes: new Set(selected ? [] : [cell.theme]),
                            })
                          }
                        >
                          {cell.total === 0 ? "" : formatCount(cell.low)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Stack>
    </Section>
  );
}
