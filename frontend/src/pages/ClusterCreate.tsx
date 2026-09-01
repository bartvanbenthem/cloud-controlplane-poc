import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { ClusterCreateRequest } from "../types";

const initial: ClusterCreateRequest = {
  name: "",
  namespace: "default",
  projectId: "",
  region: "eu01",
  kubernetesVersion: "1.31.1",
  poolName: "pool-1",
  poolMachineType: "c2i.2",
  poolMachineImageName: "flatcar",
  poolMachineImageVersion: "4593.2.2",
  poolAvailabilityZones: ["eu01-1"],
  poolMinimum: 1,
  poolMaximum: 3,
  poolVolumeSize: 32,
  autoUpdateKubernetesVersion: true,
  autoUpdateMachineImageVersion: true,
  maintenanceStart: "2024-01-01T02:00:00Z",
  maintenanceEnd: "2024-01-01T04:00:00Z",
  environment: "dev",
  team: "",
};

export function ClusterCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ClusterCreateRequest>(initial);
  const [azsText, setAzsText] = useState(initial.poolAvailabilityZones.join(", "));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ClusterCreateRequest>(key: K, value: ClusterCreateRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: ClusterCreateRequest = {
        ...form,
        poolAvailabilityZones: azsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const created = await api.createCluster(payload);
      navigate(`/stackit/clusters/${created.metadata.namespace}/${created.metadata.name}`);
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>New SKE Cluster</h2>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>Identity</legend>
          <div className="form-grid">
            <div className="field">
              <label>Name</label>
              <input
                type="text"
                required
                pattern="^[a-z0-9]([-a-z0-9]*[a-z0-9])?$"
                maxLength={63}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                autoFocus
              />
              <p className="hint">SKE's only identifier for the cluster; cannot be changed after creation.</p>
            </div>
            <div className="field">
              <label>Namespace</label>
              <input
                type="text"
                value={form.namespace}
                onChange={(e) => set("namespace", e.target.value)}
              />
            </div>
            <div className="field">
              <label>STACKIT project ID</label>
              <input
                type="text"
                required
                placeholder="00000000-0000-0000-0000-000000000000"
                value={form.projectId}
                onChange={(e) => set("projectId", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Region</label>
              <input type="text" value={form.region} onChange={(e) => set("region", e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Kubernetes version</legend>
          <div className="field">
            <label>Version</label>
            <input
              type="text"
              required
              pattern="^\d+\.\d+\.\d+$"
              value={form.kubernetesVersion}
              onChange={(e) => set("kubernetesVersion", e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset>
          <legend>Default node pool</legend>
          <div className="form-grid">
            <div className="field">
              <label>Pool name</label>
              <input
                type="text"
                required
                maxLength={15}
                value={form.poolName}
                onChange={(e) => set("poolName", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Machine type</label>
              <input
                type="text"
                value={form.poolMachineType}
                onChange={(e) => set("poolMachineType", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Machine image</label>
              <input
                type="text"
                value={form.poolMachineImageName}
                onChange={(e) => set("poolMachineImageName", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Machine image version</label>
              <input
                type="text"
                value={form.poolMachineImageVersion}
                onChange={(e) => set("poolMachineImageVersion", e.target.value)}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Availability zones (comma-separated)</label>
              <input type="text" value={azsText} onChange={(e) => setAzsText(e.target.value)} />
            </div>
            <div className="field">
              <label>Minimum nodes</label>
              <input
                type="number"
                min={0}
                value={form.poolMinimum}
                onChange={(e) => set("poolMinimum", Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Maximum nodes</label>
              <input
                type="number"
                min={1}
                value={form.poolMaximum}
                onChange={(e) => set("poolMaximum", Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Node volume size (GB)</label>
              <input
                type="number"
                min={1}
                value={form.poolVolumeSize}
                onChange={(e) => set("poolVolumeSize", Number(e.target.value))}
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Maintenance window</legend>
          <div className="form-grid">
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.autoUpdateKubernetesVersion}
                  onChange={(e) => set("autoUpdateKubernetesVersion", e.target.checked)}
                />
                Auto-update Kubernetes patch version
              </label>
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.autoUpdateMachineImageVersion}
                  onChange={(e) => set("autoUpdateMachineImageVersion", e.target.checked)}
                />
                Auto-update machine image version
              </label>
            </div>
            <div className="field">
              <label>Maintenance window start (RFC3339)</label>
              <input
                type="text"
                value={form.maintenanceStart}
                onChange={(e) => set("maintenanceStart", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Maintenance window end (RFC3339)</label>
              <input
                type="text"
                value={form.maintenanceEnd}
                onChange={(e) => set("maintenanceEnd", e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Labels</legend>
          <div className="form-grid">
            <div className="field">
              <label>Environment</label>
              <select value={form.environment} onChange={(e) => set("environment", e.target.value as "dev" | "staging" | "prod")}>
                <option value="dev">dev</option>
                <option value="staging">staging</option>
                <option value="prod">prod</option>
              </select>
            </div>
            <div className="field">
              <label>Team</label>
              <input type="text" value={form.team} onChange={(e) => set("team", e.target.value)} />
            </div>
          </div>
        </fieldset>

        <div className="actions-row">
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create Cluster"}
          </button>
        </div>
      </form>
    </>
  );
}
