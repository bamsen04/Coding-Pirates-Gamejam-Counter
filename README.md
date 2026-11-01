# gamejam-counter

Message wall for the game jam. Visitors send messages (protected by Cloudflare Turnstile), an admin approves them, and approved messages show up on the page for a limited time.

Built with Bun, Express and MySQL. The admin logs in with a passkey.

## Running with Docker

```
cp .env.example .env     # then fill in the passwords and Turnstile key
docker compose up --build
```

The site is on http://localhost:3000. See [CHEATSHEET.md](CHEATSHEET.md) for more compose commands.

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
| `TRUST_PROXY` | `true` when the app runs behind a reverse proxy, so visitors keep their own IP. Needed for the per-IP limit below. |
| `ALLOWED_IPS` | Public IPs you trust (comma-separated), for example the venue's. They get 5 times the login rate limits (admin login and hold login), counted per browser instead of for the whole address. Does not change the one-message-per-10-minutes limit for *Ingen hold*. |

## Enrolling an admin passkey

```
docker compose run --rm app bun run enroll
```

Open the printed link (valid 15 minutes, single use) and register a passkey. Then log in at `/admin/login`.

## Hold and who sends a message

In the admin page, the **Hold** tab makes the teams: "Lav nye koder til alle" creates Hold 1 to N (e.g. 14) plus *frivillig*, each with a random 8-character code (capital letters and digits, no look-alikes, case doesn't matter). "Hent alle som PDF" gives two A4 pages per hold, to print two to a sheet: the front says which hold you are, with a QR code for the site and its address; the back is just the code. Each hold row also has its own PDF.

Pressing + opens a first step, "Er du på et hold?": type the hold's code, or press "Jeg er ikke på et hold". Only then comes the message form, where the name is typed on every message. It then reads *Name (Hold 5)*. Admins and anyone already logged in to a hold skip the first step.

| Sends as | Wait between messages |
|---|---|
| A hold | 10 minutes, shared by the whole hold, kept on the server |
| frivillig | none |
| Admin (logged in to the admin page) | none |
| Nobody (*Ingen hold*) | 10 minutes per IP, plus the Turnstile captcha |

Cookies get the `Secure` flag automatically when `ORIGIN` starts with `https://`, so they are never sent over plain http. Local development on `http://localhost` is left without it.

Per hold, the admin page can set a different wait (for example 30 minutes, or 0), give the hold a **new code** (the old one stops working), or **ban** it so it can't send. A hold that is banned can still log in but can't send; someone can log out and send as *Ingen hold*, which is limited as above.

## Tests

```
bun test
```

Runs the tests in [tests/](tests). They don't need MySQL or Docker; the database is mocked.

## Database migrations

SQL files in [src/migrations](src/migrations) run in filename order when the app starts. Applied files are recorded in the `schema_migrations` table, so each runs once.

To change the schema, add a new file such as `002-something.sql`. Don't edit a migration that has already been applied.

To start over with an empty database (deletes all data): `docker compose down -v`.

## Production notes

- Serve it over HTTPS (for example behind Caddy); passkeys and Turnstile need it.
- Don't publish the MySQL port. The app reaches it over the compose network. To inspect the data: `docker compose exec db mysql -uroot -p gamejam`.
- Back up the `dbdata` volume (for example with `mysqldump`).
