import { LifecycleBadge, type ServiceLifecycle } from "../components/LifecycleBadge";

export function Placeholder({
  title,
  tagline,
  body,
  lifecycle = "roadmap",
}: {
  title: string;
  tagline: string;
  body: string;
  lifecycle?: ServiceLifecycle;
}) {
  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h2>{title}</h2>
          <LifecycleBadge status={lifecycle} />
        </div>
      </div>
      <p className="page-description">{tagline}</p>
      <div className="panel">
        <p className="empty-state">{body}</p>
      </div>
    </>
  );
}
