import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { pool } from "../database/postgres";
import {
  Budget,
  BudgetCategory,
  BudgetExpenseDepartment,
  BudgetFinancialSummary,
  BudgetMaterial,
  BudgetStatus,
  CreateBudgetInput,
  ExpenseDepartmentCatalogItem,
  ListExpenseDepartmentsQueryInput,
  ListBudgetsQueryInput,
  PaginatedBudgets,
} from "../models/budget.model";
import { AppError } from "../utils/app-error";

interface BudgetRow {
  id: string;
  client_name: string;
  category: BudgetCategory;
  description: string;
  status: BudgetStatus;
  delivery_date: string | Date | null;
  total_price: string | number;
  total_cost: string | number | null;
  profit_margin: string | number | null;
  profit_value: string | number | null;
  labor_cost: string | number | null;
  notes: string | null;
  approved_at: string | Date | null;
  costs_applied_at: string | Date | null;
  costs_applied_value: string | number | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface BudgetWithMaterialRow extends BudgetRow {
  product_id: string | null;
  product_name: string | null;
  quantity: string | number | null;
  unit: string | null;
  unit_price: string | number | null;
}

interface BudgetMaterialUsageRow {
  product_id: string | null;
  product_name: string | null;
  quantity: string | number;
  unit: string | null;
}

interface BudgetExpenseDepartmentRow {
  budget_id: string;
  expense_department_id: string | null;
  department_name: string;
  sector: string;
  amount: string | number;
}

interface ExpenseDepartmentCatalogRow {
  id: string;
  name: string;
  sector: string;
  default_amount: string | number;
  created_at: string | Date;
  updated_at: string | Date;
}

interface ProductStockRow {
  id: string;
  stock_quantity: string | number;
}

type BudgetMaterialInput = {
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice?: number | null;
};

type BudgetExpenseDepartmentInput = {
  expenseDepartmentId?: string;
  name: string;
  sector: string;
  amount: number;
};

export type CreateBudgetRecordInput = CreateBudgetInput;

export interface SaveBudgetRecordInput {
  clientName: string;
  category: BudgetCategory;
  description: string;
  status: BudgetStatus;
  deliveryDate: string | null;
  totalPrice: number;
  totalCost: number;
  laborCost: number;
  profitMargin: number;
  profitValue: number;
  notes: string | null;
  approvedAt: string | null;
  materials: BudgetMaterial[];
  expenseDepartments: BudgetExpenseDepartment[];
}

interface BudgetCountRow {
  total_count: string | number;
}

type ListBudgetsRecordInput = ListBudgetsQueryInput;

let productsTableExists: boolean | null = null;
let productStockQuantityColumnExists: boolean | null = null;
let productStockMovementsTableExists: boolean | null = null;
let productNameColumnExists: boolean | null = null;
let productLowStockAlertQuantityColumnExists: boolean | null = null;

function toDateString(value: string | Date | null): string | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function toNumber(value: string | number | null): number {
  if (value === null) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function toMoney(value: number): number {
  return round(Math.max(0, value), 2);
}

// Official contract: profitMargin is decimal between 0 and 1.
function normalizeProfitMargin(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  if (value <= 1) {
    return round(value, 6);
  }

  if (value <= 100) {
    return round(value / 100, 6);
  }

  return 0;
}

function resolveBudgetFinancialSummary(
  row: BudgetRow,
  materials: BudgetMaterial[],
  expenseDepartments: BudgetExpenseDepartment[],
): BudgetFinancialSummary {
  const totalPrice = toMoney(toNumber(row.total_price));
  const laborCost = toMoney(toNumber(row.labor_cost));
  const materialsCost = toMoney(
    materials.reduce((sum, material) => sum + material.quantity * (material.unitPrice ?? 0), 0),
  );
  const expenseDepartmentsCost = toMoney(expenseDepartments.reduce((sum, item) => sum + item.amount, 0));
  const costsAppliedAt = toDateString(row.costs_applied_at);
  const costsAppliedValue = toMoney(toNumber(row.costs_applied_value));

  let totalCost = toMoney(toNumber(row.total_cost));

  if (totalCost === 0 && materialsCost + laborCost + expenseDepartmentsCost > 0) {
    totalCost = toMoney(materialsCost + laborCost + expenseDepartmentsCost);
  }

  let profitMargin = normalizeProfitMargin(toNumber(row.profit_margin));

  if (profitMargin === 0 && totalCost > 0) {
    const derivedMargin = (totalPrice - totalCost) / totalCost;
    profitMargin = normalizeProfitMargin(derivedMargin);
  }

  const storedProfitValue = row.profit_value === null ? Number.NaN : toNumber(row.profit_value);
  const computedProfitValue = Number.isFinite(storedProfitValue) && storedProfitValue > 0
    ? storedProfitValue
    : totalCost * profitMargin;
  const profitValue = toMoney(computedProfitValue);

  // Business rule requested by frontend: net profit shown as cost - profit.
  const netProfitValue = round(totalCost - profitValue, 2);
  const remainingCostToApply = toMoney(Math.max(0, totalCost - costsAppliedValue));

  return {
    totalPrice,
    totalCost,
    expenseDepartmentsCost,
    laborCost,
    costsAppliedValue,
    costsAppliedAt,
    remainingCostToApply,
    profitMargin,
    profitValue,
    netProfitValue,
  };
}

function mapBudgetRow(row: BudgetRow): Budget {
  const financialSummary = resolveBudgetFinancialSummary(row, [], []);

  return {
    id: row.id,
    clientName: row.client_name,
    category: row.category,
    description: row.description,
    status: row.status,
    deliveryDate: toDateString(row.delivery_date),
    totalPrice: financialSummary.totalPrice,
    totalCost: financialSummary.totalCost,
    laborCost: financialSummary.laborCost,
    profitMargin: financialSummary.profitMargin,
    profitValue: financialSummary.profitValue,
    netProfitValue: financialSummary.netProfitValue,
    financialSummary,
    notes: row.notes,
    approvedAt: toDateString(row.approved_at),
    costsAppliedAt: financialSummary.costsAppliedAt,
    costsAppliedValue: financialSummary.costsAppliedValue,
    createdAt: toDateString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toDateString(row.updated_at) ?? new Date().toISOString(),
    materials: [],
    expenseDepartments: [],
  };
}

function mapMaterialRow(row: BudgetWithMaterialRow): BudgetMaterial | null {
  if (!row.product_name || row.quantity === null || !row.unit) {
    return null;
  }

  const material: BudgetMaterial = {
    productName: row.product_name,
    quantity: toNumber(row.quantity),
    unit: row.unit,
    unitPrice: row.unit_price === null ? null : toNumber(row.unit_price),
  };

  if (row.product_id) {
    material.productId = row.product_id;
  }

  return material;
}

function normalizeMaterial(input: BudgetMaterialInput): BudgetMaterial {
  const material: BudgetMaterial = {
    productName: input.productName,
    quantity: input.quantity,
    unit: input.unit,
    unitPrice: input.unitPrice ?? null,
  };

  if (input.productId) {
    material.productId = input.productId;
  }

  return material;
}

function normalizeExpenseDepartment(input: BudgetExpenseDepartmentInput): BudgetExpenseDepartment {
  const department: BudgetExpenseDepartment = {
    name: input.name,
    sector: input.sector,
    amount: toMoney(input.amount),
  };

  if (input.expenseDepartmentId) {
    department.expenseDepartmentId = input.expenseDepartmentId;
  }

  return department;
}

function resolveInputFinancialValues(payload: {
  totalPrice: number;
  totalCost?: number | null;
  laborCost?: number | null;
  profitMargin?: number | null;
  profitValue?: number | null;
  materials: BudgetMaterial[];
  expenseDepartments: BudgetExpenseDepartment[];
}): {
  totalCost: number;
  laborCost: number;
  profitMargin: number;
  profitValue: number;
} {
  const totalPrice = toMoney(payload.totalPrice);
  const laborCost = toMoney(payload.laborCost ?? 0);
  const materialsCost = toMoney(
    payload.materials.reduce((sum, material) => sum + material.quantity * (material.unitPrice ?? 0), 0),
  );
  const expenseDepartmentsCost = toMoney(payload.expenseDepartments.reduce((sum, item) => sum + item.amount, 0));

  const totalCost = toMoney(payload.totalCost ?? materialsCost + laborCost + expenseDepartmentsCost);
  const profitMargin = normalizeProfitMargin(
    payload.profitMargin ?? (totalCost > 0 ? (totalPrice - totalCost) / totalCost : 0),
  );

  const rawProfitValue = payload.profitValue ?? totalCost * profitMargin;
  const profitValue = toMoney(rawProfitValue);

  return {
    totalCost,
    laborCost,
    profitMargin,
    profitValue,
  };
}

function groupRows(rows: BudgetWithMaterialRow[]): Budget[] {
  const budgetsById = new Map<string, { budget: Budget; sourceRow: BudgetWithMaterialRow }>();

  for (const row of rows) {
    const existingBudget = budgetsById.get(row.id);

    if (!existingBudget) {
      budgetsById.set(row.id, {
        budget: mapBudgetRow(row),
        sourceRow: row,
      });
    }

    const material = mapMaterialRow(row);

    if (material) {
      budgetsById.get(row.id)?.budget.materials.push(material);
    }
  }

  const budgets: Budget[] = [];

  for (const { budget, sourceRow } of budgetsById.values()) {
    const financialSummary = resolveBudgetFinancialSummary(sourceRow, budget.materials, budget.expenseDepartments);

    budget.totalPrice = financialSummary.totalPrice;
    budget.totalCost = financialSummary.totalCost;
    budget.laborCost = financialSummary.laborCost;
    budget.profitMargin = financialSummary.profitMargin;
    budget.profitValue = financialSummary.profitValue;
    budget.netProfitValue = financialSummary.netProfitValue;
    budget.financialSummary = financialSummary;

    if (budget.status === "approved") {
      // Approved budgets must never be returned without minimum financial payload.
      budget.totalCost = financialSummary.totalCost;
      budget.profitMargin = financialSummary.profitMargin;
      budget.profitValue = financialSummary.profitValue;
    }

    budgets.push(budget);
  }

  return budgets;
}

function mapExpenseDepartmentRow(row: BudgetExpenseDepartmentRow): BudgetExpenseDepartment {
  const item: BudgetExpenseDepartment = {
    name: row.department_name,
    sector: row.sector,
    amount: toMoney(toNumber(row.amount)),
  };

  if (row.expense_department_id) {
    item.expenseDepartmentId = row.expense_department_id;
  }

  return item;
}

async function loadExpenseDepartmentsByBudgetIds(
  queryable: Pick<PoolClient, "query">,
  budgetIds: string[],
): Promise<Map<string, BudgetExpenseDepartment[]>> {
  const grouped = new Map<string, BudgetExpenseDepartment[]>();

  if (budgetIds.length === 0) {
    return grouped;
  }

  const result = await queryable.query<BudgetExpenseDepartmentRow>(
    `
      SELECT
        bed.budget_id,
        bed.expense_department_id,
        bed.department_name,
        bed.sector,
        bed.amount
      FROM public.budget_expense_departments bed
      WHERE bed.budget_id = ANY($1::text[])
      ORDER BY bed.id ASC;
    `,
    [budgetIds],
  );

  for (const row of result.rows) {
    const items = grouped.get(row.budget_id) ?? [];
    items.push(mapExpenseDepartmentRow(row));
    grouped.set(row.budget_id, items);
  }

  return grouped;
}

function applyExpenseDepartmentsToBudgets(budgets: Budget[], grouped: Map<string, BudgetExpenseDepartment[]>): Budget[] {
  for (const budget of budgets) {
    budget.expenseDepartments = grouped.get(budget.id) ?? [];

    const financialSummary = resolveBudgetFinancialSummary(
      {
        id: budget.id,
        client_name: budget.clientName,
        category: budget.category,
        description: budget.description,
        status: budget.status,
        delivery_date: budget.deliveryDate,
        total_price: budget.totalPrice,
        total_cost: budget.totalCost,
        profit_margin: budget.profitMargin,
        profit_value: budget.profitValue,
        labor_cost: budget.laborCost,
        notes: budget.notes,
        approved_at: budget.approvedAt,
        costs_applied_at: budget.costsAppliedAt,
        costs_applied_value: budget.costsAppliedValue,
        created_at: budget.createdAt,
        updated_at: budget.updatedAt,
      },
      budget.materials,
      budget.expenseDepartments,
    );

    budget.totalPrice = financialSummary.totalPrice;
    budget.totalCost = financialSummary.totalCost;
    budget.laborCost = financialSummary.laborCost;
    budget.profitMargin = financialSummary.profitMargin;
    budget.profitValue = financialSummary.profitValue;
    budget.netProfitValue = financialSummary.netProfitValue;
    budget.costsAppliedAt = financialSummary.costsAppliedAt;
    budget.costsAppliedValue = financialSummary.costsAppliedValue;
    budget.financialSummary = financialSummary;
  }

  return budgets;
}

function normalizePersistenceError(error: unknown): never {
  const code = (error as { code?: string }).code;

  if (code === "42P01" || code === "42703") {
    throw new AppError("Internal server error", 500, {
      reason:
        "Budgets schema is not configured. Run sql/20260319_add_budget_financials_and_production_material_unit_price.sql, sql/20260331_add_budget_category.sql, sql/20260331_add_budget_expense_departments.sql and sql/20260331_add_budget_pre_approved_status_and_cost_application.sql",
    });
  }

  throw error;
}

async function hasProductsTable(client: PoolClient): Promise<boolean> {
  if (productsTableExists !== null) {
    return productsTableExists;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'products'
      ) AS exists;
    `,
  );

  productsTableExists = Boolean(result.rows[0]?.exists);
  return productsTableExists;
}

async function hasProductStockQuantityColumn(client: PoolClient): Promise<boolean> {
  if (productStockQuantityColumnExists !== null) {
    return productStockQuantityColumnExists;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'products'
          AND column_name = 'stock_quantity'
      ) AS exists;
    `,
  );

  productStockQuantityColumnExists = Boolean(result.rows[0]?.exists);
  return productStockQuantityColumnExists;
}

async function hasProductStockMovementsTable(client: PoolClient): Promise<boolean> {
  if (productStockMovementsTableExists !== null) {
    return productStockMovementsTableExists;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'product_stock_movements'
      ) AS exists;
    `,
  );

  productStockMovementsTableExists = Boolean(result.rows[0]?.exists);
  return productStockMovementsTableExists;
}

async function hasProductNameColumn(client: PoolClient): Promise<boolean> {
  if (productNameColumnExists !== null) {
    return productNameColumnExists;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'products'
          AND column_name = 'name'
      ) AS exists;
    `,
  );

