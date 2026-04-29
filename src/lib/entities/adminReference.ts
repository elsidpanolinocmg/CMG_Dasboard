import type { Timestamped } from "./common";

export interface AdminReference extends Timestamped {
  id: string;
  label: string;
  href: string;
  description?: string;
  order: number;
}
