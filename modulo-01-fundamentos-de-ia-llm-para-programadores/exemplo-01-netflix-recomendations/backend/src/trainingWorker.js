import { parentPort } from 'node:worker_threads';
import * as tf from '@tensorflow/tfjs';
import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;
const EMBEDDING_SIZE = 32;

function splitCategories(value) {
  return String(value || '')
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function makeRange(values) {
  const validValues = values.filter((value) => value !== null);
  return {
    min: validValues.length ? Math.min(...validValues) : 0,
    max: validValues.length ? Math.max(...validValues) : 1,
  };
}

function normalize(value, range) {
  if (value === null) return 0;
  if (range.max === range.min) return 0.5;
  return (value - range.min) / (range.max - range.min);
}

function createEncoder(movies) {
  const categoricalFields = ['type', 'genres', 'languages', 'popularity_category', 'primary_country'];
  const vocabularies = Object.fromEntries(
    categoricalFields.map((field) => {
      const values = new Set();
      movies.forEach((movie) => {
        const categories = field === 'genres' || field === 'languages'
          ? splitCategories(movie[field])
          : splitCategories(movie[field]);
        categories.forEach((category) => values.add(category));
      });
      return [field, [...values].sort()];
    }),
  );

  const ranges = Object.fromEntries([
    'release_year',
    'release_decade',
    'content_age',
    'imdb_rating',
    'popularity_percentile',
  ].map((field) => [
    field,
    makeRange(movies.map((movie) => numberValue(movie[field]))),
  ]));

  function encode(movie) {
    const features = [
      normalize(numberValue(movie.release_year), ranges.release_year),
      normalize(numberValue(movie.release_decade), ranges.release_decade),
      normalize(numberValue(movie.content_age), ranges.content_age),
      normalize(numberValue(movie.imdb_rating), ranges.imdb_rating),
      normalize(numberValue(movie.popularity_percentile), ranges.popularity_percentile),
    ];

    categoricalFields.forEach((field) => {
      const selected = new Set(splitCategories(movie[field]));
      vocabularies[field].forEach((category) => {
        features.push(selected.has(category) ? 1 : 0);
      });
    });

    return features;
  }

  return { encode };
}

async function saveEmbeddings(pool, movies, embeddings) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let index = 0; index < movies.length; index += 1) {
      const vector = `[${embeddings[index].map((value) => Number(value).toFixed(8)).join(',')}]`;
      await client.query(
        'UPDATE movies SET embedding = $1::vector WHERE id = $2',
        [vector, movies[index].id],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function train() {
  const pool = new Pool({ connectionString: config.databaseUrl });
  try {
    const result = await pool.query(`
      SELECT id, type, release_year, release_decade, content_age,
        genres, languages, imdb_rating, popularity_category,
        popularity_percentile, primary_country
      FROM movies
      ORDER BY id
    `);

    const movies = result.rows;
    if (!movies.length) {
      throw new Error('Nao existem filmes para treinar o modelo.');
    }

    const encoder = createEncoder(movies);
    const rows = movies.map(encoder.encode);
    const inputTensor = tf.tensor2d(rows);
    const model = tf.sequential();

    model.add(tf.layers.dense({
      inputShape: [rows[0].length],
      units: 64,
      activation: 'relu',
    }));
    model.add(tf.layers.dense({
      name: 'embedding',
      units: EMBEDDING_SIZE,
      activation: 'relu',
    }));
    model.add(tf.layers.dense({
      units: rows[0].length,
      activation: 'sigmoid',
    }));
    model.compile({
      optimizer: tf.train.adam(0.01),
      loss: 'meanSquaredError',
    });

    await model.fit(inputTensor, inputTensor, {
      epochs: config.trainingEpochs,
      batchSize: Math.min(32, movies.length),
      shuffle: movies.length > 1,
      verbose: 0,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          parentPort.postMessage({
            type: 'progress',
            progress: Math.round(((epoch + 1) / config.trainingEpochs) * 90),
            epoch: epoch + 1,
            loss: logs.loss,
          });
        },
      },
    });

    const embeddingModel = tf.model({
      inputs: model.inputs,
      outputs: model.getLayer('embedding').output,
    });
    const embeddingTensor = embeddingModel.predict(inputTensor);
    const embeddings = await embeddingTensor.array();

    await saveEmbeddings(pool, movies, embeddings);
    parentPort.postMessage({
      type: 'complete',
      moviesProcessed: movies.length,
    });

    inputTensor.dispose();
    embeddingTensor.dispose();
    model.dispose();
    embeddingModel.dispose();
  } finally {
    await pool.end();
  }
}

parentPort.on('message', async (message) => {
  if (message.type !== 'train') return;
  try {
    await train();
  } catch (error) {
    parentPort.postMessage({ type: 'error', error: error.message });
    process.exitCode = 1;
  } finally {
    parentPort.close();
  }
});