  productNameColumnExists = Boolean(result.rows[0]?.exists);
  return productNameColumnExists;
}

async function hasProductLowStockAlertQuantityColumn(client: PoolClient): Promise<boolean> {
  if (productLowStockAlertQuantityColumnExists !== null) {
    return productLowStockAlertQuantityColumnExists;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'products'
          AND column_name = 'low_stock_alert_quantity'
      ) AS exists;
    `,
  );

  productLowStockAlertQuantityColumnExists = Boolean(result.rows[0]?.exists);
  return productLowStockAlertQuantityColumnExists;
}

async function ensureStockControlSchema(client: PoolClient): Promise<void> {
  const hasProducts = await hasProductsTable(client);
  const hasStockColumn = await hasProductStockQuantityColumn(client);
  const hasMovements = await hasProductStockMovementsTable(client);

  if (!hasProducts || !hasStockColumn || !hasMovements) {
    throw new AppError(
      "Stock control schema is not configured. Run sql/20260317_add_product_stock_movements.sql",
      500,
    );
  }
}

async function ensureProductsCatalogSchema(client: PoolClient): Promise<void> {
  const hasProducts = await hasProductsTable(client);
  const hasStockColumn = await hasProductStockQuantityColumn(client);
  const hasNameColumn = await hasProductNameColumn(client);
  const hasLowStockAlertColumn = await hasProductLowStockAlertQuantityColumn(client);

  if (!hasProducts || !hasStockColumn || !hasNameColumn || !hasLowStockAlertColumn) {
    throw new AppError(
      "Products schema is not configured. Run sql/20260317_add_product_stock_movements.sql and sql/20260318_add_low_stock_alert_to_products.sql",
      500,
    );
  }
}

async function resolveOrCreateProductIdForMaterial(
  client: PoolClient,
  budgetId: string,
  material: BudgetMaterial,
): Promise<string> {
  if (material.productId && material.productId.trim().length > 0) {
    return material.productId.trim();
  }

  const productName = material.productName.trim();

  if (productName.length === 0) {
    throw new AppError("Cannot create material without product name", 400, {
      budgetId,
      material,
    });
  }

  await ensureProductsCatalogSchema(client);

  const productByNameResult = await client.query<{ id: string }>(
    `
      SELECT id::text AS id
      FROM public.products
      WHERE LOWER(BTRIM(name)) = LOWER(BTRIM($1))
      ORDER BY id::text
      LIMIT 2;
    `,
    [productName],
  );

  if (productByNameResult.rows.length === 1) {
    return productByNameResult.rows[0].id;
  }

  if (productByNameResult.rows.length > 1) {
    throw new AppError("Multiple products found for material name", 409, {
      budgetId,
      productName,
    });
  }

  const productId = randomUUID();

  await client.query(
    `
      INSERT INTO public.products (
        id,
        name,
        stock_quantity,
        low_stock_alert_quantity
      )
      VALUES ($1, $2, 0, 0);
    `,
    [productId, productName],
  );

  return productId;
}

async function resolveOrCreateExpenseDepartmentCatalogId(
  client: PoolClient,
  budgetId: string,
  department: BudgetExpenseDepartment,
): Promise<string> {
  const name = department.name.trim();
  const sector = department.sector.trim();

  if (name.length === 0 || sector.length === 0) {
    throw new AppError("Cannot create expense department without name and sector", 400, {
      budgetId,
      department,
    });
  }

  const existingByNaturalKeyResult = await client.query<{ id: string }>(
    `
      SELECT id::text AS id
      FROM public.expense_departments
      WHERE LOWER(BTRIM(name)) = LOWER(BTRIM($1))
        AND LOWER(BTRIM(sector)) = LOWER(BTRIM($2))
      LIMIT 1;
    `,
    [name, sector],
  );

  const resolvedId = department.expenseDepartmentId?.trim() || existingByNaturalKeyResult.rows[0]?.id || randomUUID();

  await client.query(
    `
      INSERT INTO public.expense_departments (
        id,
        name,
        sector,
        default_amount,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (id)
      DO UPDATE
      SET
        name = EXCLUDED.name,
        sector = EXCLUDED.sector,
        default_amount = EXCLUDED.default_amount,
        updated_at = NOW();
    `,
    [resolvedId, name, sector, department.amount],
  );

  return resolvedId;
}

async function resolveMaterialsWithProducts(
  client: PoolClient,
  budgetId: string,
  materials: BudgetMaterial[],
): Promise<BudgetMaterial[]> {
  const resolvedMaterials: BudgetMaterial[] = [];

  for (const material of materials) {
    const productId = await resolveOrCreateProductIdForMaterial(client, budgetId, material);
    resolvedMaterials.push({
      ...material,
      productId,
    });
  }

  return resolvedMaterials;
}

async function resolveExpenseDepartmentsWithCatalog(
  client: PoolClient,
  budgetId: string,
  departments: BudgetExpenseDepartment[],
): Promise<BudgetExpenseDepartment[]> {
  const resolvedDepartments: BudgetExpenseDepartment[] = [];

  for (const department of departments) {
    const expenseDepartmentId = await resolveOrCreateExpenseDepartmentCatalogId(client, budgetId, department);
    resolvedDepartments.push({
      ...department,
      expenseDepartmentId,
    });
  }

  return resolvedDepartments;
}

async function resolveProductIdForBudgetMaterial(
  client: PoolClient,
  budgetId: string,
  material: BudgetMaterialUsageRow,
): Promise<string> {
  if (material.product_id && material.product_id.trim().length > 0) {
    return material.product_id.trim();
  }

  if (!material.product_name || material.product_name.trim().length === 0) {
    throw new AppError("Cannot resolve product for stock deduction", 400, {
      budgetId,
      productName: material.product_name,
    });
  }

  const canUseProductName = await hasProductNameColumn(client);

  if (!canUseProductName) {
    throw new AppError(
      "Products table does not have name column. Run sql/20260317_add_product_stock_movements.sql",
      500,
    );
  }

  const productByNameResult = await client.query<{ id: string }>(
    `
      SELECT id::text AS id
      FROM public.products
      WHERE LOWER(BTRIM(name)) = LOWER(BTRIM($1))
      ORDER BY id::text
      LIMIT 2;
    `,
    [material.product_name],
  );

  if (productByNameResult.rows.length === 0) {
    throw new AppError("Material product was not found in products table", 400, {
      budgetId,
      productName: material.product_name,
    });
  }

  if (productByNameResult.rows.length > 1) {
    throw new AppError("Multiple products found for material name", 409, {
      budgetId,
      productName: material.product_name,
    });
  }

  return productByNameResult.rows[0].id;
}

async function deductBudgetMaterialsFromStock(client: PoolClient, budgetId: string): Promise<void> {
  await ensureStockControlSchema(client);

  const materialsResult = await client.query<BudgetMaterialUsageRow>(
    `
      SELECT
        bm.product_id,
        bm.product_name,
        SUM(bm.quantity) AS quantity,
        MAX(bm.unit) AS unit
      FROM public.budget_materials bm
      WHERE bm.budget_id = $1
      GROUP BY bm.product_id, bm.product_name;
    `,
    [budgetId],
  );

  for (const material of materialsResult.rows) {
    const quantityToDeduct = toNumber(material.quantity);
    const resolvedProductId = await resolveProductIdForBudgetMaterial(client, budgetId, material);

    if (quantityToDeduct <= 0) {
      continue;
    }

    const stockUpdateResult = await client.query<ProductStockRow>(
      `
        UPDATE public.products
        SET stock_quantity = stock_quantity - $1
        WHERE id::text = $2
          AND stock_quantity >= $1
        RETURNING
          id::text AS id,
          stock_quantity;
      `,
      [quantityToDeduct, resolvedProductId],
    );

    if (stockUpdateResult.rows.length === 0) {
      const productResult = await client.query<{ stock_quantity: string | number }>(
        `
          SELECT stock_quantity
          FROM public.products
          WHERE id::text = $1;
        `,
        [resolvedProductId],
      );

      if (productResult.rows.length === 0) {
        throw new AppError("Material product was not found in products table", 400, {
          budgetId,
          productId: resolvedProductId,
          productName: material.product_name,
        });
      }

      throw new AppError("Insufficient stock to approve budget", 409, {
        budgetId,
        productId: resolvedProductId,
        productName: material.product_name,
        requestedQuantity: quantityToDeduct,
        availableStock: toNumber(productResult.rows[0]?.stock_quantity ?? 0),
      });
    }

    await client.query(
      `
        INSERT INTO public.product_stock_movements (
          product_id,
          movement_type,
          quantity,
          unit,
          reason,
          reference_type,
          reference_id
        )
        VALUES ($1, 'saida', $2, $3, $4, 'budget', $5);
      `,
      [resolvedProductId, quantityToDeduct, material.unit, "Automatic outbound movement from budget approval", budgetId],
    );
  }
}

async function listByIdWithClient(client: PoolClient, id: string): Promise<Budget | undefined> {
  try {
    const result = await client.query<BudgetWithMaterialRow>(
      `
        SELECT
          b.id,
          b.client_name,
          b.category,
          b.description,
          b.status,
          b.delivery_date,
          b.total_price,
          b.total_cost,
          b.profit_margin,
          b.profit_value,
          b.labor_cost,
          b.notes,
          b.approved_at,
          b.costs_applied_at,
          b.costs_applied_value,
          b.created_at,
          b.updated_at,
          bm.product_id,
          bm.product_name,
          bm.quantity,
          bm.unit,
          bm.unit_price
        FROM public.budgets b
        LEFT JOIN public.budget_materials bm
          ON bm.budget_id = b.id
        WHERE b.id = $1
        ORDER BY bm.id ASC;
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    const budget = groupRows(result.rows)[0];
    const groupedExpenseDepartments = await loadExpenseDepartmentsByBudgetIds(client, [id]);
    applyExpenseDepartmentsToBudgets([budget], groupedExpenseDepartments);
    return budget;
  } catch (error) {
    normalizePersistenceError(error);
  }
}

