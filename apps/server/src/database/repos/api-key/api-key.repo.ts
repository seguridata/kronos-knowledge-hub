import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB } from '../../types/kysely.types';
import { ApiKey, InsertableApiKey } from '@docmost/db/types/entity.types';

@Injectable()
export class ApiKeyRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async insert(values: InsertableApiKey): Promise<ApiKey> {
    return this.db
      .insertInto('apiKeys')
      .values(values)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findActiveByHash(keyHash: string): Promise<ApiKey | undefined> {
    return this.db
      .selectFrom('apiKeys')
      .selectAll()
      .where('keyHash', '=', keyHash)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async findById(id: string, workspaceId: string): Promise<ApiKey | undefined> {
    return this.db
      .selectFrom('apiKeys')
      .selectAll()
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async listActive(workspaceId: string, limit: number) {
    return this.db
      .selectFrom('apiKeys')
      .innerJoin('users', 'users.id', 'apiKeys.creatorId')
      .select([
        'apiKeys.id',
        'apiKeys.name',
        'apiKeys.prefix',
        'apiKeys.scope',
        'apiKeys.expiresAt',
        'apiKeys.lastUsedAt',
        'apiKeys.createdAt',
        'users.id as creatorId',
        'users.name as creatorName',
      ])
      .where('apiKeys.workspaceId', '=', workspaceId)
      .where('apiKeys.deletedAt', 'is', null)
      .where('apiKeys.keyHash', 'is not', null)
      .orderBy('apiKeys.createdAt', 'desc')
      .limit(limit)
      .execute();
  }

  async revoke(id: string, workspaceId: string): Promise<boolean> {
    const res = await this.db
      .updateTable('apiKeys')
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
    return Number(res.numUpdatedRows) > 0;
  }

  /** Evita una escritura por petición: solo actualiza si pasaron 5 min. */
  async touchLastUsed(id: string): Promise<void> {
    await this.db
      .updateTable('apiKeys')
      .set({ lastUsedAt: new Date() })
      .where('id', '=', id)
      .where((eb) =>
        eb.or([
          eb('lastUsedAt', 'is', null),
          eb('lastUsedAt', '<', sql<Date>`now() - interval '5 minutes'`),
        ]),
      )
      .execute();
  }
}
