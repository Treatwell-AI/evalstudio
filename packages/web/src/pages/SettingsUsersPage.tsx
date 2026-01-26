export function SettingsUsersPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Users</h1>
        <button className="btn btn-primary">+ Invite User</button>
      </div>

      <div className="empty-state">
        <p>Manage team access to this project. Invite users and assign roles.</p>
      </div>
    </div>
  );
}