async function findAll(query: ListBudgetsRecordInput): Promise<PaginatedBudgets> {
  const statusFilter = query.status ?? null;
  const categoryFilter = query.category ?? null;
  const startDateFilter = query.startDate ?? null;
  const endDateFilter = query.endDate ?? null;
  const clientNameFilter = query.clientName ?? null;
  const offset = (query.page - 1) * query.limit;

  try {
    const countResult = await pool.query<BudgetCountRow>(
      `
        SELECT
          COUNT(*) AS total_count
        FROM public.budgets b
        WHERE ($1::text IS NULL OR b.status = $1)
          AND ($2::text IS NULL OR b.category = $2)
          AND ($3::timestamptz IS NULL OR COALESCE(b.approved_at, b.created_at) >= $3)
          AND ($4::timestamptz IS NULL OR COALESCE(b.approved_at, b.created_at) <= $4)
          AND ($5::text IS NULL OR LOWER(b.client_name) LIKE CONCAT('%', LOWER(BTRIM($5)), '%'));
      `,
      [statusFilter, categoryFilter, startDateFilter, endDateFilter, clientNameFilter],
    );

    const totalItems = toNumber(countResult.rows[0]?.total_count ?? 0);
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / query.limit) : 0;

    const result = await pool.query<BudgetWithMaterialRow>(
      `
        WITH filtered_budgets AS (
          SELECT
            b.id
          FROM public.budgets b
          WHERE ($1::text IS NULL OR b.status = $1)
            AND ($2::text IS NULL OR b.category = $2)
            AND ($3::timestamptz IS NULL OR COALESCE(b.approved_at, b.created_at) >= $3)
            AND ($4::timestamptz IS NULL OR COALESCE(b.approved_at, b.created_at) <= $4)
            AND ($5::text IS NULL OR LOWER(b.client_name) LIKE CONCAT('%', LOWER(BTRIM($5)), '%'))
          ORDER BY COALESCE(b.approved_at, b.created_at) DESC, b.created_at DESC
          LIMIT $6 OFFSET $7
        )
        SELECT
          b.id,
          b.client_name,
          b.category,
          b.description,
          b.status,
          b.delivery_date,
          b.total_price,
          b.total_cost,
          b.profit_margin,
          b.profit_value,
          b.labor_cost,
          b.notes,
          b.approved_at,
          b.costs_applied_at,
          b.costs_applied_value,
          b.created_at,
          b.updated_at,
          bm.product_id,
          bm.product_name,
          bm.quantity,
          bm.unit,
          bm.unit_price
        FROM filtered_budgets fb
        INNER JOIN public.budgets b
          ON b.id = fb.id
        LEFT JOIN public.budget_materials bm
          ON bm.budget_id = b.id
        ORDER BY COALESCE(b.approved_at, b.created_at) DESC, b.created_at DESC, bm.id ASC;
      `,
      [statusFilter, categoryFilter, startDateFilter, endDateFilter, clientNameFilter, query.limit, offset],
    );

    const budgets = groupRows(result.rows);
    const groupedExpenseDepartments = await loadExpenseDepartmentsByBudgetIds(
      pool as unknown as Pick<PoolClient, "query">,
      budgets.map((budget) => budget.id),
    );

    return {
      data: applyExpenseDepartmentsToBudgets(budgets, groupedExpenseDepartments),
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages,
        hasNextPage: totalPages > 0 && query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  } catch (error) {
    normalizePersistenceError(error);
  }
}

