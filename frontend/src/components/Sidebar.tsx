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
            SKE
          </NavLink>
          <NavLink to="/runtime/openshift" className={childClass}>
            OCP
          </NavLink>
          <NavLink to="/runtime/vmware" className={childClass}>
            VKS
          </NavLink>
          <NavLink to="/runtime/aks" className={childClass}>
            AKS
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
        </NavGroup>

        <NavGroup to="/observability" label="Observability">
          <NavLink to="/observability/monitoring" className={childClass}>
            Monitoring
          </NavLink>
        </NavGroup>

        <NavGroup to="/messaging" label="Messaging">
          <NavLink to="/messaging/rabbitmq" className={childClass}>
            RabbitMQ
          </NavLink>
        </NavGroup>

        <div className="nav-group">
          <NavLink to="/network" end className={groupLabelClass}>
            Network
          </NavLink>
        </div>

        <div className="nav-group">
          <NavLink to="/security" end className={groupLabelClass}>
            Security
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
