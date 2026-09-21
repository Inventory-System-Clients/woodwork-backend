import {
  CreateProjectCostInput,
  CreateProjectInput,
  ProjectCost,
  ProjectDashboard,
  ProjectDetail,
  ProjectListItem,
  UpdateProjectInput,
} from "../models/project.model";
import { employeeRepository } from "../repositories/employee.repository";
import { projectRepository } from "../repositories/project.repository";
import { AppError } from "../utils/app-error";
import { workHoursService } from "./work-hours.service";

async function requireProject(id: string) {
  const project = await projectRepository.findById(id);

  if (!project) {
    throw new AppError("Project not found", 404, { projectId: id });
  }

  return project;
}

/** Admin list, with the total cost of each project. */
async function listForAdmin(): Promise<ProjectListItem[]> {
  const projects = await projectRepository.list();

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    deadline: project.deadline,
    status: project.status,
    totalCost: project.totals.totalCost,
  }));
}

/** Employees only get the names of active projects, never values. */
async function listForEmployee(): Promise<ProjectListItem[]> {
  return projectRepository.listActiveNames();
}

async function getDetail(id: string): Promise<ProjectDetail> {
  const [project, costs, hoursByEmployee] = await Promise.all([
    requireProject(id),
    projectRepository.listCosts(id),
    projectRepository.hoursByEmployee(id),
  ]);

  return {
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    deadline: project.deadline,
    status: project.status,
    lastUpdateNote: project.lastUpdateNote,
    lastUpdateAt: project.lastUpdateAt,
    laborValue: project.laborValue,
    discountValue: project.discountValue,
    createdAt: project.createdAt,
    finishedAt: project.finishedAt,
    totals: project.totals,
    totalMinutes: project.totalMinutes,
    hoursByEmployee,
    costs,
  };
}

async function createProject(input: CreateProjectInput): Promise<ProjectDetail> {
  const id = await projectRepository.create(input);
  return getDetail(id);
}

async function updateProject(id: string, input: UpdateProjectInput): Promise<ProjectDetail> {
  const updated = await projectRepository.update(id, input);

  if (!updated) {
    throw new AppError("Project not found", 404, { projectId: id });
  }

  return getDetail(id);
}

async function addCost(projectId: string, input: CreateProjectCostInput): Promise<ProjectCost> {
  await requireProject(projectId);

  const base = {
    supplier: input.supplier?.trim() || null,
    isPaid: input.isPaid,
    paidAt: input.paidAt ?? null,
  };

  if (!input.isCommission) {
    return projectRepository.createCost(projectId, {
      ...base,
      description: input.description ?? "",
      amount: input.amount ?? 0,
      isCommission: false,
      commissionEmployeeId: null,
      commissionPercent: null,
    });
  }

  const employee = await employeeRepository.findById(input.commissionEmployeeId ?? "");

  if (!employee) {
    throw new AppError("Employee not found", 400, { employeeId: input.commissionEmployeeId });
  }

  let amount = input.amount ?? 0;
  let commissionPercent: number | null = null;

  if (input.commissionMode === "percent") {
    // Percentage of everything else already launched in the project (commissions excluded).
    const costsBase = await projectRepository.sumNonCommissionCosts(projectId);
    commissionPercent = input.commissionPercent ?? 0;
    amount = Math.round(costsBase * commissionPercent) / 100;
  }

  return projectRepository.createCost(projectId, {
    ...base,
    description: input.description || `Comissão - ${employee.name}`,
    amount,
    isCommission: true,
    commissionEmployeeId: employee.id,
    commissionPercent,
  });
}

async function setCostPaid(
  projectId: string,
  costId: string,
  isPaid: boolean,
  paidAt?: string,
): Promise<ProjectCost> {
  const cost = await projectRepository.setCostPaid(projectId, costId, isPaid, paidAt);

  if (!cost) {
    throw new AppError("Cost not found", 404, { projectId, costId });
  }

  return cost;
}

async function removeCost(projectId: string, costId: string): Promise<void> {
  const removed = await projectRepository.removeCost(projectId, costId);

  if (!removed) {
    throw new AppError("Cost not found", 404, { projectId, costId });
  }
}

async function getDashboard(): Promise<ProjectDashboard> {
  const today = workHoursService.formatDateInBusinessZone(new Date());
  const monthStart = `${today.slice(0, 8)}01`;

  const [totals, projects, hoursMonthMinutes] = await Promise.all([
    projectRepository.getDashboardTotals(),
    projectRepository.list(),
    projectRepository.sumMinutesInRange(monthStart, today),
  ]);

  const topProjects = [...projects]
    .sort((a, b) => b.totals.totalCost - a.totals.totalCost)
    .slice(0, 5)
    .map((project) => ({
      id: project.id,
      name: project.name,
      clientName: project.clientName,
      totalCost: project.totals.totalCost,
      totalMinutes: project.totalMinutes,
    }));

  return {
    activeProjects: totals.activeProjects,
    totalProjects: totals.totalProjects,
    overdueProjects: totals.overdueProjects,
    totals: { totalPaid: totals.totalPaid, totalToPay: totals.totalToPay, totalCost: totals.totalCost },
    hoursMonthMinutes,
    monthLabel: today.slice(0, 7),
    topProjects,
  };
}

export const projectService = {
  listForAdmin,
  listForEmployee,
  getDetail,
  createProject,
  updateProject,
  addCost,
  setCostPaid,
  removeCost,
  getDashboard,
};
