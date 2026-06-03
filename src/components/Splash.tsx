export function Splash({ text = "Загрузка…" }: { text?: string }) {
  return <div className="center-screen">{text}</div>;
}
