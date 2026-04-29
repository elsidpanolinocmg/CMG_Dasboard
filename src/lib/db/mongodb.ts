import { MongoClient, Db, Filter as MongoFilter } from "mongodb";
import type {
  DbAdapter,
  DbCollection,
  DbCursor,
  Filter,
  FindOptions,
  Projection,
  SortSpec,
  UpdateOptions,
} from "./adapter";

class MongoCursor<T> implements DbCursor<T> {
  constructor(private cursor: ReturnType<ReturnType<Db["collection"]>["find"]>) {}

  sort(spec: SortSpec) {
    this.cursor.sort(spec);
    return this;
  }
  skip(n: number) {
    this.cursor.skip(n);
    return this;
  }
  limit(n: number) {
    this.cursor.limit(n);
    return this;
  }
  project(spec: Projection) {
    this.cursor.project(spec);
    return this;
  }
  async toArray(): Promise<T[]> {
    return (await this.cursor.toArray()) as unknown as T[];
  }
}

class MongoCollection<T = any> implements DbCollection<T> {
  constructor(private db: Db, private name: string) {}

  async findOne<R = T>(filter: Filter, options?: FindOptions): Promise<R | null> {
    const col = this.db.collection(this.name);
    return (await col.findOne(filter as MongoFilter<Record<string, unknown>>, {
      projection: options?.projection,
    })) as R | null;
  }

  find<R = T>(filter: Filter): DbCursor<R> {
    const col = this.db.collection(this.name);
    return new MongoCursor<R>(col.find(filter as MongoFilter<Record<string, unknown>>));
  }

  async updateOne(
    filter: Filter,
    update: { $set: Record<string, unknown> },
    options?: UpdateOptions,
  ): Promise<void> {
    const col = this.db.collection(this.name);
    await col.updateOne(filter as MongoFilter<Record<string, unknown>>, update, {
      upsert: options?.upsert,
    });
  }

  async insertOne(doc: Record<string, unknown>): Promise<void> {
    const col = this.db.collection(this.name);
    await col.insertOne(doc);
  }

  async deleteOne(filter: Filter): Promise<{ deletedCount: number }> {
    const col = this.db.collection(this.name);
    const res = await col.deleteOne(filter as MongoFilter<Record<string, unknown>>);
    return { deletedCount: res.deletedCount ?? 0 };
  }

  async distinct(field: string, filter?: Filter): Promise<unknown[]> {
    const col = this.db.collection(this.name);
    return await col.distinct(
      field,
      (filter ?? {}) as MongoFilter<Record<string, unknown>>,
    );
  }
}

export class MongoAdapter implements DbAdapter {
  readonly kind = "mongodb" as const;
  private client: MongoClient;
  private db: Db;

  private constructor(client: MongoClient, db: Db) {
    this.client = client;
    this.db = db;
  }

  static async connect(uri: string, dbName: string): Promise<MongoAdapter> {
    const client = await new MongoClient(uri).connect();
    return new MongoAdapter(client, client.db(dbName));
  }

  getCollection<T = unknown>(name: string): DbCollection<T> {
    return new MongoCollection<T>(this.db, name);
  }

  async listCollectionNames(): Promise<string[]> {
    const cols = await this.db.listCollections({}, { nameOnly: true }).toArray();
    return cols.map((c) => c.name).sort();
  }

  async close() {
    await this.client.close();
  }
}

export async function createMongoAdapter(): Promise<MongoAdapter> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) {
    throw new Error("MONGODB_URI and MONGODB_DB must be set to use the Mongo adapter");
  }
  return MongoAdapter.connect(uri, dbName);
}
