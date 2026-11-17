import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { UserRole } from '../../common/helpers/types/permission';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto, RevokeApiKeyDto } from './dto/api-key.dto';

/**
 * Gestión de llaves. Solo con sesión de usuario (JWT) y rol owner/admin:
 * una API key nunca puede crear, listar ni revocar llaves (ver lista blanca
 * de rutas en api-key.constants.ts).
 */
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  private assertCanManage(user: User, req: any) {
    if (req.user?.apiKey) {
      throw new ForbiddenException();
    }
    if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() dto: CreateApiKeyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Req() req: any,
  ) {
    this.assertCanManage(user, req);
    return this.apiKeyService.create(user, workspace, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('list')
  async list(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Req() req: any,
  ) {
    this.assertCanManage(user, req);
    return this.apiKeyService.list(workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('revoke')
  async revoke(
    @Body() dto: RevokeApiKeyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Req() req: any,
  ) {
    this.assertCanManage(user, req);
    await this.apiKeyService.revoke(dto.apiKeyId, workspace.id, user.id);
  }
}
