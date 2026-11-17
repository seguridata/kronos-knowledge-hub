import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpToolsService } from './mcp-tools.service';
import { PageModule } from '../page/page.module';
import { PageAccessModule } from '../page/page-access/page-access.module';
import { SearchModule } from '../search/search.module';
import { SpaceModule } from '../space/space.module';
import { CaslModule } from '../casl/casl.module';

@Module({
  imports: [
    PageModule,
    PageAccessModule,
    SearchModule,
    SpaceModule,
    CaslModule,
  ],
  controllers: [McpController],
  providers: [McpToolsService],
})
export class McpModule {}
