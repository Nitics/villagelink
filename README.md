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
| Staff | Add, import, edit, hide and delete businesses and products; edit, hide and delete any listing or study group; see all orders and change their status; handle plan requests |
| Super user | Everything staff can do, plus: see all accounts, change roles and names, link shop owners to businesses, remove someone’s access; add, rename and remove towns; delete orders, plan requests and resident reports |

These rules are enforced by the database itself (row-level security), not just the app.

**Managing people:** super users do this in the app under **Manage › People**: set a role, link a shop owner to their business, or **Remove access** (makes them a customer and unlinks their businesses; their history is kept). To delete an account completely, use the Supabase dashboard: Authentication › Users.

The first super user has to be set in the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'person@example.com');
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
| `tests/` | End-to-end browser test with an in-memory copy of Supabase (`npm run e2e`) |

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

## The local agent (Ask › Local help)

Built into the app (`src/lib/agent.ts`), free and instant, with no AI key. It answers from the live Supabase data, refreshing it if it is more than a minute old:

- what’s open now or on a given day, by type and town (“fuel open now in Malelane?”, “clinic on Sunday”)
- one business by name (“when does OneStop close?”, “Praxoz phone number”)
- products and prices, cheapest first (“where can I buy bread?”)
- the marketplace (“who fixes phones?”), study groups (“maths study group”) and your own orders
- emergencies always put 10111, 10177 and 112 first

It only repeats what is in the data and always says how sure a status is. Its behaviour is covered by `src/lib/agent.test.ts`.

## Switch on the homework assistant

Homework help runs as the Supabase Edge Function `assistant` (Claude). Until it has a key, Homework help suggests matching study groups instead. It needs an Anthropic API key:

1. Create a key at console.anthropic.com and set a monthly spending limit.
2. In Supabase, open **Edge Functions › Secrets** and add `ANTHROPIC_API_KEY`.
3. Optional secrets: `ASSISTANT_DAILY_LIMIT` (questions per person per day, default 30) and `ASSISTANT_MODEL` (default `claude-haiku-5-5`).

To redeploy the function after changing it: `npx supabase functions deploy assistant --no-verify-jwt` (the function checks sign-in itself).

## Before launch

- Turn on **Confirm email** under Authentication › Sign In / Providers › Email, and connect your own email sender under Authentication › Emails (Supabase’s built-in sender only sends a few emails an hour).
- Replace placeholder phone numbers and get each business’s permission to show its number (POPIA).
