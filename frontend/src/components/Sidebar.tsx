import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : "");
const childClass = ({ isActive }: { isActive: boolean }) => `nav-child ${linkClass({ isActive })}`;
const groupLabelClass = ({ isActive }: { isActive: boolean }) =>
  `nav-group-label ${linkClass({ isActive })}`;

/** A collapsible sidebar section: a group link (its own overview page) with
 * a caret that toggles its children. Starts expanded; purely manual after
 * that — it doesn't force itself back open while you're on one of its
 * routes, so the toggle still does something when that's exactly where
 * you're standing. */
function NavGroup({
  to,
  label,
  children,
}: {
  to: string;
  label: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="nav-group">
      <div className="nav-group-header">
        <NavLink to={to} end className={groupLabelClass}>
          {label}
        </NavLink>
        <button
          type="button"
          className="nav-toggle"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
        >
          {expanded ? "▾" : "▸"}
        </button>
      </div>
      {expanded && children}
    </div>
  );
}

export function Sidebar() {
  return (
    <div className="sidebar">
      <div className="brand">
        <img src="/kpn-logo.svg" alt="KPN" className="brand-logo" />
      </div>
      <nav>
        <NavLink to="/" end className={linkClass}>
          Dashboard
        </NavLink>

        <NavGroup to="/runtime" label="Runtime">
          <NavLink to="/runtime/stackit" className={childClass}>
            Kubernetes
          </NavLink>
          <NavLink to="/runtime/vm" className={childClass}>
            Virtual Machine
          </NavLink>
        </NavGroup>

        <NavGroup to="/database" label="Database">
          <NavLink to="/database/postgresql" className={childClass}>
            PostgreSQL
          </NavLink>
          <NavLink to="/database/redis" className={childClass}>
            Redis
          </NavLink>
          <NavLink to="/database/mariadb" className={childClass}>
            MariaDB
          </NavLink>
          <NavLink to="/database/mongodb" className={childClass}>
            MongoDB
          </NavLink>
        </NavGroup>

        <NavGroup to="/observability" label="Observability">
          <NavLink to="/observability/monitoring" className={childClass}>
            Monitoring
          </NavLink>
          <NavLink to="/observability/logging" className={childClass}>
            Logging
          </NavLink>
        </NavGroup>

        <NavGroup to="/messaging" label="Messaging">
          <NavLink to="/messaging/rabbitmq" className={childClass}>
            RabbitMQ
          </NavLink>
          <NavLink to="/messaging/kafka" className={childClass}>
            Kafka
          </NavLink>
        </NavGroup>

        <NavGroup to="/storage" label="Storage">
          <NavLink to="/storage/volumes" className={childClass}>
            Volumes
          </NavLink>
          <NavLink to="/storage/buckets" className={childClass}>
            Buckets
          </NavLink>
        </NavGroup>

        <NavGroup to="/security" label="Security">
          <NavLink to="/security/vault" className={childClass}>
            Vault
          </NavLink>
        </NavGroup>

        <NavGroup to="/developer" label="Developer">
          <NavLink to="/developer/gitops" className={childClass}>
            GitOps Instance
          </NavLink>
          <NavLink to="/developer/container-registry" className={childClass}>
            Container Registry
          </NavLink>
        </NavGroup>
      </nav>
    </div>
  );
}
