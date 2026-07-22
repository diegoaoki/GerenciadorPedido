import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

/** Exige que o usuário autenticado seja ADMIN (usar junto do guard global). */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { role?: string } }>();
    if (request.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Apenas o administrador pode fazer isso.');
    }
    return true;
  }
}
