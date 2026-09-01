import { Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { StackitHome } from "./pages/StackitHome";
import { Paas } from "./pages/Paas";
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

          <Route path="/stackit" element={<StackitHome />} />

          <Route
            path="/stackit/servers"
            element={
              <ResourceList
                kind="servers"
                title="Servers"
                basePath="/stackit/servers"
                createPath="/stackit/servers/new"
              />
            }
          />
          <Route path="/stackit/servers/new" element={<ServerCreate />} />
          <Route
            path="/stackit/servers/:namespace/:name"
            element={<ResourceDetail kind="servers" listPath="/stackit/servers" />}
          />

          <Route
            path="/stackit/clusters"
            element={
              <ResourceList
                kind="clusters"
                title="Clusters"
                basePath="/stackit/clusters"
                createPath="/stackit/clusters/new"
              />
            }
          />
          <Route path="/stackit/clusters/new" element={<ClusterCreate />} />
          <Route
            path="/stackit/clusters/:namespace/:name"
            element={<ResourceDetail kind="clusters" listPath="/stackit/clusters" />}
          />

          <Route path="/paas" element={<Paas />} />
        </Routes>
      </div>
    </div>
  );
}
