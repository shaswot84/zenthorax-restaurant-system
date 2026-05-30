import type { Role } from '../constants/roles';

export interface User {
  id: string;
  email: string;
  role: Role;
  fullName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  email: string;
  role: Role;
  fullName: string | null;
  avatarUrl: string | null;
}
