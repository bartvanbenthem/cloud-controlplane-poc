import { Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { ResourceList } from "./pages/ResourceList";
import { ResourceDetail } from "./pages/ResourceDetail";
import { ServerCreate } from "./pages/ServerCreate";
import { ClusterCreate } from "./pages/ClusterCreate";

export default function App() {
  return (
    <div className="layout">
      <Sidebar />
      <div className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />

          <Route
            path="/servers"
            element={<ResourceList kind="servers" title="Servers" createPath="/servers/new" />}
          />
          <Route path="/servers/new" element={<ServerCreate />} />
          <Route
            path="/servers/:namespace/:name"
            element={<ResourceDetail kind="servers" listPath="/servers" />}
          />

          <Route
            path="/clusters"
            element={<ResourceList kind="clusters" title="SKE Clusters" createPath="/clusters/new" />}
          />
          <Route path="/clusters/new" element={<ClusterCreate />} />
          <Route
            path="/clusters/:namespace/:name"
            element={<ResourceDetail kind="clusters" listPath="/clusters" />}
          />
        </Routes>
      </div>
    </div>
  );
}
