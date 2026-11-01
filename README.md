# gamejam-counter

The countdown page for the Coding Pirates game jam. A big clock counts down to the start, with sounds, confetti and a dark mode at set moments. Visitors send short messages from their phones; an admin approves them, and approved messages show up around the clock for a while.

Built with Bun, Express and MySQL. Pages are Nunjucks templates, styled with Tailwind, with the browser code written in TypeScript. The admin logs in with a passkey.

## Running with Docker

```
cp .env.example .env     # then fill in the passwords and Turnstile key
docker compose up --build
```

The site is on http://localhost:3000, and the admin page on http://localhost:3000/admin. See [CHEATSHEET.md](CHEATSHEET.md) for more compose commands.

Open `/#nofab` on the big screen to hide the + button there. The page starts with a "Tryk for at starte" screen: the click lets the browser play sound.

## Developing

Docker is the easy way to get a database. To run the app on your own machine instead you need a MySQL it can reach (set `MYSQL_HOST` and the other `MYSQL_*` values in `.env`):

```
bun install
bun run build        # Tailwind CSS and the browser code, into public/ (not committed)
bun run server
```

While editing, `bun run dev:css` and `bun run dev:js` rebuild on every change. `bun run typecheck` checks the server and the browser code, which have separate configs, and `bun test` runs the tests.

## Project layout

| Folder | What is in it |
|---|---|
| `src/api/` | The HTTP API, one file per route. `messages.post.ts` is `POST /messages`, `[id]` in a name is a `:id` parameter, and `defineRoute({ admin: true })` or `{ rateLimit }` adds the admin check or a rate limit. See [src/router.ts](src/router.ts). |
| `src/services/` | Database access and the logic behind the routes: messages, holds, cooldowns, settings, events, PDFs. |
| `src/client/` | The browser code in TypeScript, bundled by `bun run build` into `public/js/`. |
| `views/` | Nunjucks templates: a layout, small components, and the pages. |
| `src/migrations/` | The database schema, as numbered SQL files. |
| `tests/` | Tests with a mocked database. |

## Configuration

Everything is read from `.env` (see [.env.example](.env.example)) in [src/config.ts](src/config.ts). The app refuses to start if a required value is missing.

| Variable | Description |
|---|---|
| `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` | Required. Only applied when the database volume is first created. |
| `MYSQL_USER`, `MYSQL_DATABASE` | Optional, default `gamejam`. |
| `TURNSTILE_SITE_KEY` | The widget's public key, shown in the page. Optional; defaults to the project's current key. |
| `TURNSTILE_SECRET_KEY` | The widget's private key. Required unless Turnstile is disabled. |
| `DISABLE_TURNSTILE` | `true` skips the captcha. Development only. |
| `RP_ID`, `ORIGIN` | Passkeys are bound to these. Set to your real domain and `https://` origin in production (`ORIGIN="https://countdown.gamejamkbh.dk"`). `ORIGIN` is also the address printed and linked with a QR code on the hold PDFs. |
| `TRUST_PROXY` | `true` when the app runs behind a reverse proxy, so visitors keep their own IP. Needed for the per-IP limits. |
| `ALLOWED_IPS` | Public IPs you trust (comma-separated), for example the venue's. They get 5 times the login rate limits (admin login and hold login), counted per browser instead of for the whole address. Does not change the one-message-per-10-minutes limit for *Ingen hold*. |

## Enrolling an admin passkey

```
docker compose run --rm app bun run enroll
```

Open the printed link (valid 15 minutes, single use) and register a passkey. Then log in at `/admin/login`.

## The admin page

At `/admin`, with tabs that stay at the top:

- **Beskeder**: messages waiting for approval (approve or reject) and the approved ones (remove). The tab shows how many are waiting, and so does the browser tab's title. A beep plays when a new one arrives, after you have clicked somewhere on the page.
- **Hold**: the teams, see below.
- **Begivenheder**: what happens on the clock, see below.
- **Indstillinger**: how long an approved message stays up, the date and time the clock counts down to, the most time the clock will ever show, and whether it shows days (`DD:HH:MM:SS`) or only total hours (`HH:MM:SS`).

