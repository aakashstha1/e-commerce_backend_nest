import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import dbConfig from './config/db-config';
import hashingConfig from './config/hashing-config';
import { MongooseModule } from '@nestjs/mongoose';
import jwtConfig from './config/jwt-config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import appConfig from './config/app-config';
import { ProductModule } from './modules/product/product.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [dbConfig, hashingConfig, jwtConfig, appConfig],
      envFilePath: '.env',
    }),
    // DB connection
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
      }),
    }),
    UsersModule,
    AuthModule,
    ProductModule,
  ],
  controllers: [AppController],
  providers: [
    AppService, // Every route requires a valid JWT access token unless annotated with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Normalizes all thrown errors into a consistent JSON error shape.
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    // Structured request/response logging for every HTTP call.
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    // Structured request/response logging for every HTTP call.

    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
