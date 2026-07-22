import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Documentação interativa em /docs
  const config = new DocumentBuilder()
    .setTitle('Integração Multiplataforma — API')
    .setDescription('Hub central de catálogo, estoque e pedidos.')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.API_PORT ?? 3333;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 API rodando em http://localhost:${port}/api  (docs: /docs)`);
}
bootstrap();