## Timer events

An event is something that happens when the clock reaches a time. Times are what the clock shows (`TT:MM:SS`), so "at 00:10:00" is ten minutes before the end.

| Action | What it does |
|---|---|
| Konfetti | Confetti, once, when the clock reaches "Ved". |
| Fanfare | A fanfare sound, once, when the clock reaches "Ved". |
| Tik | A ticking sound every second from "Ved" down to "Til". Leave "Ved" empty to start from the beginning. |
| Bip | A beep every second from "Ved" down to "Til", for the last seconds. |
| Mørk tilstand | The page fades to a dark theme while the clock is between "Ved" and "Til", and back afterwards. |

New installs start with a tick all the way down, beeps for the last 10 seconds, and a fanfare and confetti at 00:00:00. Changes show up on screens that are already open within a minute.

## Hold and who sends a message

In the **Hold** tab, "Lav nye koder til alle" creates Hold 1 to N (e.g. 14) plus *frivillig*, each with a random 8-character code (capital letters and digits, no look-alikes, case doesn't matter). "Hent alle som PDF" gives two A4 pages per hold, to print two to a sheet: the front says which hold you are, with a QR code for the site and its address; the back is just the code. Each hold row also has its own PDF.

Pressing + opens a first step, "Er du på et hold?": type the hold's code, or press "Jeg er ikke på et hold". Only then comes the message form, where the name is typed on every message. It then reads *Name (Hold 5)*. Admins and anyone already logged in to a hold skip the first step.

| Sends as | Wait between messages |
|---|---|
| A hold | 10 minutes, shared by the whole hold, kept on the server |
| frivillig | none |
| Admin (logged in to the admin page) | none |
| Nobody (*Ingen hold*) | 10 minutes per IP, plus the Turnstile captcha |

Per hold, the admin page can set a different wait (for example 30 minutes, or 0), give the hold a **new code** (the old one stops working), or **ban** it so it can't send. A hold that is banned can still log in but can't send; someone can log out and send as *Ingen hold*, which is limited as above.

## Tests

```
bun test
```

Runs the tests in [tests/](tests). They don't need MySQL or Docker; the database is mocked. The same tests, a typecheck and a build run on GitHub for every push ([.github/workflows/tests.yml](.github/workflows/tests.yml)).

## Database migrations

SQL files in [src/migrations](src/migrations) run in filename order when the app starts. Applied files are recorded in the `schema_migrations` table, so each runs once.

To change the schema, add the next numbered file (after `005-hold-moderation.sql` that is `006-something.sql`). Don't edit a migration that has already been applied. Statements are split on `;`, so keep semicolons out of comments and strings.

To start over with an empty database (deletes all data): `docker compose down -v`.

## Contributing, security and license

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to send a change and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for how we treat each other. Found a security problem? Follow [SECURITY.md](SECURITY.md) and don't open a public issue. The project is released under the [MIT license](LICENSE).

## Production notes

- Serve it over HTTPS (for example behind Caddy); passkeys and Turnstile need it. Cookies get the `Secure` flag automatically when `ORIGIN` starts with `https://`, and are then never sent over plain http. Local development on `http://localhost` is left without it.
- Set `ORIGIN` and `RP_ID` to your domain, and `TRUST_PROXY=true` behind a proxy. With `TRUST_PROXY=true`, only the proxy should be able to reach port 3000: otherwise visitors can fake their IP and get around the rate limits.
- Don't publish the MySQL port. The app reaches it over the compose network. To inspect the data: `docker compose exec db mysql -uroot -p gamejam`.
- Back up the `dbdata` volume (for example with `mysqldump`).
- Admin logins are kept in memory, so after a restart you log in again.
