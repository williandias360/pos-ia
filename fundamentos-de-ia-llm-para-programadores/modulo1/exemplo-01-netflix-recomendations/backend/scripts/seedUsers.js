import { faker } from '@faker-js/faker';
import pg from 'pg';
import { config } from '../src/config.js';

const { Pool } = pg;
const DEFAULT_USERS_COUNT = 1000;
const MIN_AGE = 18;
const MAX_AGE = 80;
const LANGUAGES = ['Portuguese', 'English', 'Spanish', 'French', 'German'];

function getUsersCount() {
  const commandLineCount = process.argv[2];
  const configuredCount = commandLineCount || process.env.USERS_COUNT || DEFAULT_USERS_COUNT;
  const usersCount = Number.parseInt(configuredCount, 10);

  if (!Number.isInteger(usersCount) || usersCount < 1) {
    throw new Error('A quantidade de usuarios deve ser um inteiro maior que zero.');
  }

  return usersCount;
}

function createUser() {
  return {
    name: faker.person.fullName(),
    country: faker.location.country(),
    language: faker.helpers.arrayElement(LANGUAGES),
    age: faker.number.int({ min: MIN_AGE, max: MAX_AGE }),
  };
}

async function seedUsers() {
  const usersCount = getUsersCount();
  const users = Array.from({ length: usersCount }, createUser);
  const values = users.flatMap((user) => [user.name, user.country, user.language, user.age]);
  const placeholders = users.map((_, index) => {
    const offset = index * 4;
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
  });
  const pool = new Pool({ connectionString: config.databaseUrl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO users (name, country, language, age)
       VALUES ${placeholders.join(', ')}`,
      values,
    );
    await client.query('COMMIT');
    console.log(`${usersCount} usuarios inseridos na tabela users.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedUsers().catch((error) => {
  console.error('Nao foi possivel popular a tabela users:', error.message);
  process.exitCode = 1;
});
