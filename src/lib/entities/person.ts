import type { Timestamped } from "./common";

export interface PersonAuth {
  passwordHash: string;
  lastLoginAt?: Date;
}

export interface Person extends Timestamped {
  username: string;
  displayName: string;
  email?: string;
  active: boolean;
  nameKeys: string[];
  auth?: PersonAuth;
}
