import { type Kysely, sql } from 'kysely';

/**
 * Embeddings por fragmento (chunk) de página para búsqueda semántica.
 * La dimensión de la columna es fija (requisito del índice HNSW): se toma de
 * AI_EMBEDDING_DIMENSION al migrar (1536 por defecto). Si cambias de modelo con
 * otra dimensión, hay que recrear la tabla y reindexar.
 *
 * Si el servidor Postgres no tiene pgvector, la migración se omite y la
 * búsqueda semántica queda desactivada (la búsqueda por texto sigue igual).
 */
export async function up(db: Kysely<any>): Promise<void> {
  const available = await sql<{ n: string }>`
    SELECT count(*)::text AS n FROM pg_available_extensions WHERE name = 'vector'
  `.execute(db);

  if (Number(available.rows[0]?.n ?? 0) === 0) {
    console.warn(
      '[migration] pgvector no está disponible: se omite page_embeddings',
    );
    return;
  }

  const dim = Number.parseInt(process.env.AI_EMBEDDING_DIMENSION ?? '', 10) || 1536;
  if (dim < 2 || dim > 2000) {
    throw new Error(`AI_EMBEDDING_DIMENSION debe estar entre 2 y 2000 (HNSW): ${dim}`);
  }

  await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS page_embeddings (
      id uuid PRIMARY KEY DEFAULT gen_uuid_v7(),
      page_id uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      attachment_id uuid,
      model_name varchar NOT NULL,
      model_dimensions integer NOT NULL,
      embedding vector(${sql.raw(String(dim))}) NOT NULL,
      source_hash varchar(32) NOT NULL,
      chunk_index integer NOT NULL DEFAULT 0,
      chunk_start integer NOT NULL DEFAULT 0,
      chunk_length integer NOT NULL DEFAULT 0,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    )
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_page_embeddings_page_id ON page_embeddings (page_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_page_embeddings_ws_model ON page_embeddings (workspace_id, model_name)`.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS idx_page_embeddings_hnsw
    ON page_embeddings USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS page_embeddings`.execute(db);
}
