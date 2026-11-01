# Security

## Reporting a problem

If you find a security problem, **message Johan on Slack**. Please don't open a public issue or pull request about it, and don't post the details anywhere others can read them until it is fixed.

It helps if you say:

- what you found, and where (the page or route, and the file if you know it);
- the steps to reproduce it, or a short script;
- what an attacker could do with it.

You'll get an answer as soon as someone is around. This is a volunteer project for a game jam, so there is no fixed time limit, but problems that let someone get into the admin page, read hold codes, or send messages as someone else come first.

## What is supported

Only the latest version on the `main` branch. Fixes go there, and the running site is updated from it.

## What is worth knowing about

How the app protects itself, so you can tell a gap from something intended:

- **Admin**: passkey login only (no passwords). Admin routes sit behind a session cookie, and login and enrollment are rate limited.
- **Holds**: each hold has a random 8-character code (about 40 bits). It is kept readable in the database on purpose, so the PDFs can be printed again. Logging in is rate limited, and a code can be replaced or banned in the admin page.
- **Messages**: nothing is shown on the big screen until an admin approves it. Anyone without a hold is limited to one message per 10 minutes per IP and has to pass a Cloudflare Turnstile captcha.
- **Cookies**: `httpOnly`, and `Secure` when the site is served over HTTPS.
- **SQL**: every query uses parameters. User text is shown with `textContent`, not as HTML.

Things that are intentionally simple, so please don't report them as bugs:

- Admin logins live in memory, so a restart logs the admin out.
- Everyone at the venue shares one public IP, so the limit for people without a hold is, on purpose, very tight.
- A banned hold can log out and send as "Ingen hold", which has its own limit and the captcha.

See [Production notes in the README](README.md#production-notes) for how to run it safely (HTTPS, `TRUST_PROXY`, not exposing the database).
