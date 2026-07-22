import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * Autenticação de administrador único, com credenciais via variáveis de
 * ambiente (ADMIN_EMAIL / ADMIN_PASSWORD). Emite JWT válido por 30 dias.
 * Quando houver mais usuários, isso evolui para uma tabela `User`.
 */
@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  async login(email: string, password: string) {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      throw new ServiceUnavailableException(
        'Login não configurado: defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente.',
      );
    }

    if (!this.safeEquals(email, adminEmail) || !this.safeEquals(password, adminPassword)) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    const token = await this.jwt.signAsync({ sub: 'admin', email });
    return { token, email };
  }

  /** Comparação em tempo constante (evita timing attacks). */
  private safeEquals(a: string, b: string): boolean {
    const ha = createHash('sha256').update(a).digest();
    const hb = createHash('sha256').update(b).digest();
    return timingSafeEqual(ha, hb);
  }
}
