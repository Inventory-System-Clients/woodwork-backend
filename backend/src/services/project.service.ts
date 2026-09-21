import {
  CreateProjectCostInput,
  CreateProjectInput,
  ProjectCost,
  ProjectDashboard,
  ProjectDetail,
  ProjectListItem,
  UpdateProjectInput,
} from "../models/project.model";
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
  return projectRepository.createCost(projectId, input);
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
