# Education

A personal university planner for desktop and iPhone, with an English interface,
local storage, optional Supabase account sync, and a Home Screen web-app shell.
This is an independent application, not an Apple product.

## Current release status

This archive is source code prepared for deployment, not an already published site.
No GitHub commits, Vercel deployments, Supabase projects, users, or database changes
were made when producing it. It contains no real API keys or passwords.

Release 1.0.1 includes the previously supplied Education interface and course
templates, a reproducible build, PWA icons/manifest, a service worker, and the SQL
migration. The build separates JavaScript from HTML for a restrictive script CSP.

Twenty local Node tests passed: grading/date logic, build safety checks, and
simulated service-worker behavior. Static asset references and JavaScript syntax
also passed checks. These are NOT live authentication, database, IndexedDB,
iPhone/Safari, two-device sync, or browser end-to-end tests. A browser binary was
not available in the build environment; downloading it failed due to network DNS.
Run the acceptance checks below after publication before relying on the app.

## 1. Create a dedicated Supabase project

Use your Supabase dashboard to create a new project named `education` in your
chosen Free-plan organization. Choose a suitable European region. Keep the
database password in your password manager; do not paste it into the app or chat.
Wait until the project is ready.

Open SQL Editor, create a query, paste the complete contents of
`supabase/migrations/001_education.sql`, and run it once against this new project.
It creates these dedicated application objects:

- `public.education_records`
- `public.education_record_history`
- `public.save_education_record(...)`

The tables use row-level security. Ordinary authenticated clients can read only
their own rows. Writes go through a function that derives the user from the auth
session, checks the expected record revision, and preserves previous versions.
The build and service worker never run SQL or change the database schema.
This migration has not been executed on a live project in this release session.

In Authentication > Users, use the dashboard's Add user / Create new user action
to create your own email/password login. Use a strong unique password; keep it to
yourself. If offered an auto-confirm option for this manually created owner
account, confirm your own email. The application currently provides Sign in and
password recovery, not an open registration screen.

For a personal deployment, disable public sign-ups in Authentication settings;
leave email/password sign-in enabled. Disabling public sign-ups does not revoke
an already created owner account. Never delete the Auth user to "reset" the app:
its cloud records have an on-delete-cascade relation to that user.

Get the Project URL from the Connect dialog and the **publishable** key from
Settings > API Keys. Use `sb_publishable_...`, not `sb_secret_...`, `service_role`,
a database password, a GitHub token, or a Supabase management access token.
The public key will be included in the browser bundle intentionally; protection
comes from authentication, row-level security, and constrained database functions.

## 2. Upload the source to GitHub

Unzip the archive. Upload the CONTENTS of the `education` folder into the root of
your `education` repository, using GitHub's Upload files page, and commit them.
Do not upload the ZIP as a single file. `package.json` and `vercel.json` must sit
at the repository root, alongside `src`, `scripts`, `assets`, `tests`, and
`supabase`. If GitHub offers an "uploading an existing file" link for an empty
repository, that opens the same upload flow.

No terminal is needed for this initial upload. Keep the supplied folder structure.
The archive excludes generated `public/`, node_modules, passwords, personal
backups, screenshots, and your original course documents.

The repository may be public; do not put private notes, grades, exported backups,
credentials, or raw university attachments into it. Course templates embedded in
the source are visible with the application code. Actual workspace records are
stored separately in your browser and, after sign-in and successful sync, Supabase.

## 3. Import the repository into Vercel

In your Vercel dashboard choose Add New > Project, select/import the GitHub
repository, and use your personal Hobby workspace for this personal project.
If the repository is not shown, grant the Vercel GitHub integration access to it.
That integration is separate from connecting GitHub to ChatGPT.

Build settings (also supplied in `vercel.json`):

| Setting | Value |
| --- | --- |
| Framework Preset | Other |
| Root Directory | repository root |
| Build Command | `node scripts/build.mjs` |
| Output Directory | `public` |
| Node.js | 22 or newer |

Before pressing Deploy, add these environment variables for Production and any
Preview deployments you intend to use:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | your HTTPS Supabase Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | your public `sb_publishable_...` key |

The production build deliberately fails when cloud configuration is absent or a
secret key is supplied. A test build without Vercel environment variables is
local-only. No private database credentials are needed for a frontend build.

Press Deploy and use the **stable production address** Vercel assigns, not a
commit-specific preview address. Do not assume `education.vercel.app` is available.
Changing environment variables requires a new deployment to rebuild the bundle.

A dashboard deployment also works when the ChatGPT connector cannot list your
workspace. Connecting an app to ChatGPT does not create an app project or grant
this session upload/deployment actions.

## 4. Configure the final address and sign in

