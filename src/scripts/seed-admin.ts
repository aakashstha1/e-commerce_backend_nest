import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../modules/users/users.service';
import { UserRole } from '../modules/users/enums/user-role-enum';
import { AppModule } from '../app.module';

async function seedAdmin() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const configService = app.get(ConfigService);

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
    process.exit(1);
  }

  const existing = await usersService.findByEmail(email);
  if (existing) {
    console.log('Admin already exists, skipping.');
    await app.close();
    return;
  }

  const pepper = configService.get<string>('security.pepper');
  const hashedPassword = await bcrypt.hash(password + pepper, 10);

  await usersService.createUser({
    name: 'Super Admin',
    email,
    password: hashedPassword,
    role: UserRole.ADMIN,
  } as any);

  console.log(`Admin created: ${email}`);
  await app.close();
}

seedAdmin();