async function findById(id: string): Promise<Budget | undefined> {
  const client = await pool.connect();

  try {
    return await listByIdWithClient(client, id);
  } finally {
    client.release();
  }
}

async function insertMaterials(client: PoolClient, budgetId: string, materials: BudgetMaterial[]): Promise<void> {
  for (const material of materials) {
    await client.query(
      `
        INSERT INTO public.budget_materials (
          budget_id,
          product_id,
          product_name,
          quantity,
          unit,
          unit_price
        )
        VALUES ($1, $2, $3, $4, $5, $6);
      `,
      [
        budgetId,
        material.productId ?? null,
        material.productName,
        material.quantity,
        material.unit,
        material.unitPrice,
      ],
    );
  }
}

async function insertExpenseDepartments(
  client: PoolClient,
  budgetId: string,
  departments: BudgetExpenseDepartment[],
): Promise<void> {
  for (const department of departments) {
    await client.query(
      `
        INSERT INTO public.budget_expense_departments (
          budget_id,
          expense_department_id,
          department_name,
          sector,
          amount
        )
        VALUES ($1, $2, $3, $4, $5);
      `,
      [budgetId, department.expenseDepartmentId ?? null, department.name, department.sector, department.amount],
    );
  }
}

async function listExpenseDepartmentsCatalog(
  query: ListExpenseDepartmentsQueryInput,
): Promise<ExpenseDepartmentCatalogItem[]> {
  try {
    const searchFilter = query.search ?? null;

    const result = await pool.query<ExpenseDepartmentCatalogRow>(
      `
        SELECT
          id::text AS id,
          name,
          sector,
          default_amount,
          created_at,
          updated_at
        FROM public.expense_departments
        WHERE ($1::text IS NULL OR LOWER(name) LIKE CONCAT('%', LOWER(BTRIM($1)), '%') OR LOWER(sector) LIKE CONCAT('%', LOWER(BTRIM($1)), '%'))
        ORDER BY sector ASC, name ASC;
      `,
      [searchFilter],
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      sector: row.sector,
      defaultAmount: toMoney(toNumber(row.default_amount)),
      createdAt: toDateString(row.created_at) ?? new Date().toISOString(),
      updatedAt: toDateString(row.updated_at) ?? new Date().toISOString(),
    }));
  } catch (error) {
    normalizePersistenceError(error);
  }
}

