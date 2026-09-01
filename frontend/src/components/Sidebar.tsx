import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : "");

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
          <NavLink to="/stackit" end className={({ isActive }) => `nav-group-label ${linkClass({ isActive })}`}>
            STACKIT
          </NavLink>
          <NavLink to="/stackit/servers" className={({ isActive }) => `nav-child ${linkClass({ isActive })}`}>
            Servers
          </NavLink>
          <NavLink to="/stackit/clusters" className={({ isActive }) => `nav-child ${linkClass({ isActive })}`}>
            Clusters
          </NavLink>
        </div>

        <div className="nav-group">
          <NavLink to="/paas" end className={({ isActive }) => `nav-group-label ${linkClass({ isActive })}`}>
            PaaS
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
