# SSO Setup

Single sign-on (SSO) via SAML 2.0 is available on the Business and Enterprise plans. This guide covers the generic SAML configuration, an Okta-specific example, and common certificate troubleshooting.

## Prerequisites

- An identity provider (IdP) that supports SAML 2.0: Okta, Azure AD, Google Workspace, OneLogin, JumpCloud, or any custom IdP.
- A workspace admin role in Acme.
- A verified custom email domain — go to **Settings → Workspace → Domains** to verify yours.

## Generic SAML configuration

In Acme, navigate to **Settings → Workspace → SSO** and click **Configure SAML**. Acme will display the Service Provider (SP) metadata you need:

- **ACS URL:** `https://app.acme.example/sso/saml/acs`
- **Entity ID:** `https://app.acme.example/sso/saml/metadata`
- **NameID format:** `EmailAddress`

In your IdP, create a new SAML application and paste those values. Then copy the IdP's metadata URL or upload the IdP signing certificate back into Acme. Click **Test SSO** to verify a round-trip login before enforcing.

## Okta example

1. In the Okta admin console, go to **Applications → Create App Integration → SAML 2.0**.
2. Set the **Single sign-on URL** to `https://app.acme.example/sso/saml/acs`.
3. Set the **Audience URI** to `https://app.acme.example/sso/saml/metadata`.
4. Set Name ID format to **EmailAddress**.
5. Add a group attribute statement named `groups` if you want Acme to map Okta groups to Acme roles.
6. Assign the application to the users or groups who need access.
7. Copy the Okta **Identity Provider metadata** URL into Acme.

## Troubleshooting certificate errors

The most common SSO error is `INVALID_SIGNATURE`, which means Acme could not verify the SAML response with the certificate we have on file.

- Check that the IdP signing certificate has not expired. Most IdPs auto-rotate certificates yearly.
- Re-upload the IdP metadata XML or the latest signing certificate under **Settings → Workspace → SSO → Certificate**.
- Confirm your IdP signs the SAML *response*, not just the assertion. Acme requires both.
- If multiple certificates are present, ensure the active one is the first in the metadata file.

For persistent issues, share your Acme workspace ID and the SAML response (from the browser network tab) with support@acme.example.
