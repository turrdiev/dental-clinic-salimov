import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from './prisma.js';

async function main() {
  console.log('Seeding database...');

  const doctors = await Promise.all([
    prisma.doctor.upsert({ where: { email: 'salimov@clinic.com' }, update: {}, create: { id: 'doc-salimov', name: 'Салимов Адыл', specialty: 'Главный врач / Имплантология', email: 'salimov@clinic.com', phone: '', color: 'teal' } }),
    prisma.doctor.upsert({ where: { email: 'yerzhan@clinic.com' }, update: {}, create: { id: 'doc-yerzhan', name: 'Ержан Нурланович', specialty: 'Терапевтическая стоматология', email: 'yerzhan@clinic.com', phone: '', color: 'indigo' } }),
    prisma.doctor.upsert({ where: { email: 'malika@clinic.com' }, update: {}, create: { id: 'doc-malika', name: 'Малика Назимовна', specialty: 'Ортодонтия', email: 'malika@clinic.com', phone: '', color: 'emerald' } }),
    prisma.doctor.upsert({ where: { email: 'vornavsky@clinic.com' }, update: {}, create: { id: 'doc-vornavsky', name: 'Ворнавский Глеб', specialty: 'Хирургия полости рта', email: 'vornavsky@clinic.com', phone: '', color: 'rose' } }),
    prisma.doctor.upsert({ where: { email: 'yusupov@clinic.com' }, update: {}, create: { id: 'doc-yusupov', name: 'Юсупов Ильяр', specialty: 'Эстетическая стоматология', email: 'yusupov@clinic.com', phone: '', color: 'amber' } }),
    prisma.doctor.upsert({ where: { email: 'turdiev@clinic.com' }, update: {}, create: { id: 'doc-turdiev', name: 'Турдиев Рахсан', specialty: 'Детская стоматология', email: 'turdiev@clinic.com', phone: '', color: 'purple' } }),
  ]);

  console.log('Doctors: ' + doctors.length);

  const users = [
    { username: 'salimov',   password: 'Xp7mK2qL',    role: 'CHIEF_DOCTOR' as const,  name: 'Салимов Адыл',      email: 'salimov@clinic.com',   doctorId: 'doc-salimov'   },
    { username: 'admin',     password: 'Nt4bR9wJ',   role: 'ADMINISTRATOR' as const, name: 'Админ',             email: 'admin@clinic.com',     doctorId: undefined        },
    { username: 'yerzhan',   password: 'Vc3nH8sF',    role: 'DOCTOR' as const,        name: 'Ержан Нурланович',  email: 'yerzhan@clinic.com',   doctorId: 'doc-yerzhan'   },
    { username: 'malika',    password: 'Zd6yG1pM',     role: 'DOCTOR' as const,        name: 'Малика Назимовна',  email: 'malika@clinic.com',    doctorId: 'doc-malika'    },
    { username: 'vornavsky', password: 'Qw5tB4kR',     role: 'DOCTOR' as const,        name: 'Ворнавский Глеб',   email: 'vornavsky@clinic.com', doctorId: 'doc-vornavsky' },
    { username: 'yusupov',   password: 'Lj2mX7cN',    role: 'DOCTOR' as const,        name: 'Юсупов Ильяр',      email: 'yusupov@clinic.com',   doctorId: 'doc-yusupov'   },
    { username: 'turdiev',   password: 'Hf9vD3wP',    role: 'DOCTOR' as const,        name: 'Турдиев Рахсан',    email: 'turdiev@clinic.com',   doctorId: 'doc-turdiev'   },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({ where: { username: u.username }, update: { passwordHash }, create: { username: u.username, passwordHash, role: u.role, name: u.name, email: u.email, doctorId: u.doctorId } });
  }

  console.log('Users: ' + users.length);
  console.log('\nЛогины и пароли:');
  console.log('----------------------------------------------------');
  for (const u of users) {
    console.log(u.role.padEnd(16) + ' | ' + u.username.padEnd(12) + ' | ' + u.password);
  }
  console.log('----------------------------------------------------');
  console.log('Готово!');
}

main()
  .catch((e) => { console.error('Ошибка:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

