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
| `TURNSTILE_SECRET_KEY` | Required unless Turnstile is disabled. |
| `DISABLE_TURNSTILE` | `true` skips the captcha. Development only. |
| `RP_ID`, `ORIGIN` | Passkeys are bound to these. Set to your real domain and `https://` origin in production. |

## Enrolling an admin passkey

```
docker compose run --rm app bun run enroll
```

Open the printed link (valid 15 minutes, single use) and register a passkey. Then log in at `/admin/login`.

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
