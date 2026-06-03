import type { BadgeTag } from "../lib/types";

export function Badge({ tag }: { tag: BadgeTag }) {
  if (tag === "due") return <span className="badge b-due">🔴 повторить</span>;
  if (tag === "new") return <span className="badge b-new">✨ новое</span>;
  if (tag === "cross") return <span className="badge b-cross">🔗 сочетание</span>;
  return <span className="badge b-rev">🔄 повторение</span>;
}
