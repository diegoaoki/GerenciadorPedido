import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Autenticação com usuários no banco.
 *
 * - Cadastro é público, mas a conta nasce PENDING — só entra após o admin
 *   aprovar na tela Usuários.
 * - O admin inicial é criado automaticamente a partir de ADMIN_EMAIL /
 *   ADMIN_PASSWORD (env) na primeira autenticação.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /** Garante que o admin do env exista no banco (bootstrap idempotente). */
  private async ensureAdminSeed() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) return;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return;

    await this.prisma.user.create({
      data: {
        name: 'Administrador',
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
  }

  async login(email: string, password: string) {
    await this.ensureAdminSeed();

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    if (user.status === 'PENDING') {
      throw new ForbiddenException(
        'Cadastro aguardando aprovação do administrador.',
      );
    }
    if (user.status === 'BLOCKED') {
      throw new ForbiddenException('Acesso bloqueado. Fale com o administrador.');
    }

    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      token,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  }

  /** Usuário logado troca a própria senha (valida a atual). */
  async changePassword(userId: string, current: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(current, user.passwordHash))) {
      throw new UnauthorizedException('Senha atual incorreta');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 10),
        mustChangePassword: false,
      },
    });
    return { changed: true };
  }

  /** Admin reseta a senha de um usuário → senha temporária + troca obrigatória. */
  async resetPassword(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');

    const tempPassword = randomBytes(6).toString('base64url');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(tempPassword, 10),
        mustChangePassword: true,
      },
    });
    return { email: user.email, tempPassword };
  }

  /** Admin marca o usuário para trocar a senha no próximo login. */
  async requirePasswordChange(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: true },
    });
    return { required: true };
  }

  /** Cadastro público — conta criada como PENDING. */
  async register(name: string, email: string, password: string) {
    await this.ensureAdminSeed();

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Este e-mail já está cadastrado.');

    await this.prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'USER',
        status: 'PENDING',
      },
    });

    return {
      registered: true,
      message: 'Conta criada! Aguarde a aprovação do administrador para entrar.',
    };
  }
}
