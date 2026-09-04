import { useEffect, useState } from "react";
import { api, RequestError } from "../api";
import type { CredentialSet, Kind } from "../types";

/** The resource kinds whose vendor operator auto-generates end-user
 * credentials this portal can read out — see
 * backend/internal/api/credentials.go for exactly which Secret each one
 * reads. ValkeyCluster and PrometheusInstance have no credentials at all,
 * so they're deliberately not listed here. */
const CREDENTIAL_KINDS: ReadonlySet<Kind> = new Set([
  "postgresclusters",
  "mariadbclusters",
  "rabbitmqclusters",
  "grafanainstances",
]);

export function hasCredentials(kind: Kind): boolean {
  return CREDENTIAL_KINDS.has(kind);
}

/** Reads out the vendor operator's auto-generated credentials Secret for
 * one resource and displays it, with sensitive fields (passwords,
 * connection URIs) masked behind a per-field Show/Hide toggle rather than
 * shown in plaintext by default. */
export function CredentialsPanel({ kind, namespace, name }: { kind: Kind; namespace: string; name: string }) {
  const [sets, setSets] = useState<CredentialSet[] | null>(null);
  const [pending, setPending] = useState(false);
  const [notApplicable, setNotApplicable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    api
      .getCredentials(kind, namespace, name)
      .then((data) => {
        if (cancelled) return;
        setSets(data.sets);
        setPending(data.pending);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof RequestError && e.status === 404) {
          setNotApplicable(true);
          return;
        }
        setError(String(e.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, [kind, namespace, name]);

  function toggle(key: string) {
    setRevealed((s) => {
      const next = new Set(s);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  if (notApplicable) return null;

  return (
    <div className="panel">
      <h3>Credentials</h3>
      {error && <div className="error-banner">{error}</div>}
      {!error && sets === null && <p className="muted">Loading…</p>}
      {!error && sets !== null && pending && (
        <p className="muted">Not available yet — still provisioning.</p>
      )}
      {!error &&
        sets !== null &&
        !pending &&
        sets.map((set) => (
          <div key={set.label} className="credential-set">
            <h4>{set.label}</h4>
            <table>
              <tbody>
                {set.fields.map((f) => {
                  const key = `${set.label}/${f.label}`;
                  const isRevealed = revealed.has(key);
                  return (
                    <tr key={key}>
                      <td className="muted" style={{ width: "1%", whiteSpace: "nowrap" }}>
                        {f.label}
                      </td>
                      <td>
                        {f.sensitive ? (
                          <span className="credential-value">
                            <code>{isRevealed ? f.value : "••••••••••••"}</code>
                            <button type="button" className="btn-link" onClick={() => toggle(key)}>
                              {isRevealed ? "Hide" : "Show"}
                            </button>
                          </span>
                        ) : (
                          <code>{f.value}</code>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
