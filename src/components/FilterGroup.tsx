import { Button, Checkbox, Cluster, Fieldset, RadioButton, Stack, Text } from "smarthr-ui";

export type FilterOption = {
  value: string | number;
  label: string;
  count: number;
};

type Collapse = {
  limit: number;
  expanded: boolean;
  onToggle: () => void;
};

type Props = {
  legend: string;
  /** checkbox=複数選択 / radio=単一選択 */
  type: "checkbox" | "radio";
  /** radio のときのグループ名（name 属性） */
  name: string;
  options: FilterOption[];
  selectedValues: Array<string | number>;
  onToggle: (value: string | number) => void;
  collapse?: Collapse;
};

/**
 * フィルタ項目のグループ。Fieldset+legend でグループ名を支援技術に伝え、
 * smarthr-ui の Checkbox / RadioButton で選択状態を標準UIとして提示する。
 */
export function FilterGroup({
  legend,
  type,
  name,
  options,
  selectedValues,
  onToggle,
  collapse,
}: Props) {
  // 折りたたみ時は先頭 limit 件 + 選択中の値のみ表示（選択状態は常に見える）
  const collapsible = !!collapse && options.length > collapse.limit;
  const visible =
    collapsible && !collapse!.expanded
      ? options.filter((o, i) => i < collapse!.limit || selectedValues.includes(o.value))
      : options;

  return (
    <Fieldset legend={legend} className="filter-group">
      <Stack gap="XXS" as="div">
        {visible.map((option) => {
          const selected = selectedValues.includes(option.value);
          const label = (
            <Cluster gap="XXS" align="baseline" as="span">
              <span>{option.label}</span>
              <Text size="XS" color="TEXT_GREY" className="filter-count">
                {option.count}
              </Text>
            </Cluster>
          );
          return type === "radio" ? (
            <RadioButton
              key={String(option.value)}
              name={name}
              checked={selected}
              onChange={() => onToggle(option.value)}
            >
              {label}
            </RadioButton>
          ) : (
            <Checkbox
              key={String(option.value)}
              name={name}
              checked={selected}
              onChange={() => onToggle(option.value)}
            >
              {label}
            </Checkbox>
          );
        })}
      </Stack>
      {collapsible && (
        <Button variant="text" size="S" aria-expanded={collapse!.expanded} onClick={collapse!.onToggle}>
          {collapse!.expanded ? "折りたたむ" : `すべて表示（${options.length}）`}
        </Button>
      )}
    </Fieldset>
  );
}
