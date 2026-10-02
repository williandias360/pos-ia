
import {
  countMovies,
  listMovies,
} from '../repositories/movieRepository.js';

function readFilters(queryParams) {
  return {
    genre: queryParams.genre?.trim(),
    type: queryParams.type?.trim(),
    language: queryParams.language?.trim(),
    year: queryParams.year ? Number.parseInt(queryParams.year, 10) : undefined,
    minRating: queryParams.minRating ? Number.parseFloat(queryParams.minRating) : undefined,
    maxRating: queryParams.maxRating ? Number.parseFloat(queryParams.maxRating) : undefined,
    limit: integerQuery(queryParams.limit, 20, 1, 100),
    offset: integerQuery(queryParams.offset, 0, 0, 100000),
  };
}

function integerQuery(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

export async function showListMovies(query) {
  const filters = readFilters(query);
  const [movies, total] = await Promise.all([listMovies(filters), countMovies()]);

  return {
    movies,
    total,
    filters,
  };
}