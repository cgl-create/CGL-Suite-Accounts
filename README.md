# CGL+ Accounts

Static CGL+ account portal powered by Firebase Authentication and Cloud Firestore.

## Hosting

GitHub Actions deploys the repository root to GitHub Pages when changes are pushed to `main`.

The site uses the existing Firebase project `cgl-accounts`; GitHub Pages only hosts the static frontend and does not replace Firebase Authentication or Firestore.

## Before using a custom domain

1. Enable GitHub Pages for this repository with **GitHub Actions** as the build/deployment source.
2. Test the generated `https://cgl-create.github.io/CGL-Suite-Accounts/` URL.
3. In Firebase Console → Authentication → Settings → Authorized domains, make sure `accounts.crazygamelabs.co.uk` is authorized.
4. Add the custom domain in the repository's Pages settings, then configure only the `accounts` DNS record in IONOS according to the values GitHub Pages displays. Do not change the root domain, mail records, nameservers, or other subdomains.
5. Wait for GitHub to provision HTTPS and verify sign-in, account creation, email verification, password reset, Google sign-in, and Firestore profile writes.

The Firebase web configuration embedded in `index.html` is client-side configuration, not a service-account private key. Never commit service-account keys or other server credentials.


## Employee roster

Edit `employees.json` to add, rename, deactivate, or change the role of an employee. Keep the fields and JSON syntax valid; use `"active": false` to mark an account inactive.

**Security note:** GitHub Pages serves this file publicly, so it must contain roster details only—not employee codes, passwords, or authentication hashes. The Employee Code tab is still a UI placeholder; it does not authenticate employees yet. Real employee sign-in requires a trusted server-side verifier and must not validate codes in browser JavaScript.


## CGL+ CDF dashboard

The user dashboard frontend is in [`CDF/`](CDF/), with Home, Downloads, Settings, Accounts, and Sign Out navigation. After GitHub Pages deployment, the dashboard path will be `https://cgl-create.github.io/CGL-Suite-Accounts/CDF/`.

Private downloads must be stored in Firebase Storage—not committed to this repository. See [CDF setup instructions](CDF/README.md) for assigning files through Firestore and the required security-rule examples. The dashboard is a frontend and does not include an administrator upload screen yet.
