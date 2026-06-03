import type { ReactNode } from "react";

export function FeedbackBox({
  kind,
  children,
}: {
  kind: "success" | "error" | "retry";
  children: ReactNode;
}) {
  return <div className={"fb " + kind}>{children}</div>;
}

export function NextButton({ isLast, onClick }: { isLast: boolean; onClick: () => void }) {
  return (
    <button className="next-btn" onClick={onClick}>
      {isLast ? "Завершить →" : "Дальше →"}
    </button>
  );
}
