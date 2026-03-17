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

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/logistics/summary`
- `GET /api/health`
- `POST /api/productions`
- `GET /api/productions`
- `GET /api/productions?employeeId=:employeeId`
- `PATCH /api/productions/:id/complete`
- `GET /api/employees`
- `GET /api/employees/:id`
- `POST /api/employees`
- `PATCH /api/employees/:id`
- `DELETE /api/employees/:id`
- `GET /api/teams`
- `GET /api/teams/:id`
- `POST /api/teams`
- `PATCH /api/teams/:id`
- `PUT /api/teams/:id/members`
- `DELETE /api/teams/:id`
- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`

## Database migration

To create employees, teams, and team-member relationships, run this script in PostgreSQL (for example in DBeaver):

- `sql/20260317_create_teams_and_employees.sql`
- `sql/20260317_add_employee_auth_roles.sql`
- `sql/20260317_add_logistics_indexes.sql` (optional, for query performance)

When creating a production, send `installationTeamId` (team id from `GET /api/teams`) in the request body.

Bootstrap users created by `sql/20260317_add_employee_auth_roles.sql`:

- `admin@backwood.com` (`admin`)
- `gerente@backwood.com` (`gerente`)
- `funcionario@backwood.com` (`funcionario`)
- Initial password for all: `Senha@123`

## Authentication and roles

- Login is based on employee email and password.
- Roles: `admin`, `gerente`, `funcionario`.
- `admin` and `gerente` can manage employees, teams, and productions.
- `funcionario` cannot create/complete productions and cannot access employees/teams/users management routes.
- `funcionario` can list productions, but only from teams where this employee is a member.
- `GET /api/logistics/summary` is available only for `admin` and `gerente`.

## Logistics summary contract

Endpoint:

- `GET /api/logistics/summary`

Response:

```json
{
	"data": {
		"teamsCount": 0,
		"activeEmployeesCount": 0,
		"productions": {
			"activeCount": 0,
			"overdueCount": 0,
			"nearDeadlineCount": 0,
			"onTimeCount": 0
		},
		"topMaterials": [
			{
				"productId": "string",
				"productName": "string",
				"unit": "string",
				"totalQuantity": 0
			}
		],
		"activeProductionsTotalCost": 0
	}
}
```

Business rules:

- Active production statuses: `pending`, `cutting`, `assembly`, `finishing`, `quality_check`.
- Overdue: `delivery_date < today` and active status.
- Near deadline: `delivery_date between today and today + 3 days` and active status.
- On time: `delivery_date > today + 3 days` and active status.

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
- Environment Variable: `DATABASE_URL=<your_postgresql_connection_string>`
- Environment Variable: `JWT_SECRET=<a-strong-secret-with-at-least-16-characters>`

After the first deploy, your API should be available at:

- `https://<your-render-service>.onrender.com/api/health`