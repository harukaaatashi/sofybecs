import { useEffect, useRef, useState } from "react";
import { Button } from "smarthr-ui";

type State = "idle" | "done" | "error";

type Props = {
  /** クリック時に組み立てる。全件書き出しを毎レンダー走らせないため関数で受ける */
  getText: () => string;
  label: string;
  /** 読み上げ用。ラベルだけでは何件対象か分からないときに補う */
  ariaLabel?: string;
  variant: "text" | "secondary";
  className?: string;
};

/** Markdown をクリップボードへ。結果はラベルと aria-live の両方で返す（DESIGN.md §3） */
export function CopyButton({ getText, label, ariaLabel, variant, className }: Props) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<number | undefined>(undefined);

  // 結果表示を戻すタイマーが、アンマウント後に走らないようにする
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setState("done");
    } catch {
      setState("error");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  };

  const text =
    state === "done" ? "コピーしました" : state === "error" ? "コピーできませんでした" : label;

  return (
    <>
      <Button variant={variant} size="S" className={className} onClick={copy} aria-label={ariaLabel}>
        {text}
      </Button>
      {/* ボタンのラベル変化だけでは読み上げられないので、別途通知する */}
      <span role="status" aria-live="polite" className="visually-hidden">
        {state === "done" ? "コピーしました" : state === "error" ? "コピーできませんでした" : ""}
      </span>
    </>
  );
}
