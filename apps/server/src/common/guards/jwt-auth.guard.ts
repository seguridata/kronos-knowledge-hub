import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Reflector } from '@nestjs/core';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { addDays } from 'date-fns';
import { ApiKeyService } from '../../core/api-key/api-key.service';
import { isApiKeyToken } from '../../core/api-key/api-key.util';
import { isRouteAllowedForScope } from '../../core/api-key/api-key.constants';
import { extractBearerTokenFromHeader } from '../helpers';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private environmentService: EnvironmentService,
    private apiKeyService: ApiKeyService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const bearer = extractBearerTokenFromHeader(req);
    if (isApiKeyToken(bearer)) {
      return this.authenticateApiKey(req, bearer);
    }

    return super.canActivate(context);
  }

  /**
   * Las API keys (kr_...) no son JWT: se validan contra su hash en BD y solo
   * pueden tocar las rutas permitidas para su alcance.
   */
  private async authenticateApiKey(req: any, token: string): Promise<boolean> {
    const { user, workspace, apiKey } = await this.apiKeyService.authenticate(
      token,
      req.raw?.workspaceId,
    );

    if (!isRouteAllowedForScope(apiKey.scope, req.method, req.url)) {
      throw new ForbiddenException('API key scope does not allow this endpoint');
    }

    req.user = { user, workspace, apiKey };
    return true;
  }

  handleRequest(err: any, user: any, info: any, ctx: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    this.setJoinedWorkspacesCookie(user, ctx);
    return user;
  }

  setJoinedWorkspacesCookie(user: any, ctx: ExecutionContext) {
    if (this.environmentService.isCloud()) {
      const req = ctx.switchToHttp().getRequest();
      const res = ctx.switchToHttp().getResponse();

      const workspaceId = user?.workspace?.id;
      let workspaceIds = [];
      try {
        workspaceIds = req.cookies.joinedWorkspaces
          ? JSON.parse(req.cookies.joinedWorkspaces)
          : [];
      } catch (err) {
        /* empty */
      }

      if (!workspaceIds.includes(workspaceId)) {
        workspaceIds.push(workspaceId);
      }

      res.setCookie('joinedWorkspaces', JSON.stringify(workspaceIds), {
        httpOnly: false,
        domain: '.' + this.environmentService.getSubdomainHost(),
        path: '/',
        expires: addDays(new Date(), 365),
        secure: this.environmentService.isHttps(),
      });
    }
  }
}
