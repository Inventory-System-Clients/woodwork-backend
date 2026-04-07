import { employeeRepository } from "../repositories/employee.repository";
import { teamRepository } from "../repositories/team.repository";
import { AppError } from "../utils/app-error";
import { CreateTeamInput, SetTeamMembersInput, Team, UpdateTeamInput } from "../models/team.model";

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

async function validateEmployeeIds(employeeIds: string[]): Promise<void> {
  if (employeeIds.length === 0) {
    return;
  }

  const employees = await employeeRepository.findByIds(employeeIds);

  if (employees.length !== employeeIds.length) {
    const foundIds = new Set(employees.map((employee) => employee.id));
    const missingIds = employeeIds.filter((employeeId) => !foundIds.has(employeeId));

    throw new AppError("Some employees were not found", 400, { missingIds });
  }
}

async function listTeams(): Promise<Team[]> {
  return teamRepository.findAll();
}

async function getTeamById(id: string): Promise<Team> {
  const team = await teamRepository.findById(id);

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  return team;
}

async function createTeam(payload: CreateTeamInput): Promise<Team> {
  const teamNameInUse = await teamRepository.findByName(payload.name);

  if (teamNameInUse) {
    throw new AppError("Team name is already in use", 409);
  }

  const team = await teamRepository.create({
    name: payload.name,
    category: payload.category,
    description: payload.description ?? null,
  });

  const memberIds = uniqueIds(payload.memberIds);

  if (memberIds.length === 0) {
    return team;
  }

  await validateEmployeeIds(memberIds);
  await teamRepository.replaceMembers(team.id, memberIds);

  return getTeamById(team.id);
}

async function updateTeam(id: string, payload: UpdateTeamInput): Promise<Team> {
  const existingTeam = await teamRepository.findById(id);

  if (!existingTeam) {
    throw new AppError("Team not found", 404);
  }

  if (payload.name && payload.name !== existingTeam.name) {
    const teamNameInUse = await teamRepository.findByName(payload.name);

    if (teamNameInUse && teamNameInUse.id !== id) {
      throw new AppError("Team name is already in use", 409);
    }
  }

  const updatedTeam = await teamRepository.update(id, {
    name: payload.name ?? existingTeam.name,
    category: payload.category ?? existingTeam.category,
    description: payload.description !== undefined ? payload.description : existingTeam.description,
  });

  if (!updatedTeam) {
    throw new AppError("Team not found", 404);
  }

  return getTeamById(updatedTeam.id);
}

async function deleteTeam(id: string): Promise<void> {
  const wasDeleted = await teamRepository.remove(id);

  if (!wasDeleted) {
    throw new AppError("Team not found", 404);
  }
}

async function setTeamMembers(id: string, payload: SetTeamMembersInput): Promise<Team> {
  const existingTeam = await teamRepository.findById(id);

  if (!existingTeam) {
    throw new AppError("Team not found", 404);
  }

  const employeeIds = uniqueIds(payload.employeeIds);

  await validateEmployeeIds(employeeIds);
  await teamRepository.replaceMembers(id, employeeIds);

  return getTeamById(id);
}

export const teamService = {
  listTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  setTeamMembers,
};
