import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Role } from './common/enums/role.enum';
import { ConcertsService } from './concerts/concerts.service';
import { UsersService } from './users/users.service';

const logger = new Logger('Seed');

async function seedAdmin(config: ConfigService, users: UsersService) {
  const email = config.get<string>('ADMIN_EMAIL');
  const password = config.get<string>('ADMIN_PASSWORD');
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans .env');
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD doit contenir au moins 8 caractères');
  }

  const existing = await users.findByEmail(email);
  if (!existing) {
    await users.adminCreate({ email, password, role: Role.Admin });
    logger.log(`Admin créé : ${email}`);
  } else if (existing.role !== Role.Admin) {
    await users.setRole(existing.id, Role.Admin);
    logger.log(`${email} promu administrateur`);
  } else {
    logger.log(`Admin déjà présent : ${email}`);
  }
}

async function seedDemoConcerts(concerts: ConcertsService) {
  const { total } = await concerts.findAll({});
  if (total > 0) {
    logger.log(`${total} concert(s) déjà présent(s), démo ignorée`);
    return;
  }

  const inDays = (days: number, hour: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  };

  const demo = [
    { title: 'Nuit Zouglou', band: 'Yodé&Siro', genre: 'zouglou', venue: 'Palais de la Culture, Treichville', date: inDays(21, 20), totalSeats: 1500, price: 10000 },
    { title: 'Coupé-Décalé Festival', band: 'Yopougon Groove', genre: 'coupé-décalé', venue: 'Parc des Expositions, Port-Bouët', date: inDays(35, 19), totalSeats: 8000, price: 15000 },
    { title: 'Rap Ivoire Live', band: '1x', genre: 'rap ivoire', venue: 'Palais de la Culture, Treichville', date: inDays(48, 21), totalSeats: 3000, price: 8000 },
    { title: 'Afro Sunset', band: 'Lagune Riddim', genre: 'afrobeat', venue: 'Plage de Grand-Bassam', date: inDays(60, 17), totalSeats: 2000, price: 12000 },
    { title: 'Soirée Jazz Intime', band: 'Kaizen Quartet', genre: 'jazz', venue: 'Théâtre de Cocody', date: inDays(14, 20), totalSeats: 120, price: 20000 },
    { title: 'Reggae Vibes', band: 'Abidjan Roots', genre: 'reggae', venue: 'Parc des Expositions, Port-Bouët', date: inDays(75, 18), totalSeats: 5000, price: 7000 },
  ];

  for (const concert of demo) {
    await concerts.create(concert);
  }
  logger.log(`${demo.length} concerts de démo créés`);
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    await seedAdmin(app.get(ConfigService), app.get(UsersService));
    if (process.argv.includes('--demo')) {
      await seedDemoConcerts(app.get(ConcertsService));
    }
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  logger.error(err instanceof Error ? err.message : err);
  process.exit(1);
});