import { query } from '../db.js';

function movieColumns(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return `
    ${prefix}id, ${prefix}title, ${prefix}type, ${prefix}release_year, ${prefix}release_decade,
    ${prefix}content_age, ${prefix}description, ${prefix}genres, ${prefix}languages,
    ${prefix}imdb_rating, ${prefix}popularity_category, ${prefix}popularity_percentile,
    ${prefix}primary_country, ${prefix}embedding IS NOT NULL AS has_embedding
  `;
}

function addFilters(filters, params, where = [], alias = '') {
  const prefix = alias ? `${alias}.` : '';
  if (filters.genre) {
    params.push(`%${filters.genre}%`);
    where.push(`${prefix}genres ILIKE $${params.length}`);
  }
  if (filters.type) {
    params.push(filters.type);
    where.push(`${prefix}type ILIKE $${params.length}`);
  }
  if (filters.language) {
    params.push(`%${filters.language}%`);
    where.push(`${prefix}languages ILIKE $${params.length}`);
  }
  if (filters.year) {
    params.push(filters.year);
    where.push(`${prefix}release_year = $${params.length}`);
  }
  if (filters.minRating) {
    params.push(filters.minRating);
    where.push(`${prefix}imdb_rating >= $${params.length}`);
  }
  if (filters.maxRating) {
    params.push(filters.maxRating);
    where.push(`${prefix}imdb_rating <= $${params.length}`);
  }
  return where;
}

export async function listMovies(filters) {
  const params = [];
  const where = addFilters(filters, params);
  const limit = filters.limit;
  const offset = filters.offset;

  params.push(limit, offset);
  const result = await query(
    `SELECT ${movieColumns()}
    FROM movies
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY release_year DESC NULLS LAST, title ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return result.rows;
}

export async function countMovies() {
  const result = await query('SELECT COUNT(*)::INTEGER AS total FROM movies');
  return result.rows[0].total;
}

export async function findMovieById(id) {
  const result = await query(`SELECT ${movieColumns()} FROM movies WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function createMovie(movie) {
  const result = await query(
    `INSERT INTO movies (
      title, type, release_year, release_decade, content_age, description,
      genres, languages, imdb_rating, popularity_category,
      popularity_percentile, primary_country
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING ${movieColumns()}`,
    [
      movie.title,
      movie.type,
      movie.release_year,
      movie.release_decade,
      movie.content_age,
      movie.description,
      movie.genres,
      movie.languages,
      movie.imdb_rating,
      movie.popularity_category,
      movie.popularity_percentile,
      movie.primary_country,
    ],
  );

  return result.rows[0];
}

export async function findRecommendations(filters) {
  const params = [];
  const where = [];
  let orderBy = 'f.imdb_rating DESC NULLS LAST, f.popularity_percentile DESC NULLS LAST, f.release_year DESC NULLS LAST';

  if (filters.movieId) {
    params.push(filters.movieId);
    where.push('f.id <> target.id');
    where.push('target.embedding IS NOT NULL');
    where.push('f.embedding IS NOT NULL');
    orderBy = 'f.embedding <=> target.embedding ASC';
  }

  addFilters(filters, params, where, 'f');
  params.push(filters.limit);

  const source = filters.movieId
    ? 'FROM movies AS f CROSS JOIN movies AS target'
    : 'FROM movies AS f';
  const targetCondition = filters.movieId ? 'target.id = $1 AND' : '';
  const sql = `
    SELECT ${movieColumns('f')}
    ${source}
    WHERE ${targetCondition} ${where.join(' AND ') || 'TRUE'}
    ORDER BY ${orderBy}
    LIMIT $${params.length}
  `;

  const result = await query(sql, params);
  return result.rows;
}
