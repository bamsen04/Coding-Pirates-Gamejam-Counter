# Docker Compose cheatsheet

Run these from the project folder, where `docker-compose.yml` lives.

## Start and stop

| Command | What it does |
|---|---|
| `docker compose up` | Start everything and show the logs. Ctrl+C stops it. |
| `docker compose up -d` | Start in the background (detached). |
| `docker compose up --build` | Rebuild the app image first. Use this after changing code or the Dockerfile. |
| `docker compose down` | Stop and remove the containers. The data volume is kept. |
| `docker compose down -v` | Same, and also delete the volumes. This wipes the MySQL data. |
| `docker compose stop` / `start` | Pause and resume without removing the containers. |
| `docker compose restart app` | Restart one service. |

## Look at what's happening

| Command | What it does |
|---|---|
| `docker compose ps` | Show which containers are running. |
| `docker compose logs -f app` | Follow the app's logs. Leave off `app` to see all services. |

## Run things inside a container

| Command | What it does |
|---|---|
| `docker compose exec app sh` | Open a shell in the running app container. |
| `docker compose exec db mysql -uroot -prootpass gamejam` | Open a MySQL prompt. |
| `docker compose run --rm app bun run enroll` | Run a one-off command in a fresh app container. |

## Build

| Command | What it does |
|---|---|
| `docker compose build` | Build the images without starting anything. |
| `docker compose pull` | Download newer versions of images like `mysql:8`. |

## Day to day

1. `docker compose up --build` while developing.
2. `docker compose up -d --build` on a server.
3. `docker compose down -v` when you want a clean database. The migrations re-run on the next start.

Add a service name to most commands to target just that one, e.g. `docker compose logs app` or `docker compose up -d db`.
