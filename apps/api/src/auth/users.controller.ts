import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from './admin.guard';
import { AuthService } from './auth.service';

class UpdateStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}

/** Gerenciamento de usuários — somente ADMIN. */
@ApiTags('users')
@UseGuards(AdminGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  list() {
    return this.prisma.user.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });
  }

  /** Reseta a senha: gera temporária e obriga troca no próximo login. */
  @Patch(':id/reset-password')
  resetPassword(@Param('id') id: string) {
    return this.auth.resetPassword(id);
  }

  /** Marca o usuário para trocar a senha no próximo login. */
  @Patch(':id/require-password-change')
  requirePasswordChange(@Param('id') id: string) {
    return this.auth.requirePasswordChange(id);
  }

  /** Aprovar (ACTIVE) ou bloquear (BLOCKED) um usuário. */
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Usuário não encontrado');
    if (user.role === 'ADMIN') {
      throw new BadRequestException('Não é possível alterar o administrador.');
    }
    return this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: { id: true, name: true, email: true, status: true },
    });
  }
}
