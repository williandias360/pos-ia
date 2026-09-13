import { parentPort } from 'node:worker_threads';
import * as tf from '@tensorflow/tfjs';
let _globalCtx = {};
let _model = null;
const TRAINING_EPOCHS = 100;

const WEIGHTS = {
  IMDB_RATING: 0.8,
  POPULARITY: 0.7,
  GENRES: 0.6,
  TYPE: 0.5,
  USER_AGE: 0.4,
  LANGUAGE: 0.3,
  RELEASE_YEAR: 0.2,
  CONTENT_AGE: 0.1,
};

//Normaliza os valores para ir de 0-1
//Formula: (val - min) / (max - min)
//Exemplo: price = 129.99, minPrice = 39.99, maxPrice = 199.99 -> 0.56
const normalize = (value, min, max) => (value - min) / ((max - min) || 1);

const finiteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const numericRange = (values) => {
  const numericValues = values
    .map(finiteNumber)
    .filter(value => value !== null);

  if (!numericValues.length) {
    return { min: 0, max: 1 };
  }

  return {
    min: Math.min(...numericValues),
    max: Math.max(...numericValues),
  };
};

const normalizeFeature = (value, range, weight) => {
  const numericValue = finiteNumber(value);
  const normalizedValue = numericValue !== null
    ? normalize(numericValue, range.min, range.max)
    : 0.5;

  return tf.tensor1d([normalizedValue * weight]);
};

function makeContext(movies, users) {
  const genres = [...new Set(
    movies.flatMap(movie => String(movie.genres ?? '')
      .split(';')
      .map(genre => genre.trim())
      .filter(Boolean))
  )];
  const types = [...new Set(
    movies
      .map(movie => movie.type)
      .filter(type => type !== null && type !== undefined && type !== '')
  )];

  const imdbRatingRange = numericRange(movies.map(movie => movie.imdb_rating));
  const popularityRange = numericRange(movies.map(movie => movie.popularity_percentile));
  const releaseYearRange = numericRange(movies.map(movie => movie.release_year));
  const contentAgeRange = numericRange(movies.map(movie => movie.content_age));
  const userAgeRange = numericRange(users.map(user => user.age));

  const typesIndex = Object.fromEntries(types.map((type, index) => {
    return [type, index]
  }));

  const genresIndex = Object.fromEntries(genres.map((genre, index) => {
    return [genre, index]
  }));

  const dimensions = 5 +
    types.length +
    genres.length;

  return {
    movies,
    users,
    typesIndex,
    genresIndex,
    imdbRatingRange,
    popularityRange,
    releaseYearRange,
    contentAgeRange,
    userAgeRange,
    numTypes: types.length,
    numGenres: genres.length,
    dimensions
  };
}

const oneHotWeighted = (index, length, weight) =>
  index === undefined
    ? tf.zeros([length])
    : tf.oneHot(index, length).cast('float32').mul(weight);

const multiHotWeighted = (values, indexMap, length, weight) => {
  const vector = new Array(length).fill(0);

  values.forEach(value => {
    const index = indexMap[value];
    if (index !== undefined) vector[index] = weight;
  });

  return tf.tensor1d(vector);
};

function encodeMovie(movie, context) {
  const imdbRating = normalizeFeature(
    movie.imdb_rating,
    context.imdbRatingRange,
    WEIGHTS.IMDB_RATING
  );
  const popularity = normalizeFeature(
    movie.popularity_percentile,
    context.popularityRange,
    WEIGHTS.POPULARITY
  );
  const releaseYear = normalizeFeature(
    movie.release_year,
    context.releaseYearRange,
    WEIGHTS.RELEASE_YEAR
  );
  const contentAge = normalizeFeature(
    movie.content_age,
    context.contentAgeRange,
    WEIGHTS.CONTENT_AGE
  );

  const type = oneHotWeighted(
    context.typesIndex[movie.type],
    context.numTypes,
    WEIGHTS.TYPE
  );

  const genres = multiHotWeighted(
    String(movie.genres ?? '')
      .split(';')
      .map(genre => genre.trim())
      .filter(Boolean),
    context.genresIndex,
    context.numGenres,
    WEIGHTS.GENRES
  );

  return tf.concat([
    imdbRating,
    popularity,
    releaseYear,
    contentAge,
    tf.zeros([1]),
    type,
    genres
  ]);
}

function encodeUser(user, context) {
  const userAge = normalizeFeature(
    user.age,
    context.userAgeRange,
    WEIGHTS.USER_AGE
  );
  const watchedMovies = Array.isArray(user.watch_movies)
    ? user.watch_movies
    : [];

  if (!watchedMovies.length) {
    return tf.concat1d([
      tf.zeros([4]),
      userAge,
      tf.zeros([context.numTypes]),
      tf.zeros([context.numGenres]),
    ]).reshape([1, context.dimensions]);
  }

  const profile = tf.stack(
    watchedMovies.map(movie => encodeMovie(movie, context))
  ).mean(0);

  return tf.concat([
    profile.slice([0], [4]),
    userAge,
    profile.slice([5], [context.dimensions - 5]),
  ]).reshape([1, context.dimensions]);
}

function createTrainingData(context) {
  const inputs = [];
  const labels = [];
  const users = context.users.slice(0, 10);
  users.forEach(user => {
    const userVector = encodeUser(user, context).dataSync();
    const watchedMovies = Array.isArray(user.watch_movies)
      ? user.watch_movies
      : [];

    context.movies.forEach(movie => {
      const movieVector = encodeMovie(movie, context).dataSync();

      const label = watchedMovies.some(
        watchMovie => watchMovie.title === movie.title
      ) ? 1 : 0;

      //combinar usuario mais o filme
      inputs.push([...userVector, ...movieVector]);
      labels.push(label);
    })
  });

  return {
    xs: tf.tensor2d(inputs),
    ys: tf.tensor2d(labels, [labels.length, 1]),
    inputDimention: context.dimensions * 2
  }
}

async function configureNeuralNetAndTrain(trainData) {
  const model = tf.sequential();

  model.add(
    tf.layers.dense({
      inputShape: [trainData.inputDimention],
      units: 128,
      activation: 'relu'
    }));

  model.add(
    tf.layers.dense({
      units: 64,
      activation: 'relu'
    }));

  model.add(
    tf.layers.dense({
      units: 32,
      activation: 'relu'
    }));

  model.add(
    tf.layers.dense({
      units: 1,
      activation: 'sigmoid'
    }));

  model.compile({
    optimizer: tf.train.adam(0.01),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });

  await model.fit(trainData.xs, trainData.ys, {
    epochs: TRAINING_EPOCHS,
    batchSize: 32,
    shuffle: true,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        parentPort.postMessage({
          type: 'progress',
          epoch: epoch + 1,
          progress: Math.round(((epoch + 1) / TRAINING_EPOCHS) * 100),
          logs: Object.fromEntries(
            Object.entries(logs ?? {}).map(([key, value]) => [key, Number(value)])
          ),
        });
      }
    }
  });
}

async function trainModel({ users = [], movies = [] } = {}) {
  try {

    users = users.slice(0, 500);
    movies = movies.slice(0, 1000);
    const context = makeContext(movies, users);
    context.moviesVectors = movies.map((movie) => {
      return {
        title: movie.title,
        meta: { ...movie },
        vector: encodeMovie(movie, context).dataSync()
      }
    });

    _globalCtx = context;

    const trainData = createTrainingData(context);
    console.log('vai treinar o modelo');
    _model = await configureNeuralNetAndTrain(trainData);

    return context;
  } catch (err) {
    console.log('err', err);
    throw err;
  }
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