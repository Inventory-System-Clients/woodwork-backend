import { randomUUID } from "node:crypto";
import { inMemoryDb } from "../database/in-memory-db";
import { CreateUserInput, UpdateUserInput, User } from "../models/user.model";

function findById(id: string): User | undefined {
  return inMemoryDb.users.find((user) => user.id === id);
}

function findByEmail(email: string): User | undefined {
  return inMemoryDb.users.find((user) => user.email === email);
}

function findAll(): User[] {
  return inMemoryDb.users;
}

function create(payload: CreateUserInput): User {
  const now = new Date();

  const user: User = {
    id: randomUUID(),
    name: payload.name,
    email: payload.email,
    role: payload.role,
    createdAt: now,
    updatedAt: now,
  };

  inMemoryDb.users.push(user);
  return user;
}

function update(id: string, payload: UpdateUserInput): User | undefined {
  const existingUser = findById(id);

  if (!existingUser) {
    return undefined;
  }

  if (payload.name !== undefined) {
    existingUser.name = payload.name;
  }

  if (payload.email !== undefined) {
    existingUser.email = payload.email;
  }

  if (payload.role !== undefined) {
    existingUser.role = payload.role;
  }

  existingUser.updatedAt = new Date();
  return existingUser;
}

function remove(id: string): boolean {
  const userIndex = inMemoryDb.users.findIndex((user) => user.id === id);

  if (userIndex === -1) {
    return false;
  }

  inMemoryDb.users.splice(userIndex, 1);
  return true;
}

export const userRepository = {
  findById,
  findByEmail,
  findAll,
  create,
  update,
  remove,
};