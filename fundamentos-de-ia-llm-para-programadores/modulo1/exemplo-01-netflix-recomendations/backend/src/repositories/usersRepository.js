import { query } from '../db.js';

function userColumns(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return `
    ${prefix}id, ${prefix}name, ${prefix}country,
    ${prefix}language, ${prefix}age
  `;
}

export async function listUsers(filters) {
  const limit = 2000;
  const offset = 0;

  const result = await query(
    `SELECT ${userColumns()}
    from users
    ORDER BY id
    LIMIT ${limit} OFFSET ${offset}`
  );

  return result.rows;
}

export async function listUsersWatches() {
  const sql = `SELECT
                u.id AS user_id,
                u."name",
                u.age,
                u.country,
                u."language",
                m.id AS id_movie,
                m.title,
                m.type,
                m.release_year,
                m.release_decade,
                m.content_age,
                m.description,
                m.genres,
                m.languages,
                m.imdb_rating,
                m.popularity_category,
                m.popularity_percentile,
                m.primary_country,
                mwu.watched_at
              FROM
                users u
                INNER JOIN movies_watched_user mwu ON mwu.user_id = u.id
                INNER JOIN movies m ON m.id = mwu.movie_id
                ORDER BY u.id, mwu.id`;

  return (await query(sql)).rows;
}