export interface CacheEntryDoc {
  _id: string;
  key: string;
  value: unknown;
  expiresAt: Date;
  staleAt: Date;
  createdAt: Date;
}
