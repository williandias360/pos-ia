import { query } from './db.js';

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