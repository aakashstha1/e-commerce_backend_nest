import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Global validation: strips unknown properties, rejects unexpected ones,
  // and auto-transforms payloads to their DTO types (needed for query DTOs like pagination).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: configService.get<string>('app.corsOrigin'),
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const port = configService.get<number>('app.port') ?? 5000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}/api/v1`);
}
bootstrap();
