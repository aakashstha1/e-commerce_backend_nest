import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { DBModule } from './database/db.module';
import { ConfigModule } from '@nestjs/config';
import dbConfig from './config/db-config';
import hashingConfig from './config/hashing-config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [dbConfig, hashingConfig],
      envFilePath: '.env',
    }),
    DBModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
