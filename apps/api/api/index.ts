/**
 * Ponto de entrada serverless (Vercel).
 *
 * Cada invocação reaproveita a instância do Nest em cache (warm start);
 * em cold start o bootstrap roda uma vez. Localmente continua valendo o
 * src/main.ts (npm run start:dev) — este arquivo é só para o Vercel.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import express, { Express, Request, Response } from 'express';
import { AppModule } from '../src/app.module';

let cachedServer: Express | null = null;

async function bootstrap(): Promise<Express> {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn'],
  });

  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();
  return server;
}

export default async function handler(req: Request, res: Response) {
  if (!cachedServer) {
    cachedServer = await bootstrap();
  }
  return cachedServer(req, res);
}
