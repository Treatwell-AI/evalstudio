import { NavLink } from "react-router-dom";

interface SidebarProps {
  projectId: string;
  projectName: string;
}

export function Sidebar({ projectId, projectName }: SidebarProps) {
  const baseUrl = `/project/${projectId}`;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <NavLink to="/" className="sidebar-back">
          &larr; Projects
        </NavLink>
        <h2 className="sidebar-project-name">{projectName}</h2>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to={baseUrl}
          end
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <span className="sidebar-icon">&#9632;</span>
          Dashboard
        </NavLink>

        <NavLink
          to={`${baseUrl}/evals`}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <span className="sidebar-icon">&#9654;</span>
          Evals
        </NavLink>

        <div className="sidebar-divider" />

        <NavLink
          to={`${baseUrl}/scenarios`}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <span className="sidebar-icon">&#9998;</span>
          Scenarios
        </NavLink>

        <NavLink
          to={`${baseUrl}/personas`}
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
          to={`${baseUrl}/settings/connectors`}
          className={({ isActive }) =>
            `sidebar-link sidebar-link-nested ${isActive ? "active" : ""}`
          }
        >
          Connectors
        </NavLink>

        <NavLink
          to={`${baseUrl}/settings/llm-providers`}
          className={({ isActive }) =>
            `sidebar-link sidebar-link-nested ${isActive ? "active" : ""}`
          }
        >
          LLM Providers
        </NavLink>

        <NavLink
          to={`${baseUrl}/settings/users`}
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
