export type ServiceLifecycle = "experimental" | "preview" | "ga" | "roadmap";

const COPY: Record<ServiceLifecycle, { label: string; title: string }> = {
  experimental: {
    label: "Experimental",
    title: "Experimental, use at your own risk. Not supported for production use and may change or be removed without notice.",
  },
  preview: {
    label: "Preview",
    title: "Preview, still evolving. APIs, defaults, and behavior may change without notice.",
  },
  ga: {
    label: "GA",
    title: "Generally available, stable and supported for production use.",
  },
  roadmap: {
    label: "Roadmap",
    title: "Roadmap, not integrated yet. No operator/CRD wired up.",
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
