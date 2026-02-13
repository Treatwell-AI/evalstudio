import { NavLink } from "react-router-dom";

interface SidebarProps {
  projectName: string;
}

export function Sidebar({ projectName }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-project-name">{projectName}</h2>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <span className="sidebar-icon">&#9632;</span>
          Dashboard
        </NavLink>

        <NavLink
          to="/evals"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <span className="sidebar-icon">&#9654;</span>
          Evals
        </NavLink>

        <div className="sidebar-divider" />

        <NavLink
          to="/scenarios"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <span className="sidebar-icon">&#9998;</span>
          Scenarios
        </NavLink>

        <NavLink
          to="/personas"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <span className="sidebar-icon">&#9786;</span>
          Personas
        </NavLink>

        <div className="sidebar-divider" />

        <div className="sidebar-section-title">Settings</div>

        <NavLink
          to="/settings/connectors"
          className={({ isActive }) =>
            `sidebar-link sidebar-link-nested ${isActive ? "active" : ""}`
          }
        >
          Connectors
        </NavLink>

        <NavLink
          to="/settings/llm-providers"
          className={({ isActive }) =>
            `sidebar-link sidebar-link-nested ${isActive ? "active" : ""}`
          }
        >
          LLM Providers
        </NavLink>

        <NavLink
          to="/settings/users"
          className={({ isActive }) =>
            `sidebar-link sidebar-link-nested ${isActive ? "active" : ""}`
          }
        >
          Users
        </NavLink>
      </nav>
    </aside>
  );
}
