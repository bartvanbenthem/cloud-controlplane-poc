import { useEffect, useState } from "react";
import { api } from "../api";
import type { CustomResource } from "../types";
import { ResourceList } from "./ResourceList";

const POLL_INTERVAL_MS = 5000;

function summarizeLoki(r: CustomResource): string {
  const spec = r.spec as { size?: string; storageClassName?: string };
  return [spec.size, spec.storageClassName && `sc ${spec.storageClassName}`].filter(Boolean).join(" · ");
}

/** Wraps ResourceList for LokiInstances with a "Collectors" column counting
 * each instance's AlloyInstances. Loki and Alloy are many-to-one (unlike
 * Grafana/Prometheus' strict 1:1 pairing merged into one row in
 * MonitoringList), so they stay separate lists here — this just surfaces
 * the relationship as a count per row; see LogCollectorsPanel for the
 * matching list on a LokiInstance's own detail page. */
export function LoggingList() {
  const [collectorCounts, setCollectorCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api
        .list("alloyinstances")
        .then((alloys) => {
          if (cancelled) return;
          const counts = new Map<string, number>();
          for (const a of alloys) {
            const ref = (a.spec as { lokiInstanceRef?: string }).lokiInstanceRef;
            if (!ref) continue;
            const key = `${a.metadata.namespace}/${ref}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
          setCollectorCounts(counts);
        })
        .catch(() => !cancelled && setCollectorCounts(new Map()));

    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <ResourceList
      kind="lokiinstances"
      title="Logging"
      description="Log aggregation and storage backed by the Loki Operator, via project-easter's LokiInstance, pair it with a Log Collector to collect a namespace's pod logs and query them from Grafana."
      basePath="/observability/logging"
      createPath="/observability/logging/new"
      itemLabel="Logging Instance"
      summarize={summarizeLoki}
      extraColumns={[
        {
          header: "Collectors",
          render: (r) => collectorCounts.get(`${r.metadata.namespace}/${r.metadata.name}`) ?? 0,
        },
      ]}
    />
  );
}
