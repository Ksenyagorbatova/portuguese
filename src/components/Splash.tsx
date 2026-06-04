export function Splash({ text = "Загрузка…" }: { text?: string }) {
  return (
    <div className="m-splash">
      <div className="m-spinner" />
      {text}
    </div>
  );
}