async function create(payload: CreateBudgetRecordInput): Promise<Budget> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const budgetId = randomUUID();
    const normalizedMaterials = payload.materials.map(normalizeMaterial);
    const normalizedExpenseDepartments = (payload.expenseDepartments ?? []).map(normalizeExpenseDepartment);
    const materialsWithProducts = await resolveMaterialsWithProducts(client, budgetId, normalizedMaterials);
    const expenseDepartmentsWithCatalog = await resolveExpenseDepartmentsWithCatalog(
      client,
      budgetId,
      normalizedExpenseDepartments,
    );
    const financialValues = resolveInputFinancialValues({
      totalPrice: payload.totalPrice,
      totalCost: payload.totalCost,
      laborCost: payload.laborCost,
      profitMargin: payload.profitMargin,
      profitValue: payload.profitValue,
      materials: materialsWithProducts,
      expenseDepartments: expenseDepartmentsWithCatalog,
    });

    await client.query(
      `
        INSERT INTO public.budgets (
          id,
          client_name,
          category,
          description,
          status,
          delivery_date,
          total_price,
          total_cost,
          profit_margin,
          profit_value,
          labor_cost,
          notes,
          approved_at,
          costs_applied_at,
          costs_applied_value
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          CASE WHEN $5 = 'approved' THEN NOW() ELSE NULL END,
          CASE WHEN $5 IN ('pre_approved', 'approved') THEN NOW() ELSE NULL END,
          CASE WHEN $5 IN ('pre_approved', 'approved') THEN $13 ELSE 0 END
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          CASE WHEN $5 = 'approved' THEN NOW() ELSE NULL END
        );
      `,
      [
        budgetId,
        payload.clientName,
        payload.category,
        payload.description,
        payload.status,
        payload.deliveryDate ?? null,
        payload.totalPrice,
        financialValues.totalCost,
        financialValues.profitMargin,
        financialValues.profitValue,
        financialValues.laborCost,
        payload.notes ?? null,
        financialValues.totalCost,
      ],
    );

    await insertMaterials(client, budgetId, materialsWithProducts);
    await insertExpenseDepartments(client, budgetId, expenseDepartmentsWithCatalog);

    await client.query("COMMIT");

    const budget = await listByIdWithClient(client, budgetId);

    if (!budget) {
      throw new Error("Budget was not found after creation");
    }

    return budget;
  } catch (error) {
    await client.query("ROLLBACK");
    normalizePersistenceError(error);
  } finally {
    client.release();
  }
}

