export type ServiceLifecycle = "preview" | "ga" | "roadmap";

const COPY: Record<ServiceLifecycle, { label: string; title: string }> = {
  preview: {
    label: "Preview",
    title: "Preview — still evolving. APIs, defaults, and behavior may change without notice.",
  },
  ga: {
    label: "GA",
    title: "Generally available — stable and supported for production use.",
  },
  roadmap: {
    label: "Roadmap",
    title: "Roadmap — not integrated yet. No operator/CRD wired up.",
  },
};

/** Signals a service's release stage on its overview page. */
export function LifecycleBadge({ status }: { status: ServiceLifecycle }) {
  const { label, title } = COPY[status];
  return (
    <span className={`lifecycle-badge lifecycle-${status}`} title={title}>
      <span className="dot" />
      {label}
    </span>
  );
}
