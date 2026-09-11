import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

export async function query(text, values) {
  return pool.query(text, values);
}

export async function initializeDatabase() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE TABLE IF NOT EXISTS movies (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255),
      type VARCHAR(30),
      release_year INTEGER,
      release_decade INTEGER,
      content_age SMALLINT,
      description VARCHAR(500),
      genres VARCHAR(300),
      languages VARCHAR(30),
      imdb_rating DECIMAL(3, 1),
      popularity_category VARCHAR(20),
      popularity_percentile FLOAT,
      primary_country VARCHAR(30),
      embedding vector(32)
    );

    ALTER TABLE movies ADD COLUMN IF NOT EXISTS embedding vector(32);

    CREATE INDEX IF NOT EXISTS movies_release_year_idx ON movies (release_year);
    CREATE INDEX IF NOT EXISTS movies_imdb_rating_idx ON movies (imdb_rating);
  `);
}