async function save(id: string, payload: SaveBudgetRecordInput): Promise<Budget | undefined> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const normalizedMaterials = payload.materials.map(normalizeMaterial);
    const normalizedExpenseDepartments = payload.expenseDepartments.map(normalizeExpenseDepartment);
    const materialsWithProducts = await resolveMaterialsWithProducts(client, id, normalizedMaterials);
    const expenseDepartmentsWithCatalog = await resolveExpenseDepartmentsWithCatalog(
      client,
      id,
      normalizedExpenseDepartments,
    );

    const financialValues = resolveInputFinancialValues({
      totalPrice: payload.totalPrice,
      totalCost: payload.totalCost,
      laborCost: payload.laborCost,
      profitMargin: payload.profitMargin,
      profitValue: payload.profitValue,
      materials: materialsWithProducts,
      expenseDepartments: expenseDepartmentsWithCatalog,
    });

    const updateResult = await client.query<BudgetRow>(
      `
        UPDATE public.budgets
        SET
          client_name = $2,
          category = $3,
          description = $4,
          status = $5,
          delivery_date = $6,
          total_price = $7,
          total_cost = $8,
          profit_margin = $9,
          profit_value = $10,
          labor_cost = $11,
          notes = $12,
          approved_at = $13,
          costs_applied_at = CASE
            WHEN $5 IN ('pre_approved', 'approved') THEN COALESCE(costs_applied_at, NOW())
            ELSE costs_applied_at
          END,
          costs_applied_value = CASE
            WHEN $5 IN ('pre_approved', 'approved') THEN $14
            ELSE costs_applied_value
          END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          client_name,
          category,
          description,
          status,
          delivery_date,
          total_price,
          total_cost,
          profit_margin,
          profit_value,
          labor_cost,
          notes,
          approved_at,
            costs_applied_at,
            costs_applied_value,
          created_at,
          updated_at;
      `,
      [
        id,
        payload.clientName,
        payload.category,
        payload.description,
        payload.status,
        payload.deliveryDate,
        payload.totalPrice,
        financialValues.totalCost,
        financialValues.profitMargin,
        financialValues.profitValue,
        financialValues.laborCost,
        payload.notes,
        payload.approvedAt,
        financialValues.totalCost,
      ],
    );

    if (updateResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return undefined;
    }

    await client.query(
      `
        DELETE FROM public.budget_materials
        WHERE budget_id = $1;
      `,
      [id],
    );

    await insertMaterials(client, id, materialsWithProducts);

    await client.query(
      `
        DELETE FROM public.budget_expense_departments
        WHERE budget_id = $1;
      `,
      [id],
    );

    await insertExpenseDepartments(client, id, expenseDepartmentsWithCatalog);

    await client.query("COMMIT");

    return listByIdWithClient(client, id);
  } catch (error) {
    await client.query("ROLLBACK");
    normalizePersistenceError(error);
  } finally {
    client.release();
  }
}

