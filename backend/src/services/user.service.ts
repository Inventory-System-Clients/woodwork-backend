import { CreateUserInput, UpdateUserInput, User } from "../models/user.model";
import { userRepository } from "../repositories/user.repository";
import { AppError } from "../utils/app-error";

function listUsers(): User[] {
  return userRepository.findAll();
}

function getUserById(id: string): User {
  const user = userRepository.findById(id);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
}

function createUser(payload: CreateUserInput): User {
  const emailInUse = userRepository.findByEmail(payload.email);

  if (emailInUse) {
    throw new AppError("Email is already in use", 409);
  }

  return userRepository.create(payload);
}

function updateUser(id: string, payload: UpdateUserInput): User {
  const existingUser = userRepository.findById(id);

  if (!existingUser) {
    throw new AppError("User not found", 404);
  }

  if (payload.email && payload.email !== existingUser.email) {
    const emailInUse = userRepository.findByEmail(payload.email);

    if (emailInUse && emailInUse.id !== id) {
      throw new AppError("Email is already in use", 409);
    }
  }

  const updatedUser = userRepository.update(id, payload);

  if (!updatedUser) {
    throw new AppError("User not found", 404);
  }

  return updatedUser;
}

function deleteUser(id: string): void {
  const wasDeleted = userRepository.remove(id);

  if (!wasDeleted) {
    throw new AppError("User not found", 404);
  }
}

export const userService = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};