import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initializeDatabase, query } from './db.js';
import {
  countMovies,
  createMovie,
  findMovieById,
  findRecommendations,
  listMovies,
} from './movieRepository.js';
import { getTrainingStatus, startTraining } from './trainingService.js';
import { listUsers } from './usersRepository.js';

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

function integerQuery(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

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

app.get('/health', async (_request, response, next) => {
  try {
    await query('SELECT 1');
    response.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/movies', async (request, response, next) => {
  try {
    const filters = readFilters(request.query);
    const [movies, total] = await Promise.all([listMovies(filters), countMovies()]);
    response.json({ data: movies, pagination: { total, limit: filters.limit, offset: filters.offset } });
  } catch (error) {
    next(error);
  }
});

app.get('/api/movies/:id', async (request, response, next) => {
  try {
    const movie = await findMovieById(Number.parseInt(request.params.id, 10));
    if (!movie) {
      response.status(404).json({ error: 'Filme nao encontrado.' });
      return;
    }
    response.json(movie);
  } catch (error) {
    next(error);
  }
});

app.post('/api/movies', async (request, response, next) => {
  try {
    if (!request.body.title) {
      response.status(400).json({ error: 'O campo title e obrigatorio.' });
      return;
    }
    const movie = await createMovie(request.body);
    response.status(201).json(movie);
  } catch (error) {
    next(error);
  }
});

app.get('/api/recommendations', async (request, response, next) => {
  try {
    const filters = {
      ...readFilters(request.query),
      movieId: request.query.movieId ? Number.parseInt(request.query.movieId, 10) : undefined,
    };
    const recommendations = await findRecommendations(filters);
    response.json({ data: recommendations, criteria: filters });
  } catch (error) {
    next(error);
  }
});

app.get('/api/training/status', (_request, response) => {
  response.json(getTrainingStatus());
});

app.post('/api/training', (request, response) => {
  const training = startTraining();
  response.status(training.state === 'running' ? 202 : 200).json(training);
});

app.get('/api/users', async (_request, response, next) => {
  try {
    const users = await listUsers();
    response.json({ data: users })
  } catch (error) {
    next(error)
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Erro interno do servidor.', detail: error.message });
});

initializeDatabase()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`API de recomendacoes ouvindo em http://localhost:${config.port}`);
    });
  })
  .catch((error) => {
    console.error('Nao foi possivel inicializar o banco de dados:', error.message);
    process.exitCode = 1;
  });
