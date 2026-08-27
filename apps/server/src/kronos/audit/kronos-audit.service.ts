import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { ClsService } from 'nestjs-cls';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  ActorType,
  AuditLogPayload,
  EXCLUDED_AUDIT_EVENTS,
} from '../../common/events/audit-events';
import {
  AuditLogContext,
  IAuditService,
} from '../../integrations/audit/audit.service';
import {
  AUDIT_CONTEXT_KEY,
  AuditContext,
} from '../../common/middlewares/audit-context.middleware';

@Injectable()
export class KronosAuditService implements IAuditService {
  private readonly logger = new Logger(KronosAuditService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly cls: ClsService,
  ) {}

  async log(payload: AuditLogPayload): Promise<void> {
    const context = this.cls.get<AuditContext>(AUDIT_CONTEXT_KEY);
    if (!context?.workspaceId) {
      return;
    }

    await this.logWithContext(payload, {
      workspaceId: context.workspaceId,
      actorId: context.actorId ?? undefined,
      actorType: context.actorType,
      ipAddress: context.ipAddress ?? undefined,
      userAgent: context.userAgent ?? undefined,
    });
  }

  async logWithContext(
    payload: AuditLogPayload,
    context: AuditLogContext,
  ): Promise<void> {
    await this.logBatchWithContext([payload], context);
  }

  async logBatchWithContext(
    payloads: AuditLogPayload[],
    context: AuditLogContext,
  ): Promise<void> {
    const rows = payloads
      .filter((payload) => !EXCLUDED_AUDIT_EVENTS.has(payload.event))
      .map((payload) => ({
        workspaceId: context.workspaceId,
        actorId:
          context.actorId ??
          (payload.resourceType === 'user' ? payload.resourceId : undefined) ??
          null,
        actorType: context.actorType ?? 'user',
        event: payload.event,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId ?? null,
        spaceId: payload.spaceId ?? null,
        changes: (payload.changes ?? null) as never,
        metadata: {
          ...(payload.metadata ?? {}),
          ...(context.userAgent ? { userAgent: context.userAgent } : {}),
        } as never,
        ipAddress: context.ipAddress ?? null,
      }));

    if (rows.length === 0) {
      return;
    }

    try {
      await this.db.insertInto('audit').values(rows).execute();
    } catch (error) {
      this.logger.error('Failed to persist audit events', error);
    }
  }

  setActorId(actorId: string): void {
    const context = this.cls.get<AuditContext>(AUDIT_CONTEXT_KEY);
    if (context) {
      context.actorId = actorId;
      this.cls.set(AUDIT_CONTEXT_KEY, context);
    }
  }

  setActorType(actorType: ActorType): void {
    const context = this.cls.get<AuditContext>(AUDIT_CONTEXT_KEY);
    if (context) {
      context.actorType = actorType;
      this.cls.set(AUDIT_CONTEXT_KEY, context);
    }
  }

  async updateRetention(
    workspaceId: string,
    retentionDays: number,
  ): Promise<void> {
    await this.db
      .updateTable('workspaces')
      .set({ auditRetentionDays: retentionDays })
      .where('id', '=', workspaceId)
      .execute();
  }

  async list(params: {
    workspaceId: string;
    limit: number;
    cursor?: string;
    event?: string;
    resourceType?: string;
  }) {
    const limit = params.limit ?? 30;

    let query = this.db
      .selectFrom('audit')
      .leftJoin('users', 'users.id', 'audit.actorId')
      .select([
        'audit.id',
        'audit.event',
        'audit.resourceType',
        'audit.resourceId',
        'audit.spaceId',
        'audit.actorId',
        'audit.actorType',
        'audit.ipAddress',
        'audit.changes',
        'audit.metadata',
        'audit.createdAt',
        'users.name as actorName',
        'users.email as actorEmail',
      ])
      .where('audit.workspaceId', '=', params.workspaceId)
      .orderBy('audit.id', 'desc')
      .limit(limit + 1);

    if (params.cursor) {
      query = query.where('audit.id', '<', params.cursor);
    }
    if (params.event) {
      query = query.where('audit.event', '=', params.event);
    }
    if (params.resourceType) {
      query = query.where('audit.resourceType', '=', params.resourceType);
    }

    const rows = await query.execute();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items,
      meta: {
        limit,
        hasNextPage: hasMore,
        hasPrevPage: Boolean(params.cursor),
        nextCursor: hasMore ? items[items.length - 1].id : null,
        prevCursor: null,
      },
    };
  }
}
