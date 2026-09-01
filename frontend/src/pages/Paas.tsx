export function Paas() {
  return (
    <>
      <div className="page-header">
        <h2>PaaS</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        KPN PaaS building blocks, managed by their own operators.
      </p>

      <div className="panel">
        <p className="empty-state">
          No PaaS building blocks are wired up yet. Once a building block's
          operator and CRDs are chosen, its resource type gets a page here
          alongside STACKIT — same pattern, different API group.
        </p>
      </div>
    </>
  );
}
