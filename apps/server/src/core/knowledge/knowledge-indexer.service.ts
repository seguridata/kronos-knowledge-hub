import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { EmbeddingService } from './embedding.service';
import { chunkText } from './chunker';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pgvector = require('pgvector');

const ADVISORY_LOCK_KEY = 727001;
const BATCH_PAGES = 25;

// Kysely usa CamelCasePlugin: las columnas del SQL crudo llegan en camelCase.
type StalePage = {
  id: string;
  title: string | null;
  textContent: string | null;
  spaceId: string;
  workspaceId: string;
  hash: string;
};

export type IndexRunResult = {
  indexed: number;
  removed: number;
  pending: number;
  skipped?: string;
};

/**
 * Mantiene al día los embeddings: detecta páginas nuevas o editadas comparando
 * un hash del contenido, re-trocea y re-embebe solo lo que cambió, y limpia lo
 * borrado. Sin colas: un cron por minuto con candado consultivo de Postgres
 * (seguro con varias instancias).
 */
@Injectable()
export class KnowledgeIndexerService {
  private readonly logger = new Logger(KnowledgeIndexerService.name);
  private running = false;

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly embeddings: EmbeddingService,
  ) {}

  async tableExists(): Promise<boolean> {
    const res = await sql<{ ok: boolean }>`
      SELECT to_regclass('public.page_embeddings') IS NOT NULL AS ok
    `.execute(this.db);
    return !!res.rows[0]?.ok;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduledTick() {
    if (!this.embeddings.isEnabled()) return;
    try {
      await this.runOnce();
    } catch (err) {
      this.logger.error(`Indexado falló: ${(err as Error).message}`);
    }
  }

  async runOnce(batch = BATCH_PAGES): Promise<IndexRunResult> {
    if (!this.embeddings.isEnabled()) {
      return { indexed: 0, removed: 0, pending: 0, skipped: 'embeddings-disabled' };
    }
    if (!(await this.tableExists())) {
      return { indexed: 0, removed: 0, pending: 0, skipped: 'no-pgvector-table' };
    }
    if (this.running) {
      return { indexed: 0, removed: 0, pending: 0, skipped: 'already-running' };
    }

    this.running = true;
    try {
      return await this.db.connection().execute(async (conn) => {
        const lock = await sql<{ ok: boolean }>`
          SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS ok
        `.execute(conn);
        if (!lock.rows[0]?.ok) {
          return { indexed: 0, removed: 0, pending: 0, skipped: 'locked-elsewhere' };
        }
        try {
          return await this.process(batch);
        } finally {
          await sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`.execute(conn);
        }
      });
    } finally {
      this.running = false;
    }
  }

  private async process(batch: number): Promise<IndexRunResult> {
    const model = this.embeddings.modelName;

    // 1) Limpia embeddings de páginas borradas, inexistentes o de otro modelo.
    const removed = await sql`
      DELETE FROM page_embeddings e
      WHERE e.model_name <> ${model}
         OR NOT EXISTS (
              SELECT 1 FROM pages p WHERE p.id = e.page_id AND p.deleted_at IS NULL
            )
    `.execute(this.db);

    // 2) Páginas sin embeddings vigentes (nuevas o editadas).
    const stale = await sql<StalePage>`
      SELECT p.id, p.title, p.text_content, p.space_id, p.workspace_id,
             md5(coalesce(p.title, '') || E'\n' || coalesce(p.text_content, '')) AS hash
      FROM pages p
      WHERE p.deleted_at IS NULL
        AND (btrim(coalesce(p.title, '')) <> '' OR btrim(coalesce(p.text_content, '')) <> '')
        AND NOT EXISTS (
          SELECT 1 FROM page_embeddings e
          WHERE e.page_id = p.id
            AND e.model_name = ${model}
            AND e.source_hash = md5(coalesce(p.title, '') || E'\n' || coalesce(p.text_content, ''))
        )
      ORDER BY p.updated_at DESC
      LIMIT ${batch}
    `.execute(this.db);

    let indexed = 0;
    for (const page of stale.rows) {
      try {
        await this.indexPage(page, model);
        indexed++;
      } catch (err) {
        // Error del proveedor (cuota, credenciales, red): se detiene el lote y
        // se reintenta en el siguiente ciclo, sin martillar el servicio.
        this.logger.error(
          `No se pudo indexar page=${page.id}: ${(err as Error).message}`,
        );
        break;
      }
    }

    const pending = await this.countPending(model);
    if (indexed > 0 || Number(removed.numAffectedRows ?? 0) > 0) {
      this.logger.log(
        `Indexado: ${indexed} páginas, ${removed.numAffectedRows ?? 0} embeddings limpiados, ${pending} pendientes`,
      );
    }
    return { indexed, removed: Number(removed.numAffectedRows ?? 0), pending };
  }

  private async indexPage(page: StalePage, model: string) {
    const title = page.title ?? '';
    const text = page.textContent ?? '';
    const chunks = chunkText(text);
    const pieces = chunks.length
      ? chunks
      : [{ start: 0, length: 0, text: '' }]; // página solo con título

    // El título se antepone a cada fragmento para dar contexto al embedding.
    const inputs = pieces.map((c) =>
      c.text ? `${title}\n\n${c.text}` : title,
    );
    const vectors = await this.embeddings.embedTexts(inputs);

    await this.db.transaction().execute(async (trx) => {
      await sql`DELETE FROM page_embeddings WHERE page_id = ${page.id}`.execute(trx);
      for (let i = 0; i < pieces.length; i++) {
        await sql`
          INSERT INTO page_embeddings
            (page_id, space_id, workspace_id, model_name, model_dimensions,
             embedding, source_hash, chunk_index, chunk_start, chunk_length)
          VALUES
            (${page.id}, ${page.spaceId}, ${page.workspaceId}, ${model},
             ${this.embeddings.dimension},
             ${pgvector.toSql(vectors[i])}::vector, ${page.hash},
             ${i}, ${pieces[i].start}, ${pieces[i].length})
        `.execute(trx);
      }
    });
  }

  private async countPending(model: string): Promise<number> {
    const res = await sql<{ n: string }>`
      SELECT count(*)::text AS n FROM pages p
      WHERE p.deleted_at IS NULL
        AND (btrim(coalesce(p.title, '')) <> '' OR btrim(coalesce(p.text_content, '')) <> '')
        AND NOT EXISTS (
          SELECT 1 FROM page_embeddings e
          WHERE e.page_id = p.id AND e.model_name = ${model}
            AND e.source_hash = md5(coalesce(p.title, '') || E'\n' || coalesce(p.text_content, ''))
        )
    `.execute(this.db);
    return Number(res.rows[0]?.n ?? 0);
  }

  async status(workspaceId: string) {
    const enabled = this.embeddings.isEnabled();
    const table = await this.tableExists();
    if (!table) {
      return { enabled, tableExists: false, model: this.embeddings.modelName };
    }
    const model = this.embeddings.modelName;
    const res = await sql<{ pages: string; chunks: string; indexed: string }>`
      SELECT
        (SELECT count(*) FROM pages p WHERE p.workspace_id = ${workspaceId} AND p.deleted_at IS NULL)::text AS pages,
        (SELECT count(*) FROM page_embeddings e WHERE e.workspace_id = ${workspaceId} AND e.model_name = ${model})::text AS chunks,
        (SELECT count(DISTINCT e.page_id) FROM page_embeddings e WHERE e.workspace_id = ${workspaceId} AND e.model_name = ${model})::text AS indexed
    `.execute(this.db);
    const r = res.rows[0];
    return {
      enabled,
      tableExists: true,
      model,
      dimension: this.embeddings.dimension,
      pages: Number(r.pages),
      indexedPages: Number(r.indexed),
      chunks: Number(r.chunks),
      pending: await this.countPending(model),
    };
  }

  /** Reindexa todo: vacía los vectores y procesa por lotes hasta terminar. */
  async reindexAll(opts: { full?: boolean; maxPages?: number } = {}) {
    if (opts.full) {
      await sql`DELETE FROM page_embeddings`.execute(this.db);
    }
    const cap = opts.maxPages ?? 5000;
    let total = 0;
    for (;;) {
      const r = await this.runOnce();
      total += r.indexed;
      if (r.skipped || r.pending === 0 || r.indexed === 0 || total >= cap) {
        return { ...r, indexed: total };
      }
    }
  }
}
