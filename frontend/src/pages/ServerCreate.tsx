import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { ServerCreateRequest } from "../types";

const initial: ServerCreateRequest = {
  name: "",
  namespace: "default",
  projectId: "",
  region: "eu01",
  machineType: "c1.2",
  availabilityZone: "",
  powerState: "Active",
  imageId: "",
  bootVolumeSize: 32,
  bootVolumePerformanceClass: "",
  deleteBootVolumeOnTermination: true,
  networkId: "",
  keypairName: "",
  securityGroups: [],
  userData: "",
  environment: "dev",
  team: "",
};

export function ServerCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ServerCreateRequest>(initial);
  const [securityGroupsText, setSecurityGroupsText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ServerCreateRequest>(key: K, value: ServerCreateRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: ServerCreateRequest = {
        ...form,
        securityGroups: securityGroupsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const created = await api.createServer(payload);
      navigate(`/stackit/servers/${created.metadata.namespace}/${created.metadata.name}`);
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>New Server</h2>
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
              <p className="hint">Lowercase alphanumeric and hyphens only.</p>
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
          <legend>Compute</legend>
          <div className="form-grid">
            <div className="field">
              <label>Machine type</label>
              <input
                type="text"
                value={form.machineType}
                onChange={(e) => set("machineType", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Availability zone</label>
              <input
                type="text"
                placeholder="e.g. eu01-1 — leave empty to let STACKIT choose"
                value={form.availabilityZone}
                onChange={(e) => set("availabilityZone", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Power state</label>
              <select value={form.powerState} onChange={(e) => set("powerState", e.target.value as "Active" | "Inactive")}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Image and boot volume</legend>
          <div className="form-grid">
            <div className="field">
              <label>Image ID</label>
              <input
                type="text"
                required
                placeholder="00000000-0000-0000-0000-000000000000"
                value={form.imageId}
                onChange={(e) => set("imageId", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Boot volume size (GB)</label>
              <input
                type="number"
                min={1}
                value={form.bootVolumeSize}
                onChange={(e) => set("bootVolumeSize", Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Boot volume performance class</label>
              <input
                type="text"
                placeholder="e.g. storage_premium_perf1"
                value={form.bootVolumePerformanceClass}
                onChange={(e) => set("bootVolumePerformanceClass", e.target.value)}
              />
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.deleteBootVolumeOnTermination}
                  onChange={(e) => set("deleteBootVolumeOnTermination", e.target.checked)}
                />
                Delete boot volume on server termination
              </label>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Networking and access</legend>
          <div className="form-grid">
            <div className="field">
              <label>Network ID</label>
              <input
                type="text"
                required
                placeholder="00000000-0000-0000-0000-000000000000"
                value={form.networkId}
                onChange={(e) => set("networkId", e.target.value)}
              />
            </div>
            <div className="field">
              <label>SSH keypair name</label>
              <input
                type="text"
                value={form.keypairName}
                onChange={(e) => set("keypairName", e.target.value)}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Security group IDs (comma-separated)</label>
              <input
                type="text"
                value={securityGroupsText}
                onChange={(e) => setSecurityGroupsText(e.target.value)}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Cloud-init user data</label>
              <textarea
                rows={6}
                value={form.userData}
                onChange={(e) => set("userData", e.target.value)}
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
            {submitting ? "Creating…" : "Create Server"}
          </button>
        </div>
      </form>
    </>
  );
}
