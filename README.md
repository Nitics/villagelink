# VillageLink Nkomazi

**What's available near me right now?** A community app for the Nkomazi region: which fuel stations, shops, clinics and police stations are open (and how sure we are), ordering from local shops, buying and selling, study groups, and an AI assistant for local questions and homework.

Built with React, TypeScript and Vite. Data, sign-in and the assistant run on Supabase. The website is published by GitHub Pages.

## How “open now” works

| Status | Meaning |
| --- | --- |
| Confirmed open | The business (or VillageLink staff) confirmed in the last 3 hours |
| Expected open | Published opening hours say it’s open; nobody confirmed today |
| Status unverified | No hours, or hours not checked for over 6 months |
| Confirmed closed | The business said it’s closed, whatever the hours say |

Resident reports (“I saw it open”) are shown for 4 hours but never change a status.

## Who can do what

| Account | Can |
| --- | --- |
| Visitor (not signed in) | Browse businesses, products, listings and study groups |
| Customer | Order from shops and cancel unaccepted orders, post listings, create and join study groups, report what’s open, request a business plan, use the assistant (30 questions a day) |
| Shop owner | Everything a customer can, plus confirm “open now”, update hours and contact details, manage products, handle their shop’s orders |
| Staff | Everything: add, import, edit and delete businesses, see all orders, handle plan requests |

These rules are enforced by the database itself (row-level security), not just the app. Make someone staff or a shop owner in the Supabase SQL editor:

```sql
-- staff
update public.profiles set role = 'staff' where id = (select id from auth.users where email = 'person@example.com');
-- shop owner
insert into public.business_members (business_id, user_id)
select b.id, u.id from public.businesses b, auth.users u
where b.name = 'OneStop Tuck Shop' and u.email = 'owner@example.com';
```

## Project layout

| Path | What it is |
| --- | --- |
| `src/pages/` | Home, Services, Market, Study, Ask, Profile, Manage |
| `src/sheets/` | Pop-up sheets: business details, ordering, editing, import, listings, groups, plans, sign-in |
| `src/lib/hours.ts` | Opening-hours reader and “open now” status (unit tested) |
| `src/lib/actions.ts` | Every change the app makes to the database |
| `src/lib/data.ts` | Loading data, and the offline copy for when there’s no signal |
| `supabase/migrations/` | The database: tables, security rules and functions |
| `supabase/functions/assistant/` | The assistant server (Supabase Edge Function) |
| `public/sw.js` | Offline support and install-to-home-screen |
| `tests/` | End-to-end browser test with an in-memory copy of Supabase |

## Run it on your computer

Needs Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # production build in dist/
```

## Publish on GitHub Pages

1. Push this folder to a GitHub repository (for example `villagelink`).
2. In the repository, go to **Settings › Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` runs the tests, builds the site and publishes it to `https://YOUR-USERNAME.github.io/villagelink/`.
4. In Supabase, go to **Authentication › URL Configuration**:
   - **Site URL:** `https://YOUR-USERNAME.github.io/villagelink/`
   - **Redirect URLs:** add `https://YOUR-USERNAME.github.io/villagelink/**` and `http://localhost:5173/**`

   Without this, the links in sign-up and password-reset emails won’t open the app.

## Switch on the assistant

The assistant runs as the Supabase Edge Function `assistant`. It needs an Anthropic API key:

1. Create a key at console.anthropic.com and set a monthly spending limit.
2. In Supabase, open **Edge Functions › Secrets** and add `ANTHROPIC_API_KEY`.
3. Optional secrets: `ASSISTANT_DAILY_LIMIT` (questions per person per day, default 30) and `ASSISTANT_MODEL` (default `claude-haiku-5-5`).

To redeploy the function after changing it: `npx supabase functions deploy assistant --no-verify-jwt` (the function checks sign-in itself).

## Before launch

- Turn on **Confirm email** under Authentication › Sign In / Providers › Email, and connect your own email sender under Authentication › Emails (Supabase’s built-in sender only sends a few emails an hour).
- Replace placeholder phone numbers and get each business’s permission to show its number (POPIA).
