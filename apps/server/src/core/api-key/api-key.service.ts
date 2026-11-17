import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { addDays } from 'date-fns';
import { ApiKeyRepo } from '@docmost/db/repos/api-key/api-key.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { ApiKey, User, Workspace } from '@docmost/db/types/entity.types';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { isUserDisabled } from '../../common/helpers';
import { ApiKeyScope } from './api-key.constants';
import { CreateApiKeyDto } from './dto/api-key.dto';
import { generateApiKey, hashApiKey } from './api-key.util';

export const DEFAULT_API_KEY_TTL_DAYS = 90;

export type AuthenticatedApiKey = {
  user: User;
  workspace: Workspace;
  apiKey: ApiKey;
};

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    private readonly apiKeyRepo: ApiKeyRepo,
    private readonly userRepo: UserRepo,
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly environmentService: EnvironmentService,
  ) {}

  /** Devuelve la llave en claro UNA sola vez; después solo existe su hash. */
  async create(creator: User, workspace: Workspace, dto: CreateApiKeyDto) {
    const { key, prefix } = generateApiKey();
    const expiresAt = addDays(
      new Date(),
      dto.expiresInDays ?? DEFAULT_API_KEY_TTL_DAYS,
    );

    const row = await this.apiKeyRepo.insert({
      name: dto.name.trim(),
      creatorId: creator.id,
      workspaceId: workspace.id,
      prefix,
      keyHash: hashApiKey(key, this.environmentService.getAppSecret()),
      scope: dto.scope ?? ApiKeyScope.READ,
      expiresAt,
    });

    this.logger.log(
      `API key creada id=${row.id} prefix=${prefix} scope=${row.scope} por user=${creator.id}`,
    );

    return {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      scope: row.scope,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      key,
    };
  }

  async list(workspaceId: string) {
    const items = await this.apiKeyRepo.listActive(workspaceId, 100);
    return { items };
  }

  async revoke(apiKeyId: string, workspaceId: string, actorId: string) {
    const existing = await this.apiKeyRepo.findById(apiKeyId, workspaceId);
    if (!existing) throw new NotFoundException('API key not found');

    await this.apiKeyRepo.revoke(apiKeyId, workspaceId);
    this.logger.log(`API key revocada id=${apiKeyId} por user=${actorId}`);
  }

  /**
   * Valida una llave. Todos los fallos devuelven el mismo 401 genérico para
   * no revelar si la llave existe, expiró o fue revocada.
   */
  async authenticate(
    token: string,
    requestWorkspaceId?: string | null,
  ): Promise<AuthenticatedApiKey> {
    const keyHash = hashApiKey(token, this.environmentService.getAppSecret());
    const apiKey = await this.apiKeyRepo.findActiveByHash(keyHash);

    if (!apiKey) throw new UnauthorizedException();
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) <= new Date()) {
      throw new UnauthorizedException();
    }
    if (requestWorkspaceId && requestWorkspaceId !== apiKey.workspaceId) {
      throw new UnauthorizedException();
    }

    const [workspace, user] = await Promise.all([
      this.workspaceRepo.findById(apiKey.workspaceId),
      this.userRepo.findById(apiKey.creatorId, apiKey.workspaceId),
    ]);

    // Si el dueño se desactiva o elimina, su llave deja de funcionar.
    if (!workspace || !user || isUserDisabled(user)) {
      throw new UnauthorizedException();
    }

    void this.apiKeyRepo
      .touchLastUsed(apiKey.id)
      .catch((err) =>
        this.logger.warn(`No se pudo actualizar last_used_at: ${err.message}`),
      );

    return { user, workspace, apiKey };
  }
}
