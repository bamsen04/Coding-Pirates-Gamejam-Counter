# Contributing

Thanks for helping. Everyone is welcome, see the [code of conduct](CODE_OF_CONDUCT.md). If you find a security problem, don't open an issue: follow [SECURITY.md](SECURITY.md).

## Getting it running

The README has the details: [Running with Docker](README.md#running-with-docker) and [Developing](README.md#developing). In short:

```
cp .env.example .env     # fill in the passwords; set DISABLE_TURNSTILE="true" for local work
docker compose up --build
```

[Project layout](README.md#project-layout) shows where things are.

## Before you send a change

Run the same three checks GitHub runs on every push:

```
bun run typecheck
bun run build
bun test
```

All of them should pass. The tests don't need a database or Docker.

## How we write code here

- **Match what is around it**: naming, comment style and how much is commented. Comments say *why*, not what.
- **Small and plain is better.** If two ways work, pick the simpler one.
- **Add a test** for behaviour you add or change, especially for limits, cooldowns, bans and anything about who may do what. The tests in [tests/](tests) show the pattern; the database is mocked.
- **Browser code** is TypeScript in `src/client/`. Don't edit `public/js/` or `public/app.css`: they are built by `bun run build` and are not committed.
- **Text on the site is Danish**, code and comments are English.

## Changing the database

Add a new numbered file in `src/migrations/` (the next number after the latest). Never edit one that has already been applied: it won't run again. Keep semicolons out of comments and strings, because the runner splits on them.

## Pull requests

- One idea per pull request, with a short description of what changed and why.
- Say how you tried it (which pages or routes), and what you did not test.
- Don't commit `.env` or any real password, key or hold code.