async function approve(id: string): Promise<Budget | undefined> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query<BudgetRow>(
      `
        SELECT
          id,
          client_name,
          category,
          description,
          status,
          delivery_date,
          total_price,
          total_cost,
          profit_margin,
          profit_value,
          labor_cost,
          notes,
          approved_at,
          costs_applied_at,
          costs_applied_value,
          created_at,
          updated_at
        FROM public.budgets
        WHERE id = $1
        FOR UPDATE;
      `,
      [id],
    );

    if (currentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const currentBudget = currentResult.rows[0];

    if (currentBudget.status !== "approved") {
      await deductBudgetMaterialsFromStock(client, id);

      await client.query(
        `
          UPDATE public.budgets
          SET
            status = 'approved',
            approved_at = COALESCE(approved_at, NOW()),
            costs_applied_at = COALESCE(costs_applied_at, NOW()),
            costs_applied_value = COALESCE(NULLIF(total_cost, 0), costs_applied_value, 0),
            updated_at = NOW()
          WHERE id = $1;
        `,
        [id],
      );
    }

    await client.query("COMMIT");

    return listByIdWithClient(client, id);
  } catch (error) {
    await client.query("ROLLBACK");
    normalizePersistenceError(error);
  } finally {
    client.release();
  }
}

export const budgetRepository = {
  findAll,
  findById,
  create,
  save,
  approve,
  listExpenseDepartmentsCatalog,
};
