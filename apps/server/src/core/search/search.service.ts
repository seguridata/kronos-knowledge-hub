import { Injectable, Logger } from '@nestjs/common';
import { SearchDTO, SearchSuggestionDTO } from './dto/search.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { ShareRepo } from '@docmost/db/repos/share/share.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { EmbeddingService } from '../knowledge/embedding.service';
import { reciprocalRankFusion } from '../knowledge/rrf';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pgvector = require('pgvector');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tsquery = require('pg-tsquery')();

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private pageRepo: PageRepo,
    private shareRepo: ShareRepo,
    private spaceMemberRepo: SpaceMemberRepo,
    private pagePermissionRepo: PagePermissionRepo,
    private embeddings: EmbeddingService,
  ) {}

  async searchPage(
    searchParams: SearchDTO,
    opts: {
      userId?: string;
      workspaceId: string;
      /** Coincidir con CUALQUIER término (preguntas en lenguaje natural) en vez de todos. */
      matchAny?: boolean;
    },
  ): Promise<{ items: SearchResponseDto[] }> {
    const { query } = searchParams;

    if (query.length < 1) {
      return { items: [] };
    }
    const searchQuery = this.buildTsQuery(query, !!opts.matchAny);
    // El tsv combina 'spanish' + 'english' (ver migración pages-tsvector-spanish).
    const tsq = sql<string>`(to_tsquery('spanish', f_unaccent(${searchQuery})) || to_tsquery('english', f_unaccent(${searchQuery})))`;

    let queryResults = this.db
      .selectFrom('pages')
      .select([
        'id',
        'slugId',
        'title',
        'icon',
        'parentPageId',
        'creatorId',
        'createdAt',
        'updatedAt',
        sql<number>`ts_rank(tsv, ${tsq})`.as('rank'),
        sql<string>`ts_headline('spanish', text_content, ${tsq},'MinWords=9, MaxWords=10, MaxFragments=3')`.as(
          'highlight',
        ),
      ])
      .where('tsv', '@@', tsq)
      .$if(Boolean(searchParams.creatorId), (qb) =>
        qb.where('creatorId', '=', searchParams.creatorId),
      )
      .where('deletedAt', 'is', null)
      .orderBy('rank', 'desc')
      .limit(searchParams.limit || 25)
      .offset(searchParams.offset || 0);

    if (!searchParams.shareId) {
      queryResults = queryResults.select((eb) => this.pageRepo.withSpace(eb));
    }

    if (searchParams.spaceId) {
      // search by spaceId
      queryResults = queryResults.where('spaceId', '=', searchParams.spaceId);
    } else if (opts.userId && !searchParams.spaceId) {
      // only search spaces the user is a member of
      queryResults = queryResults
        .where(
          'spaceId',
          'in',
          this.spaceMemberRepo.getUserSpaceIdsQuery(opts.userId),
        )
        .where('workspaceId', '=', opts.workspaceId);
    } else if (searchParams.shareId && !searchParams.spaceId && !opts.userId) {
      // search in shares
      const shareId = searchParams.shareId;
      const share = await this.shareRepo.findById(shareId);
      if (!share || share.workspaceId !== opts.workspaceId) {
        return { items: [] };
      }

      const isRestricted =
        await this.pagePermissionRepo.hasRestrictedAncestor(share.pageId);
      if (isRestricted) {
        return { items: [] };
      }

      const pageIdsToSearch = [];
      if (share.includeSubPages) {
        const pageList = await this.pageRepo.getPageAndDescendantsExcludingRestricted(
          share.pageId,
          {
            includeContent: false,
          },
        );

        pageIdsToSearch.push(...pageList.map((page) => page.id));
      } else {
        pageIdsToSearch.push(share.pageId);
      }

      if (pageIdsToSearch.length > 0) {
        queryResults = queryResults
          .where('id', 'in', pageIdsToSearch)
          .where('workspaceId', '=', opts.workspaceId);
      } else {
        return { items: [] };
      }
    } else {
      return { items: [] };
    }

    //@ts-ignore
    let results: any[] = await queryResults.execute();

    // Filter results by page-level permissions (if user is authenticated)
    if (opts.userId && results.length > 0) {
      const pageIds = results.map((r: any) => r.id);
      const accessibleIds =
        await this.pagePermissionRepo.filterAccessiblePageIds({
          pageIds,
          userId: opts.userId,
          spaceId: searchParams.spaceId,
        });
      const accessibleSet = new Set(accessibleIds);
      results = results.filter((r: any) => accessibleSet.has(r.id));
    }

    //@ts-ignore
    const searchResults = results.map((result: SearchResponseDto) => {
      if (result.highlight) {
        result.highlight = result.highlight
          .replace(/\r\n|\r|\n/g, ' ')
          .replace(/\s+/g, ' ');
      }
      return result;
    });

    return { items: searchResults };
  }

  /**
   * AND (por defecto, búsqueda de la UI) o OR de términos (preguntas largas de
   * personas e IA, donde exigir todas las palabras no devuelve nada). En OR,
   * ts_rank ordena arriba lo que coincide con más términos.
   */
  private buildTsQuery(query: string, matchAny: boolean): string {
    if (matchAny) {
      const terms = query
        .split(/\s+/)
        .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
        .filter((t) => t.length > 1)
        .slice(0, 12);
      if (terms.length > 1) {
        return terms.map((t) => tsquery(t + '*')).join(' | ');
      }
    }
    return tsquery(query.trim() + '*');
  }

  private async embeddingsTableExists(): Promise<boolean> {
    const res = await sql<{ ok: boolean }>`
      SELECT to_regclass('public.page_embeddings') IS NOT NULL AS ok
    `.execute(this.db);
    return !!res.rows[0]?.ok;
  }

  /**
   * Búsqueda híbrida: texto (tsvector) + semántica (pgvector), fusionadas con
   * Reciprocal Rank Fusion. Los permisos se aplican DENTRO de la consulta
   * (pertenencia al espacio) y después por página (restricciones), igual que la
   * búsqueda por texto. Si no hay embeddings configurados, degrada a texto.
   */
  async searchHybrid(
    searchParams: SearchDTO,
    opts: { userId: string; workspaceId: string },
  ): Promise<{ items: any[]; mode: 'hybrid' | 'keyword' }> {
    const limit = Math.min(searchParams.limit || 10, 50);
    const CANDIDATES = 50;

    const keyword = await this.searchPage(
      { ...searchParams, limit: CANDIDATES, offset: 0 },
      { ...opts, matchAny: true },
    );

    if (!this.embeddings.isEnabled() || !(await this.embeddingsTableExists())) {
      return { items: keyword.items.slice(0, limit), mode: 'keyword' };
    }

    let semantic: {
      pageId: string;
      distance: number;
      snippetStart: number;
      snippetLength: number;
    }[];
    try {
      const vec = pgvector.toSql(
        await this.embeddings.embedQuery(searchParams.query),
      );
      semantic = await this.semanticCandidates(
        vec,
        searchParams,
        opts,
        CANDIDATES,
      );
    } catch (err) {
      this.logger.warn(
        `Búsqueda semántica no disponible, uso texto: ${(err as Error).message}`,
      );
      return { items: keyword.items.slice(0, limit), mode: 'keyword' };
    }

    if (semantic.length > 0) {
      const accessible = new Set(
        await this.pagePermissionRepo.filterAccessiblePageIds({
          pageIds: semantic.map((r) => r.pageId),
          userId: opts.userId,
          spaceId: searchParams.spaceId,
        }),
      );
      semantic = semantic.filter((r) => accessible.has(r.pageId));
    }

    const keywordById = new Map<string, any>(
      keyword.items.map((r: any) => [r.id, r]),
    );
    const semanticById = new Map(semantic.map((r) => [r.pageId, r]));

    const fused = reciprocalRankFusion([
      { ids: keyword.items.map((r: any) => r.id) },
      { ids: semantic.map((r) => r.pageId) },
    ]).slice(0, limit);

    // Páginas halladas solo por semántica: hay que traer sus datos.
    const missing = fused
      .filter((f) => !keywordById.has(f.id))
      .map((f) => f.id);
    const extra = new Map<string, any>();
    if (missing.length > 0) {
      const rows = await this.db
        .selectFrom('pages')
        .select([
          'id',
          'slugId',
          'title',
          'icon',
          'parentPageId',
          'creatorId',
          'createdAt',
          'updatedAt',
          'textContent',
        ])
        .select((eb) => this.pageRepo.withSpace(eb))
        .where('id', 'in', missing)
        .where('deletedAt', 'is', null)
        .where('workspaceId', '=', opts.workspaceId)
        .execute();
      for (const row of rows as any[]) extra.set(row.id, row);
    }

    const items = fused
      .map((f) => {
        const kw = keywordById.get(f.id);
        const sem = semanticById.get(f.id);
        const base = kw ?? extra.get(f.id);
        if (!base) return null;
        const { textContent, ...rest } = base;
        const snippet =
          kw?.highlight ??
          (sem && textContent
            ? String(textContent)
                .substring(
                  sem.snippetStart,
                  sem.snippetStart + Math.min(sem.snippetLength, 300),
                )
                .replace(/\s+/g, ' ')
            : null);
        return {
          ...rest,
          highlight: snippet,
          score: f.score,
          matchedBy: [kw ? 'keyword' : null, sem ? 'semantic' : null].filter(
            Boolean,
          ),
        };
      })
      .filter(Boolean);

    return { items, mode: 'hybrid' };
  }

  private async semanticCandidates(
    vec: string,
    searchParams: SearchDTO,
    opts: { userId: string; workspaceId: string },
    limit: number,
  ) {
    const model = this.embeddings.modelName;
    const maxDistance = Number(process.env.AI_SEMANTIC_MAX_DISTANCE ?? 0.65);
    const userSpaces = this.spaceMemberRepo.getUserSpaceIdsQuery(opts.userId);
    const spaceFilter = searchParams.spaceId
      ? sql`AND p.space_id = ${searchParams.spaceId}`
      : sql``;

    return this.db.transaction().execute(async (trx) => {
      // Escaneo iterativo (pgvector >= 0.8): sigue buscando si el filtro de
      // permisos descarta vecinos; en versiones previas el ajuste se ignora.
      await sql`SELECT set_config('hnsw.iterative_scan', 'relaxed_order', true)`.execute(
        trx,
      );
      await sql`SELECT set_config('hnsw.ef_search', '100', true)`.execute(trx);

      const res = await sql<{
        pageId: string;
        chunkStart: number;
        chunkLength: number;
        distance: number;
      }>`
        SELECT e.page_id, e.chunk_start, e.chunk_length,
               (e.embedding <=> ${vec}::vector) AS distance
        FROM page_embeddings e
        JOIN pages p ON p.id = e.page_id
        WHERE e.workspace_id = ${opts.workspaceId}
          AND e.model_name = ${model}
          AND p.workspace_id = ${opts.workspaceId}
          AND p.deleted_at IS NULL
          AND p.space_id IN (${userSpaces})
          ${spaceFilter}
        ORDER BY e.embedding <=> ${vec}::vector
        LIMIT ${limit * 3}
      `.execute(trx);

      // Mejor fragmento por página, bajo el umbral de relevancia.
      const best = new Map<string, any>();
      for (const row of res.rows) {
        // NaN (vector nulo) no es una coincidencia: la comparación > lo dejaría pasar.
        if (!Number.isFinite(Number(row.distance))) continue;
        if (row.distance > maxDistance) continue;
        if (!best.has(row.pageId)) {
          best.set(row.pageId, {
            pageId: row.pageId,
            distance: Number(row.distance),
            snippetStart: row.chunkStart,
            snippetLength: row.chunkLength,
          });
        }
      }
      return [...best.values()].slice(0, limit);
    });
  }

  async searchSuggestions(
    suggestion: SearchSuggestionDTO,
    userId: string,
    workspaceId: string,
  ) {
    let users = [];
    let groups = [];
    let pages = [];

    const limit = suggestion?.limit || 10;
    const query = suggestion.query.toLowerCase().trim();

    if (suggestion.includeUsers) {
      const userQuery = this.db
        .selectFrom('users')
        .select(['id', 'name', 'email', 'avatarUrl'])
        .where('workspaceId', '=', workspaceId)
        .where('deletedAt', 'is', null)
        .where((eb) =>
          eb.or([
            eb(
              sql`LOWER(f_unaccent(users.name))`,
              'like',
              sql`LOWER(f_unaccent(${`%${query}%`}))`,
            ),
            eb(sql`users.email`, 'ilike', sql`f_unaccent(${`%${query}%`})`),
          ]),
        )
        .limit(limit);

      users = await userQuery.execute();
    }

    if (suggestion.includeGroups) {
      groups = await this.db
        .selectFrom('groups')
        .select(['id', 'name', 'description'])
        .where((eb) =>
          eb(
            sql`LOWER(f_unaccent(groups.name))`,
            'like',
            sql`LOWER(f_unaccent(${`%${query}%`}))`,
          ),
        )
        .where('workspaceId', '=', workspaceId)
        .limit(limit)
        .execute();
    }

    if (suggestion.includePages) {
      let pageSearch = this.db
        .selectFrom('pages')
        .select(['id', 'slugId', 'title', 'icon', 'spaceId'])
        .select((eb) => this.pageRepo.withSpace(eb))
        .where((eb) =>
          eb(
            sql`LOWER(f_unaccent(pages.title))`,
            'like',
            sql`LOWER(f_unaccent(${`%${query}%`}))`,
          ),
        )
        .where('deletedAt', 'is', null)
        .where('workspaceId', '=', workspaceId)
        .limit(limit);

      // search all spaces the user has access to, prioritizing the current space
      const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);

      if (userSpaceIds?.length > 0) {
        pageSearch = pageSearch.where('spaceId', 'in', userSpaceIds);

        if (suggestion?.spaceId) {
          pageSearch = pageSearch.orderBy(
            sql`CASE WHEN pages."space_id" = ${suggestion.spaceId} THEN 0 ELSE 1 END`,
            'asc',
          );
        }

        pages = await pageSearch.execute();
      }

      // Filter by page-level permissions
      if (pages.length > 0) {
        const pageIds = pages.map((p) => p.id);
        const accessibleIds =
          await this.pagePermissionRepo.filterAccessiblePageIds({
            pageIds,
            userId,
          });
        const accessibleSet = new Set(accessibleIds);
        pages = pages.filter((p) => accessibleSet.has(p.id));
      }
    }

    return { users, groups, pages };
  }
}
