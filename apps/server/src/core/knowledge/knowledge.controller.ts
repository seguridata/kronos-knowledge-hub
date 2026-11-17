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
import { IsBoolean, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { UserRole } from '../../common/helpers/types/permission';
import { KnowledgeIndexerService } from './knowledge-indexer.service';

class ReindexDto {
  /** true: borra todos los vectores y reconstruye desde cero. */
  @IsOptional()
  @IsBoolean()
  full?: boolean;

  /** true: espera a que termine (útil en pruebas); si no, corre en segundo plano. */
  @IsOptional()
  @IsBoolean()
  wait?: boolean;
}

/** Operación del índice semántico. Solo sesión de owner/admin (no API keys). */
@UseGuards(JwtAuthGuard)
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly indexer: KnowledgeIndexerService) {}

  private assertAdmin(user: User, req: any) {
    if (req.user?.apiKey) throw new ForbiddenException();
    if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('status')
  async status(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Req() req: any,
  ) {
    this.assertAdmin(user, req);
    return this.indexer.status(workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('reindex')
  async reindex(
    @Body() dto: ReindexDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Req() req: any,
  ) {
    this.assertAdmin(user, req);
    const run = this.indexer.reindexAll({ full: dto.full });
    if (dto.wait) {
      await run;
      return this.indexer.status(workspace.id);
    }
    void run.catch(() => undefined);
    return { started: true };
  }
}
