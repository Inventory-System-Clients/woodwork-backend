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
- `GET /api/clients`
- `GET /api/clients/:id`
- `POST /api/clients`
- `PATCH /api/clients/:id`
- `DELETE /api/clients/:id`
- `GET /api/budgets`
- `GET /api/budgets/:id`
- `POST /api/budgets`
- `PATCH /api/budgets/:id`
- `PATCH /api/budgets/:id/approve`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PATCH /api/products/:id`
- `GET /api/stock/movements`
- `POST /api/stock/movements`
- `POST /api/productions`
- `GET /api/productions`
- `GET /api/productions?employeeId=:employeeId`
- `PATCH /api/productions/:id/approve`
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
- `sql/20260317_create_budgets.sql`
- `sql/20260317_add_logistics_indexes.sql` (optional, for query performance)
- `sql/20260317_add_product_stock_movements.sql` (required for products API, stock movements API, and stock deduction on budget/production approval)
- `sql/20260318_add_low_stock_alert_to_products.sql` (required to add product low stock alert threshold)
- `sql/20260318_create_clients.sql` (required for clients API)

If `public.products` does not exist yet in your database, this migration creates a minimal products table automatically.

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
- `admin` and `gerente` can manage budgets.
- `admin` and `gerente` can manage products and stock movements.
- `admin` and `gerente` can manage clients.
- `funcionario` cannot create/complete productions and cannot access employees/teams/users management routes.
- `funcionario` cannot access budgets routes.
- `funcionario` cannot access products and stock movement routes.
- `funcionario` cannot access clients routes.
- `funcionario` can list productions, but only from teams where this employee is a member.
- `GET /api/logistics/summary` is available only for `admin` and `gerente`.

## Clients API

Endpoints:

- `GET /api/clients`
- `GET /api/clients?search=:search&isActive=true|false`
- `GET /api/clients/:id`
- `POST /api/clients`
- `PATCH /api/clients/:id`
- `DELETE /api/clients/:id`

Rules:

- Clients payload supports full profile data: `name`, `companyName`, `document`, `contactName`, `email`, `phone`, `secondaryPhone`, `street`, `number`, `complement`, `neighborhood`, `city`, `state`, `postalCode`, `notes`, `isActive`, `metadata`.
- `email` and `document` are unique when informed.
- `DELETE /api/clients/:id` removes the client record permanently.

## Products and stock movements API

Endpoints:

- `GET /api/products`
- `GET /api/products?search=:search`
- `GET /api/products/:id`
- `POST /api/products`
- `PATCH /api/products/:id`
- `GET /api/stock/movements`
- `GET /api/stock/movements?productId=:productId&movementType=:entrada|saida&limit=50&offset=0`
- `POST /api/stock/movements`

Rules:

- Product create payload: `name`, `stockQuantity`, `lowStockAlertQuantity`.
- Product update payload: `name`, `lowStockAlertQuantity`.
- Product response includes `lowStockAlertQuantity` (threshold used by frontend to flag low stock).
- Stock movement create payload: `productId`, `movementType`, `quantity`, `unit`, `reason`, `referenceType`, `referenceId`.
- `POST /api/stock/movements` is transactional:
	- `entrada` increments `products.stock_quantity`.
	- `saida` decrements `products.stock_quantity`.
	- Outbound movement returns `409` when stock is insufficient.
- Every successful movement creates a row in `product_stock_movements`.

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

## Stock deduction on budget and production approval

When `PATCH /api/budgets/:id/approve` is called and the budget transitions to `approved`, backend now:

- Deducts each material quantity from `products.stock_quantity`.
- Inserts one outbound movement (`movement_type = 'saida'`) into `product_stock_movements` per product.
- Executes all steps in a single DB transaction.
- Prevents duplicate deduction if the budget is already `approved`.

Error scenarios for budget approval:

- `400`: a budget material does not have resolvable `productId`/`productName` or product does not exist.
- `409`: insufficient stock for at least one material.
- `500`: stock schema migration was not applied.

When `PATCH /api/productions/:id/approve` (or `PATCH /api/productions/:id/complete`) is called and the production transitions to `approved`, backend now:

- Deducts each material quantity from `products.stock_quantity`.
- Inserts one outbound movement (`movement_type = 'saida'`) into `product_stock_movements` per product.
- Executes all steps in a single DB transaction.
- Prevents duplicate deduction if the production is already `approved` (or legacy `delivered`).

Error scenarios:

- `400`: a production material does not have resolvable `productId`/`productName` or product does not exist.
- `409`: insufficient stock for at least one material.
- `500`: stock schema migration was not applied.

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