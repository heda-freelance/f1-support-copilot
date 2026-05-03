# Data Export

Acme supports self-serve data export in CSV and JSON formats. This page covers the export workflow, file retention, and how exports relate to GDPR data subject requests.

## How to export

Workspace admins can trigger an export from **Settings → Workspace → Data export**. Choose the data scope:

- **Workspace export** — every record in your workspace (projects, items, comments, attachments metadata).
- **Project export** — a single project, including its items and history.
- **Audit log export** — admin and security events for the date range you choose.

Pick the format (CSV or JSON) and click **Start export**. Exports run asynchronously. You will receive an email and an in-app notification when the export is ready, usually within a few minutes for small workspaces and up to a few hours for very large ones.

## File format

CSV exports produce one zip archive per scope, with one CSV file per data type (`projects.csv`, `items.csv`, `comments.csv`, etc.). All timestamps are ISO 8601 in UTC. IDs are the same opaque strings used in the API.

JSON exports produce a single line-delimited JSON (NDJSON) file per data type, suitable for streaming into a data warehouse.

Attachment files (uploaded images, PDFs, etc.) are referenced by URL in the export, not embedded. The download URLs are signed and valid for 30 days from the time of export.

## Retention

Export files are stored for **30 days** in a private S3 bucket and then deleted automatically. You can re-trigger an export at any time. There is no hard limit on the number of exports you can run, but consecutive exports of the same scope within 60 seconds are queued.

## GDPR and data subject requests

Acme acts as the data processor for content you upload. As the data controller, you are responsible for fulfilling data subject access requests (DSAR) from your end users.

To honour a DSAR or right-to-erasure request, use the workspace export to gather the user's data, then use the API or UI to delete it. Acme maintains a signed Data Processing Addendum (DPA) under the **Settings → Workspace → Legal** tab; contact legal@acme.example for a counter-signed copy.

If you require a one-time export tied to a DSAR, support can prepare it on Enterprise plans within 5 business days.
