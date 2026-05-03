# Troubleshooting

This page lists the most common errors users encounter in Acme, what they mean, and how to recover. If your issue is not covered here, contact support@acme.example with your workspace ID and a description of what you were doing.

## "Session expired — please log in again"

Sessions last 30 days of inactivity, or until you explicitly log out. If you see this message during normal use, the most likely cause is a clock skew on your device or a third-party cookie blocker. Re-log in; if the message returns immediately, try a different browser or incognito mode to rule out an extension.

## "We could not reach the Acme servers"

A red banner with this message means the client could not contact our API. Check:

- Your network connection — try opening another site.
- Acme's status page at status.acme.example for active incidents.
- Any corporate proxy or VPN that might block `app.acme.example` or `api.acme.example`.

If status.acme.example shows everything green and you are still affected, send a HAR file to support so we can trace the request.

## "You do not have permission to do this"

Permission errors mean your role does not allow the action. Common cases:

- Members cannot change billing — ask an Admin.
- Viewers cannot edit items — request an upgrade or per-project edit access.
- SCIM-provisioned roles cannot be changed in Acme; change the user's group in your IdP.

See the **Team Roles and Permissions** page for the full role matrix.

## "Item could not be saved — version conflict"

Two people edited the same item at the same time. Acme uses optimistic concurrency to avoid silent overwrites. Refresh the item to see the other person's edits, then re-apply your changes. Real-time co-editing is on the roadmap but not available today.

## API returns "401 Unauthorized" even though the token works in the test console

The most common cause is a missing or wrong `Authorization` header. The format must be `Authorization: Bearer <token>`. Tokens are workspace-scoped — using a token from one workspace against another workspace's resources also returns 401.

If the token recently rotated, generate a new one from **Settings → Workspace → API tokens** and update your client.

## Contacting support

Email support@acme.example. Include your workspace ID (visible at the bottom of any Settings page), the exact error message, and a screenshot or HAR file if possible. Business and Enterprise plans have priority queues; Free and Starter use a community forum at community.acme.example.
