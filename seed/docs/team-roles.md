# Team Roles and Permissions

Acme has three workspace-level roles: **Admin**, **Member**, and **Viewer**. Roles are assigned per workspace, not per project. Project-specific overrides are possible on the Business and Enterprise plans.

## Admin

Admins can do everything in the workspace, including:

- Invite, remove, and change the role of any user.
- Manage billing, plan tier, and payment methods.
- Configure SSO, SCIM, and audit log retention.
- Create, archive, and delete any project.
- Install and remove third-party integrations.
- Trigger workspace and audit log exports.

Every workspace must have at least one admin. The last remaining admin cannot be removed or downgraded — promote another user to admin first.

## Member

Members are the default role for invited collaborators. They can:

- Create new projects and become the project owner.
- View, edit, comment on, and delete items inside projects they have access to.
- Invite Viewers to projects they own.
- Use any installed integration in their projects.

Members cannot change billing, install integrations workspace-wide, or manage other members' roles.

## Viewer

Viewers have read-only access. They can:

- View projects, items, and comments shared with them.
- Receive notifications and digests.
- Export data they can already see.

Viewers cannot create, edit, or delete anything. Viewer seats are billed at 25% of a Member seat on Business and Enterprise plans, and are free on the Free and Starter plans.

## Project-level overrides

On Business and Enterprise plans, project owners can grant elevated permissions to a Viewer or Member on a per-project basis without changing their workspace role. For example, a Viewer can be promoted to **Project editor** on a single project. Workspace Admins always retain Admin permissions on every project, regardless of overrides.

## Changing roles

Admins change roles under **Settings → Workspace → Members**. Click the role dropdown next to a user, choose the new role, and confirm. The user is notified by email and their session permissions update on the next request.

If you use SCIM provisioning from your IdP, role changes flow from your IdP groups to Acme automatically; manual role changes in Acme will be overwritten on the next sync.
