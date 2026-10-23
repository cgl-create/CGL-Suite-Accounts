# CGL+ CDF — Controlled Downloads & Files

This folder contains the dashboard frontend at `/CDF/`. It is deployed with the existing GitHub Pages workflow.

## Dashboard features
- Verified Firebase sign-in required
- Home greeting: “Hello, <name>”
- Home, Downloads, Settings, Accounts, Sign Out navigation
- Download list populated from Firestore `downloads` documents assigned to the signed-in Firebase UID
- File download via Firebase Storage SDK (not public GitHub file links)

## Important distinction
Do **not** upload private files into this GitHub repository. GitHub Pages and repository files are public to anyone who can access the site/repository. Upload the actual files to Firebase Storage instead. Firebase Storage may require upgrading the Firebase project to the Blaze billing plan; check the Firebase Console before enabling it.

## Add a file for one user

1. Sign in to Firebase Console for project `cgl-accounts`.
2. In Authentication, find the user's Firebase UID.
3. In Firebase Storage, upload the file under `CDF/USER_UID/filename.ext`, replacing `USER_UID` with that user's exact UID.
4. In Firestore, create a document in collection `downloads`. The document ID can be a short identifier, for example `welcome-pack-nrk`.
5. Add fields like these:

```json
{
  "title": "Welcome Pack",
  "description": "Documents assigned to your account",
  "fileName": "welcome-pack.pdf",
  "filePath": "CDF/USER_UID/welcome-pack.pdf",
  "assignedTo": ["USER_UID"],
  "active": true
}
```

Replace both instances of `USER_UID` with the real Firebase Authentication UID. For multiple users, create a per-user Storage copy and a matching download document for each user. The dashboard queries documents whose `assignedTo` array contains the signed-in user's UID. `filePath` must begin with `CDF/`.

## Security rules (merge with your existing rules; do not blindly replace them)

Firestore rules for the `downloads` collection should permit a signed-in user to read only records assigned to their UID, while preventing client-side writes:

```
match /downloads/{downloadId} {
  allow read: if request.auth != null
    && request.auth.uid in resource.data.assignedTo;
  allow write: if false;
}
```

For Firebase Storage, the per-user path above supports a simple isolation rule:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /CDF/{uid}/{fileName=**} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }
  }
}
```

These are examples to integrate with your current rules. Existing `users/{uid}` rules for profile creation/updates must remain intact. Upload files and create assignment documents from the Firebase Console (trusted admin action), not from this public dashboard. Test rules with Firebase Rules Playground before assigning real documents.

## Current limitations
- The dashboard is a frontend; it does not yet include an admin upload/assignment screen.
- It will show an empty list until matching `downloads` documents and Storage files exist.
- Email/Google sign-in must be configured in Firebase Auth, and `cgl-create.github.io` must be an authorized domain. The dashboard only accepts users whose Firebase email is verified.
