import { Global, Module } from '@nestjs/common';
import { AUDIT_SERVICE } from '../integrations/audit/audit.service';
import { KronosAuditService } from './audit/kronos-audit.service';
import { KronosAuditController } from './audit/kronos-audit.controller';

@Global()
@Module({
  controllers: [KronosAuditController],
  providers: [
    KronosAuditService,
    {
      provide: AUDIT_SERVICE,
      useExisting: KronosAuditService,
    },
  ],
  exports: [AUDIT_SERVICE, KronosAuditService],
})
export class KronosModule {}
