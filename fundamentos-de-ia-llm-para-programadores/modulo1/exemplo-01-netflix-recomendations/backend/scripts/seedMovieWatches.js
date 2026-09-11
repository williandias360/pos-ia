import { faker } from '@faker-js/faker';
import pg from 'pg';
import { config } from '../src/config.js';

const { Pool } = pg;
const DEFAULT_WATCHES_COUNT = 5000;
const DEFAULT_ACTIVE_USER_RATIO = 0.7;
const INSERT_BATCH_SIZE = 1000;

function getPositiveInteger(value, message) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(message);
  }
  return parsed;
}

function getWatchCount() {
  return getPositiveInteger(
    process.argv[2] || process.env.WATCH_HISTORY_COUNT || DEFAULT_WATCHES_COUNT,
    'A quantidade de relacionamentos deve ser um inteiro maior que zero.',
  );
}

function getActiveUserRatio() {
  const ratio = Number.parseFloat(process.env.WATCHED_USERS_RATIO || DEFAULT_ACTIVE_USER_RATIO);
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
    throw new Error('WATCHED_USERS_RATIO deve estar entre 0 e 1.');
  }
  return ratio;
}

function createWatch(userId, movieId) {
  return {
    userId,
    movieId,
    watchedAt: faker.date.between({
      from: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000),
      to: new Date(),
    }),
  };
}

function createRandomWatches(userIds, movieIds, requestedCount, activeUserRatio) {
  const shuffledUsers = faker.helpers.shuffle(userIds);
  const activeUserCount = Math.max(
    1,
    Math.min(
      userIds.length,
      requestedCount,
      Math.floor(userIds.length * activeUserRatio),
    ),
  );
  const activeUsers = shuffledUsers.slice(0, activeUserCount);
  const watchedPairs = new Set();
  const watches = [];
  const maximumUniqueWatches = activeUsers.length * movieIds.length;
  const targetCount = Math.min(requestedCount, maximumUniqueWatches);

  for (const userId of activeUsers) {
    const movieId = faker.helpers.arrayElement(movieIds);
    watchedPairs.add(`${userId}:${movieId}`);
    watches.push(createWatch(userId, movieId));
  }

  while (watches.length < targetCount) {
    const userId = faker.helpers.arrayElement(activeUsers);
    const movieId = faker.helpers.arrayElement(movieIds);
    const pairKey = `${userId}:${movieId}`;

    if (watchedPairs.has(pairKey)) continue;
    watchedPairs.add(pairKey);
    watches.push(createWatch(userId, movieId));
  }

  return { watches, activeUserCount };
}

async function insertWatches(client, watches) {
  for (let start = 0; start < watches.length; start += INSERT_BATCH_SIZE) {
    const batch = watches.slice(start, start + INSERT_BATCH_SIZE);
    const values = batch.flatMap((watch) => [watch.userId, watch.movieId, watch.watchedAt]);
    const placeholders = batch.map((_, index) => {
      const offset = index * 3;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
    });

    await client.query(
      `INSERT INTO movies_watched_user (user_id, movie_id, watched_at)
       VALUES ${placeholders.join(', ')}`,
      values,
    );
  }
}

async function seedMovieWatches() {
  const requestedCount = getWatchCount();
  const activeUserRatio = getActiveUserRatio();
  const pool = new Pool({ connectionString: config.databaseUrl });
  const client = await pool.connect();

  try {
    const [usersResult, moviesResult] = await Promise.all([
      client.query('SELECT id FROM users'),
      client.query('SELECT id FROM movies'),
    ]);

    if (!usersResult.rowCount) {
      throw new Error('Nao existem usuarios na tabela users. Execute npm run seed:users primeiro.');
    }
    if (!moviesResult.rowCount) {
      throw new Error('Nao existem filmes na tabela movies. Popule a tabela movies primeiro.');
    }

    const userIds = usersResult.rows.map(({ id }) => id);
    const movieIds = moviesResult.rows.map(({ id }) => id);
    const { watches, activeUserCount } = createRandomWatches(
      userIds,
      movieIds,
      requestedCount,
      activeUserRatio,
    );

    await client.query('BEGIN');
    await insertWatches(client, watches);
    await client.query('COMMIT');

    console.log(`${watches.length} relacionamentos inseridos em movies_watched_user.`);
    console.log(`${activeUserCount} de ${userIds.length} usuarios receberam historico.`);
    if (watches.length < requestedCount) {
      console.warn(`Limite aplicado: existem apenas ${watches.length} pares unicos possiveis.`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedMovieWatches().catch((error) => {
  console.error('Nao foi possivel popular o historico de filmes:', error.message);
  process.exitCode = 1;
});
