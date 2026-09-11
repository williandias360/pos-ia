import { parentPort } from 'node:worker_threads';
import * as tf from '@tensorflow/tfjs';
let _globalCtx = {};
let _model = null;

const WEIGHTS = {

}

function makeContext(movies, users) {
  console.log('chegou aqui');
  const ages = users.map(user => user.age);
  const countries = [...new Set(users.map(user => user.country))];
  const languages = [...new Set(users.map(user => user.language))];

  const releases_years = movies.map(movie => movie.release_year);
  const releases_decades = movies.map(movie => movie.release_decade);
  const content_ages = movies.map(movie => movie.content_age);

  const types = [...new Set(movies.map(movie => movie.type))];
  const genres = [...new Set(movies.map(movie => movie.genres))];
  const languages_movies = [...new Set(movies.map(movie => movie.language))];
  const imdb_ratings = [...new Set(movies.map(movie => movie.imdb_rating))];

  const percent_popularities = movies.map(movie => movie.popularity_percentile);

  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages);
  const minPercent = Math.min(...percent_popularities);
  const maxPercent = Math.max(...percent_popularities);

  const countriesIndex = Object.fromEntries(countries.map((country, index) => {
    return [country, index]
  }));

  const languagesIndex = Object.fromEntries(languages.map((language, index) => {
    return [language, index]
  }));

  const typesIndex = Object.fromEntries(types.map((type, index) => {
    return [type, index]
  }));

  const genresIndex = Object.fromEntries(genres.map((genre, index) => {
    return [genre, index]
  }));

  const languagesMoviesIndex = Object.fromEntries(languages_movies.map((language, index) => {
    return [language, index]
  }));

  const imdbRatingsIndex = Object.fromEntries(imdb_ratings.map((imdb_rating, index) => {
    return [imdb_rating, index]
  }));

  //calcular as médias
  const midAge = (minAge + maxAge) / 2;
  const midPercent = (minPercent + maxPercent) / 2;
  debugger

  // Implement context creation logic here
  return {
    movies,
    users
  };
}

async function trainModel({ users = [], movies = [] } = {}) {
  const context = makeContext(movies, users);
  return context;
}


const handlers = {
  ['trainingModel']: trainModel
}

parentPort.on('message', async (message) => {
  const { action, ...data } = message;
  const handler = handlers[action];

  if (!handler) return;

  try {
    await handler(data);
    parentPort.postMessage({ type: 'complete' });
  } catch (error) {
    parentPort.postMessage({ type: 'error', error: error.message });
  } finally {
    parentPort.close();
  }
});