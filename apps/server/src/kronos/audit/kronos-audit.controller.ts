import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { UserRole } from '../../common/helpers/types/permission';
import { Feature } from '../../common/features';
import { LicenseCheckService } from '../../integrations/environment/license-check.service';
import { ListAuditDto } from './dto/list-audit.dto';
import { KronosAuditService } from './kronos-audit.service';

@UseGuards(JwtAuthGuard)
@Controller('kronos/audit')
export class KronosAuditController {
  constructor(
    private readonly auditService: KronosAuditService,
    private readonly licenseCheckService: LicenseCheckService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('list')
  async list(
    @Body() dto: ListAuditDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }

    if (
      !this.licenseCheckService.hasFeature(
        workspace.licenseKey ?? '',
        Feature.AUDIT_LOGS,
        workspace.plan ?? undefined,
      )
    ) {
      throw new ForbiddenException();
    }

    return this.auditService.list({
      workspaceId: workspace.id,
      limit: dto.limit ?? 30,
      cursor: dto.cursor,
      event: dto.event,
      resourceType: dto.resourceType,
    });
  }
}
