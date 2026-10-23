# CGL+ employee authentication backend

This Cloudflare Worker is the trusted server-side verifier for the CGL+ Accounts **Employee Code** flow. It is not live merely because these source files exist in GitHub. Deploy the Worker and configure its secrets before enabling the frontend.

## Security model

- The public GitHub repository contains no employee codes, hashes, Firebase service-account key, or live employee credentials.
- Employee code hashes are PBKDF2-HMAC-SHA-256 with 310,000 iterations and a unique random salt per employee.
- The Worker signs a Firebase custom token using the service account's private key. The browser then exchanges that token through Firebase Authentication.
- Employee Firebase UIDs are stable and deterministic: `cgl_emp_<username>` (for example, `cgl_emp_nrk`). Do not rename a username after issuing access unless you plan a UID migration.
- The endpoint only accepts configured website origins. Keep the allow-list narrow.
- Configure a Cloudflare Rate Limiting binding named `LOGIN_LIMIT` (recommended: 5 requests per 60 seconds per key). Without this binding, the Worker has no built-in distributed rate limiter.

## Required secrets / variables

In Cloudflare Dashboard → Workers & Pages → your Worker → Settings → Variables and Secrets:

- Secret `FIREBASE_SERVICE_ACCOUNT_EMAIL`: service account email for the Firebase project `cgl-accounts`.
- Secret `FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY`: that service account's PEM private key. Store it only as a Cloudflare secret. Never commit it to GitHub or put it in the browser.
- Secret `EMPLOYEE_RECORDS_JSON`: JSON array of employee records; use the example below as the format. Store hashes, never plaintext codes.
- Variable `ALLOWED_ORIGINS`: comma-separated exact origins, e.g. `https://cgl-create.github.io,https://accounts.crazygamelabs.co.uk`. Add the actual deployed origin; do not include URL paths.

Example shape for the secret `EMPLOYEE_RECORDS_JSON` (the values below are placeholders and will not authenticate):
```json
[
  {
    "employeeId": "nrk#0001",
    "username": "nrk",
    "displayName": "K. Nikshith Reddy",
    "role": "CEO / Founder",
    "active": true,
    "codeSalt": "REPLACE_WITH_32_HEX_CHARACTERS",
    "codeHash": "REPLACE_WITH_64_HEX_CHARACTERS"
  },
  {
    "employeeId": "sra#0002",
    "username": "sra",
    "displayName": "A. Saharsh Reddy",
    "role": "User Employee",
    "active": true,
    "codeSalt": "REPLACE_WITH_32_HEX_CHARACTERS",
    "codeHash": "REPLACE_WITH_64_HEX_CHARACTERS"
  }
]
```

Use unique, high-entropy employee codes for each person. Do not reuse the same short code for multiple employees. The example IDs and hashes are placeholders; generate unique codes and their hashes locally before configuring the secret.

## Generate a code hash

Use Node.js 18 or newer on a trusted computer. Save `hash-code.mjs` from this folder, then run:

```sh
node hash-code.mjs
```

The helper prompts for a code in your local terminal (the terminal may display what you type) and prints a random salt and PBKDF2 hash. Do not paste the code itself into this repository or into chat. Repeat for each employee, then put the resulting salt/hash in the Cloudflare secret.

## Deploy

1. Create a Cloudflare Worker named, for example, `cgl-accounts-employee-auth`.
2. Deploy `index.js` as the Worker entry point (Dashboard editor or Wrangler).
3. Add the secrets and `ALLOWED_ORIGINS` above.
4. Configure a Rate Limiting binding named `LOGIN_LIMIT` in Worker settings (5 requests / 60 seconds is a starting point).
5. Copy the Worker URL. The login endpoint will be `https://YOUR-WORKER.workers.dev/employee-login`.
6. Keep employee sign-in disabled in the website until the endpoint is deployed and tested.

## Firebase service account

In Google Cloud Console for project `cgl-accounts`, create or select a dedicated service account for this narrow authentication service and create a private key only if required by your chosen signing setup. Restrict access to the key and rotate it if exposed. Firebase custom-token signing depends on a valid service-account private key. Do not use a service-account key in frontend JavaScript.

## Firebase and Firestore integration

The browser must call this Worker, receive `customToken`, and pass it to Firebase Auth's `signInWithCustomToken`. The custom token has the employee claims `employee`, `employeeId`, `username`, `displayName`, and `role`. The UID becomes `cgl_emp_nrk` for username `nrk`.

Before allowing CDF access, update its authentication state logic to accept a valid custom-auth employee claim in addition to verified email users. Also update Firestore and Storage rules deliberately: the current CDF example rules assume per-user paths and should be adapted to employee UIDs/claims, then tested in Firebase Rules Playground. Do not grant access based on a client-editable profile field.

## Current status

This folder is source code and setup documentation only. It has not been deployed to Cloudflare and the Employee Code tab has not been connected to it. Do not treat employee login as active until the Worker is deployed, the website integration is committed, and positive/negative login plus CDF authorization tests pass.
