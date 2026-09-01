import { NavLink } from "react-router-dom";

export function Sidebar() {
  return (
    <div className="sidebar">
      <div className="brand">
        <img src="/kpn-logo.svg" alt="KPN" className="brand-logo" />
      </div>
      <nav>
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Dashboard
        </NavLink>
        <NavLink to="/servers" className={({ isActive }) => (isActive ? "active" : "")}>
          Servers
        </NavLink>
        <NavLink to="/clusters" className={({ isActive }) => (isActive ? "active" : "")}>
          SKE Clusters
        </NavLink>
      </nav>
    </div>
  );
}
