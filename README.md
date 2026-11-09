# Expense Tracker (React)

React + TypeScript + Vite + Tailwind CSS v4 port of the Angular `ExpenseTracker` app. It talks to the same FastAPI backend (`ExpenseTrackerBackend`).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

In dev, `/api` is proxied to `http://localhost:8000` (see `vite.config.ts`), so the backend's CORS list doesn't need changing.

For production, set `VITE_API_URL` (see `.env.example`) to the deployed backend's `/api` URL, and add the frontend's origin to the backend's `CORS_ORIGINS`.

```bash
npm run build      # outputs dist/
```

## Docker

Docker Compose builds a production Nginx image for React and a FastAPI image. The frontend proxies `/api` requests to the backend container. The backend uses the PostgreSQL database configured in `ExpenseTrackerBackend/.env`; no database credentials are included in the images.

Keep `ExpenseTrackerReact` and `ExpenseTrackerBackend` as sibling folders. Ensure `ExpenseTrackerBackend/.env` contains valid `DATABASE_URL` and `JWT_SECRET_KEY` values. If it does not exist, copy `.env.example` to `.env` and fill in the values.

Run these commands from the `ExpenseTrackerReact` folder:

```bash
docker compose build
docker compose run --rm backend python -m app.database.migrate
docker compose up -d
```

Open `http://localhost:8080`. The API is also available at `http://localhost:8000`; check `http://localhost:8000/health` and `http://localhost:8000/health/database` for service health. To stop the containers, run `docker compose down`.

## Tests

[Vitest](https://vitest.dev) + React Testing Library, running in jsdom. Test files sit next to the code they test (`*.test.ts(x)`).

```bash
pnpm test          # watch mode
pnpm test:run      # run once
pnpm coverage      # run once + coverage report (opens as coverage/index.html)
```

The tests never call the real backend: `mockApi()` in `src/test/utils.tsx` replaces `fetch` with a fake API, and `renderWithProviders()` wraps a component in the router, toasts, confirm dialog and (optionally) auth.

## Accounts (Sign In / Sign Up)

Every `/api/books` and `/api/entries` route needs a login token, and each user sees only their own books.

Backend setup (one time, from `ExpenseTrackerBackend`):

```bash
pip install -r requirements.txt          # adds PyJWT, bcrypt, email-validator
python -m app.database.migrate           # creates cashexpense_users + books.user_id (safe to re-run)
```

`.env` must contain `JWT_SECRET_KEY` (see `.env.example`). Books created before accounts existed belong to **the first account that signs up**.

Frontend: `/signin` and `/signup` are public; everything under `/expenseApp` redirects to Sign In when logged out. The token is kept in `localStorage` and lasts 7 days (`JWT_EXPIRE_MINUTES`); any 401 signs the user out.

## Structure

```
src/
  main.tsx                 routes + providers
  types.ts                 API / UI models, categories
  lib/api.ts               fetch client for auth, books + entries (adds the Bearer token)
  lib/session.ts           token storage
  components/auth/         AuthContext (user, login, signup, logout) + route guards
  pages/AuthPage.tsx       Sign In / Sign Up
  lib/format.ts            dates, money, running balances
  lib/crypto.ts            encrypted book id in URLs (same scheme as Angular)
  lib/pdf.ts               PDF report (pdfmake, lazy-loaded)
  components/Layout.tsx    navbar + live clock
  components/EntryDrawer.tsx  add / edit / view entry panel
  components/ui/           Modal, Drawer, Menu, Toast, Confirm
  pages/BookList.tsx       books: add, rename, reorder, delete, reports
  pages/BookDetail.tsx     summary, filters, entries table, pagination
```
