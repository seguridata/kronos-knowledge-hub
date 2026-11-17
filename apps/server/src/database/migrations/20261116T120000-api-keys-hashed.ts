import { Kysely, sql } from 'kysely';

/**
 * API keys opacas (kr_...), guardadas como HMAC-SHA256.
 * Las columnas son nullable para no romper filas heredadas del esquema anterior.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('api_keys')
    .addColumn('prefix', 'varchar(16)')
    .addColumn('key_hash', 'varchar(64)')
    .addColumn('scope', 'varchar(16)', (col) => col.notNull().defaultTo('read'))
    .execute();

  await db.schema
    .createIndex('idx_api_keys_key_hash')
    .on('api_keys')
    .column('key_hash')
    .unique()
    .where(sql.ref('key_hash'), 'is not', null)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_api_keys_key_hash').ifExists().execute();
  await db.schema
    .alterTable('api_keys')
    .dropColumn('prefix')
    .dropColumn('key_hash')
    .dropColumn('scope')
    .execute();
}
