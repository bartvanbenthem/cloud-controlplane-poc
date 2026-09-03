export function Placeholder({
  title,
  tagline,
  body,
}: {
  title: string;
  tagline: string;
  body: string;
}) {
  return (
    <>
      <div className="page-header">
        <h2>{title}</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        {tagline}
      </p>
      <div className="panel">
        <p className="empty-state">{body}</p>
      </div>
    </>
  );
}