In Supabase Authentication > URL Configuration, set Site URL to the stable
production address. Add that address, with the appropriate trailing slash, to the
allowed Redirect URLs. Password recovery uses the page's base URL, so add the
exact address you actually open. Do not use a broad wildcard for production.

Open the deployed site and sign in with the account created in Supabase. Use the
same account on Mac and iPhone. Do not select "Use on this device only" when you
expect cloud synchronization. The first-run wizard appears for an empty workspace.

Password-recovery email delivery depends on Supabase's email settings. Its default
email service is restricted; configure a supported SMTP provider when needed.
Owner login with an already created email/password account does not require a new
email to be delivered each time.

On iPhone, open the stable address in Safari, then Share > Add to Home Screen.
Enable Open as Web App if Safari offers it, and tap Add. Sign in within the Home
Screen app as needed. Test it as a separate context rather than assuming that
Safari and the Home Screen app always share their existing sessions or local data.

## Moving data from the original standalone HTML

In the OLD local app, use Settings > Export backup. Keep this file outside the
repository. Sign in on the NEW deployed address and restore the backup once in
Settings. Wait for the sync indicator to show success, then open the same account
on the other device. Do not create a second set of templates on the other device.

The old file and the new website do not automatically share local browser storage.
A local-only workspace and a signed-in workspace are deliberately kept separate.
Restoring matching IDs replaces those records after a local recovery copy is saved;
review the restore confirmation and export a fresh backup before restoring.

## Updates without replacing your workspace

After Git integration is configured, commits to the configured production branch
trigger Vercel deployments. Normal interface updates rebuild only static files.
The build does not reset Supabase, re-import course templates, or clear IndexedDB.
Keep the same production origin, project, and account to retain the same workspace.

The service worker installs a complete, versioned application shell and waits for
activation when a working version is already open. A running app offers an Update
button; save/close an unfinished form before applying it. The new shell keeps the
same `education-workspaces` IndexedDB name and schema version. Update activation
waits for previously queued local writes. Database requests are never cached by
the service worker. The OS/browser controls when update checks run; this is not a
promise of instant background delivery to a closed iPhone app.

If a future release needs a new database structure, use a reviewed, additive SQL
migration and a backup. Do not delete the project, drop tables, remove the Auth
user, or clear browser storage as an update procedure. App changes cannot protect
against account deletion, service outages, or browser storage eviction. Keep
regular exported backups even after cloud sync is working.

## Acceptance checks before relying on Education

1. Sign in on Mac, create a temporary course and task, enter a grade, and reload.
   The data must remain and appear in your own `education_records` rows.
2. Sign in on iPhone with the same account; confirm the same records appear.
   Edit a note there and verify that the Mac receives the change.
3. With the app already installed/loaded, disconnect the network, make an edit,
   and reload. Reconnect; verify pending changes sync and no error is hidden.
4. Edit the same record on both offline devices and reconnect. Verify that the
   conflict UI preserves both versions until you choose one.
5. Deploy a small interface change. Verify that the Home Screen app loads the
   update after saving forms, and that notes, grades, and settings remain intact.
6. Verify that a signed-out client cannot read records. In a separate disposable
   account, verify that it cannot read the owner's rows. Do not publish private
   test data or weaken row-level security to make a test pass.
7. Confirm that no service worker or console errors occur in Safari and that the
   Home Screen icon, navigation, keyboard, and forms work on the actual phone.

## Local development without external packages

Node.js 22+ is sufficient for build and unit tests:

```sh
npm run build
npm run check
npm test
```

For cloud configuration during a local build, put only the public settings in a
local `.env` and run `node --env-file=.env scripts/build.mjs`. The `.env` file is
ignored by Git; it is not a place for admin/service-role credentials.

Serve the generated `public/` folder with a local HTTP server, not by double-
clicking its index.html. For example, if Python 3 is installed:

```sh
python3 -m http.server 8080 --directory public
```

Open `http://localhost:8080`. Browser installation/offline behavior still needs
real-browser testing. There are no runtime third-party JavaScript packages or
external font downloads in this release.

## Official setup references

- Supabase project quickstart: https://supabase.com/docs/guides/getting-started/quickstarts/reactjs
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase users: https://supabase.com/docs/guides/auth/managing-user-data
- Supabase general auth settings: https://supabase.com/docs/guides/auth/general-configuration
- Supabase redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase SMTP restrictions: https://supabase.com/docs/guides/auth/auth-smtp
- GitHub file upload: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- Vercel Git integration: https://vercel.com/docs/git
- Vercel build settings: https://vercel.com/docs/builds/configure-a-build
- Apple Home Screen web apps: https://support.apple.com/guide/iphone/iphea86e5236/ios
