import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : "");
const childClass = ({ isActive }: { isActive: boolean }) => `nav-child ${linkClass({ isActive })}`;
const groupLabelClass = ({ isActive }: { isActive: boolean }) =>
  `nav-group-label ${linkClass({ isActive })}`;

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

        <div className="nav-group">
          <NavLink to="/runtime" end className={groupLabelClass}>
            Runtime
          </NavLink>
          <NavLink to="/runtime/stackit" className={childClass}>
            SKE
          </NavLink>
          <NavLink to="/runtime/openshift" className={childClass}>
            OCP
          </NavLink>
          <NavLink to="/runtime/vmware" className={childClass}>
            VKS
          </NavLink>
        </div>

        <div className="nav-group">
          <NavLink to="/paas" end className={groupLabelClass}>
            PaaS
          </NavLink>
          <NavLink to="/paas/postgresql" className={childClass}>
            PostgreSQL
          </NavLink>
          <NavLink to="/paas/redis" className={childClass}>
            Redis
          </NavLink>
          <NavLink to="/paas/monitoring" className={childClass}>
            Monitoring
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
