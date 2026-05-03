# Slack Integration

The Acme Slack integration delivers notifications to channels and lets users run quick commands without leaving Slack. This page covers installation, channel routing, and removing the integration.

## Install

Workspace admins can install the Slack integration in two clicks:

1. Go to **Settings → Workspace → Integrations**.
2. Find **Slack** and click **Install**.
3. You will be redirected to Slack to authorize Acme. You need permission to install apps in your Slack workspace; if your Slack admin restricts app installs, request approval from them first.
4. Pick a default channel for workspace-wide notifications and click **Allow**.

After installation, the Acme bot user appears in the chosen Slack workspace and posts a welcome message in the default channel.

## Channel routing

By default, all notifications are posted in the channel you selected during install. To route different event types to different channels:

1. Open **Settings → Workspace → Integrations → Slack → Channel routing**.
2. For each event type (item created, item completed, comment posted, project archived, etc.) select the target channel.
3. Save.

You can add Acme to a private channel by inviting the **@acme** bot user from inside Slack: `/invite @acme`. Acme cannot post to channels it has not been invited to.

## Slash commands

The Slack app supports a handful of slash commands that work in any channel where Acme is installed:

- `/acme search <query>` — searches your workspace and returns the top three matches inline.
- `/acme create <title>` — creates a new item in the default project for the channel.
- `/acme assign @user <item URL>` — assigns an item to a Slack user (must be linked to an Acme user).

Mentions of the `@acme` bot in any channel are treated as natural-language questions and answered by the support copilot when enabled.

## Per-user link

Each Slack user must link their Slack identity to their Acme account once before commands work for them. The link prompt appears the first time they use any command. Without linking, slash commands return a friendly error.

## Removing the integration

Admins can uninstall under **Settings → Workspace → Integrations → Slack → Uninstall**. This revokes the Slack token, removes the bot from all channels Acme posted in, and deletes channel-routing config. Items and comments created via Slack are preserved in Acme.

You can also remove the app from the Slack side via **Settings → Manage Apps → Acme → Remove app**, which has the same effect.
