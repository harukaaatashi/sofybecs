import { useMemo } from "react";
import {
  Base,
  Button,
  Chip,
  Cluster,
  Heading,
  Section,
  Stack,
  Text,
  TextLink,
} from "smarthr-ui";
import type { Item } from "../types";
import { SOURCE_LABEL, stars } from "../lib";

type Props = {
  data: Item[];
  shown: number;
  onMore: () => void;
};

type DateGroup = { date: string; items: Item[] };

function groupByDate(items: Item[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const d of items) {
    const date = d.created_at ? d.created_at.slice(0, 10) : "日付不明";
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.items.push(d);
    else groups.push({ date, items: [d] });
  }
  return groups;
}

/** 日付ごとに Section+Heading でグルーピングした口コミ一覧 + ページング。 */
export function ReviewList({ data, shown, onMore }: Props) {
  const groups = useMemo(() => groupByDate(data.slice(0, shown)), [data, shown]);

  if (!data.length) {
    return (
      <Base layer={0} radius="m" padding="L" className="empty-panel">
        <Text color="TEXT_GREY">条件に合う口コミがありません</Text>
      </Base>
    );
  }

  return (
    <Stack gap="M" as="div">
      {groups.map((group) => (
        <Section key={group.date}>
          <Stack gap="XS">
            <Heading type="blockTitle" className="date-head">
              {group.date}
            </Heading>
            <Stack gap="XS">
              {group.items.map((d) => (
                <ReviewCard key={d.id} item={d} />
              ))}
            </Stack>
          </Stack>
        </Section>
      ))}
      {data.length > shown && (
        <Button variant="secondary" wide onClick={onMore}>
          さらに表示（残り {data.length - shown} 件）
        </Button>
      )}
    </Stack>
  );
}

function ReviewCard({ item: d }: { item: Item }) {
  return (
    <Base as="article" layer={0} radius="m" padding="S" className="card">
      <Stack gap="XXS">
        <Cluster gap="XS" align="center" className="card-meta">
          <Chip color="blue" size="S">
            {SOURCE_LABEL[d.source] || d.source}
          </Chip>
          {d.rating ? (
            <span className="stars" role="img" aria-label={`評価 ${d.rating}`}>
              {stars(d.rating)}
            </span>
          ) : null}
          {d.version ? (
            <Text size="XS" color="TEXT_GREY">
              v{d.version}
            </Text>
          ) : null}
          {d.author ? (
            <Text size="XS" color="TEXT_GREY">
              {d.author}
            </Text>
          ) : null}
          {(d.features || []).map((f) => (
            <Chip key={f} color="grey" size="S">
              {f}
            </Chip>
          ))}
          {/* target=_blank のとき smarthr-ui が外部リンクアイコンと
              「別タブで開く」の読み上げを自動付与する */}
          <TextLink href={d.url} target="_blank" rel="noopener" size="XS">
            開く
          </TextLink>
        </Cluster>
        {d.title ? (
          <Text weight="bold" size="M">
            {d.title}
          </Text>
        ) : null}
        {d.body ? (
          <Text size="M" leading="NORMAL" whiteSpace="pre-wrap">
            {d.body}
          </Text>
        ) : null}
      </Stack>
    </Base>
  );
}
