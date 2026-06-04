import type { BadgeTag } from "../lib/types";

// Status badge: a dot-pill (no 🔴 emoji). The four review states map to the
// status tokens (due / new / rev / cross).
const TAG = {
  due: { cls: "due", label: "повторить" },
  new: { cls: "new", label: "новое" },
  review: { cls: "rev", label: "повторение" },
  cross: { cls: "cross", label: "сочетание" },
} as const;

export function Badge({ tag }: { tag: BadgeTag }) {
  const t = TAG[tag];
  return (
    <span className={"m-badge " + t.cls}>
      <span className={"m-dot " + t.cls} />
      {t.label}
    </span>
  );
}
