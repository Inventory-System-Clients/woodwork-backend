# Woodwork Backend

Backend scaffold in a dedicated folder with Express + TypeScript.

## Structure

- `src/models`: domain models and schemas
- `src/middlewares`: request/response pipeline middlewares
- `src/routes`: route composition
- `src/controllers`: HTTP handlers
- `src/services`: business logic
- `src/repositories`: data access abstraction
- `src/utils`: shared utilities
- `src/config`: environment and app config

## Run

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

Set a valid PostgreSQL connection string in `DATABASE_URL`.

3. Start in development mode:

```bash
npm run dev
```

4. Build production files:

```bash
npm run build
```

## API base path

- `GET /api/health`
- `POST /api/productions`
- `GET /api/productions`
- `PATCH /api/productions/:id/complete`
- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`

## Deploy on Render

This repository already includes a Render Blueprint file at the project root:

- `render.yaml`

### Option 1: Deploy with Blueprint (recommended)

1. Push this repository to GitHub.
2. In Render, click **New +** > **Blueprint**.
3. Connect your GitHub repository and select it.
4. Render will detect `render.yaml` and create the web service automatically.

### Option 2: Configure manually in Render

If you prefer a manual setup, use these values in a **Web Service**:

- Root Directory: `backend`
- Build Command: `npm ci && npm run build`
- Start Command: `npm run start`
- Health Check Path: `/api/health`
- Node Version: `20`
- Environment Variable: `NODE_ENV=production`

After the first deploy, your API should be available at:

- `https://<your-render-service>.onrender.com/api/health`