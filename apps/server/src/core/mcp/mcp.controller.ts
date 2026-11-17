import {
  Controller,
  Delete,
  Get,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { McpToolsService } from './mcp-tools.service';

const METHOD_NOT_ALLOWED = {
  jsonrpc: '2.0',
  error: { code: -32000, message: 'Method not allowed.' },
  id: null,
};

/**
 * Servidor MCP (Streamable HTTP, sin estado) en POST /mcp.
 * Se autentica con una API key (Authorization: Bearer kr_...) y actúa con los
 * permisos del usuario dueño de la llave.
 */
@UseGuards(JwtAuthGuard)
@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(private readonly tools: McpToolsService) {}

  @Post()
  async handle(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const { user, workspace } = (req as any).user;
    const server = this.tools.buildServer({ user, workspace });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // sin estado: una petición, un servidor
      enableJsonResponse: true,
    });

    reply.hijack();
    reply.raw.on('close', () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req.raw, reply.raw, req.body);
    } catch (err) {
      this.logger.error(`MCP request failed: ${(err as Error).message}`);
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { 'Content-Type': 'application/json' });
        reply.raw.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          }),
        );
      }
    }
  }

  @Get()
  @Delete()
  methodNotAllowed(@Res() reply: FastifyReply) {
    return reply
      .code(405)
      .header('Allow', 'POST')
      .send(METHOD_NOT_ALLOWED);
  }
}
