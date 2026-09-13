import { parentPort } from 'node:worker_threads';
import * as tf from '@tensorflow/tfjs';
let _globalCtx = {};
let _model = null;
const TRAINING_EPOCHS = 100;

const WEIGHTS = {
  POPULARITY: 0.7,
  TYPE: 0.6,
  RELEASE_YEAR: 0.5,
  GENRES: 0.4,
  LANGUAGE: 0.3,
  USER_AGE: 0.2,
  CONTENT_AGE: 0.1,
};

//Normaliza os valores para ir de 0-1
//Formula: (val - min) / (max - min)
//Exemplo: price = 129.99, minPrice = 39.99, maxPrice = 199.99 -> 0.56
const normalize = (value, min, max) => (value - min) / ((max - min) || 1);

function makeContext(movies, users) {
  const user_ages = users.map(user => user.age);
  //const usersCountries = [...new Set(users.map(user => user.country))];
  //const languages = [...new Set(users.map(user => user.language))];

  // const releases_years = [...new Set(movies.map(movie => movie.release_year))];
  // const releases_decades = [...new Set(movies.map(movie => movie.release_decade))];
  const content_ages = movies.map(movie => movie.content_age);

  const types = [...new Set(movies.map(movie => movie.type))];
  const genres = [...new Set(movies.map(movie => movie.genres))];
  const languages_movies = [...new Set(movies.map(movie => movie.language))];
  const imdb_ratings = movies.map(movie => movie.imdb_rating);
  const percent_popularities = movies.map(movie => movie.popularity_percentile);

  const minContentAge = Math.min(...content_ages);
  const maxContentAge = Math.max(...content_ages);
  const minPercent = Math.min(...percent_popularities);
  const maxPercent = Math.max(...percent_popularities);
  const minUserAge = Math.min(...user_ages);
  const maxUserAge = Math.max(...user_ages);

  // const usersCountriesIndex = Object.fromEntries(usersCountries.map((country, index) => {
  //   return [country, index]
  // }));

  // const languagesIndex = Object.fromEntries(languages.map((language, index) => {
  //   return [language, index]
  // }));

  const typesIndex = Object.fromEntries(types.map((type, index) => {
    return [type, index]
  }));

  const genresIndex = Object.fromEntries(genres.map((genre, index) => {
    return [genre, index]
  }));

  const languagesMoviesIndex = Object.fromEntries(languages_movies.filter((language) => language !== null).map((language, index) => {
    return [language, index]
  }));

  const imdbRatingsIndex = Object.fromEntries(imdb_ratings.map((imdb_rating, index) => {
    return [imdb_rating, index]
  }));

  const percentPopularityIndex = Object.fromEntries(percent_popularities.map((popularity, index) => {
    return [popularity, index]
  }));

  //calcular as médias
  const midContentAge = (minContentAge + maxContentAge) / 2;
  const midUserAge = (minUserAge + maxUserAge) / 2;
  const midPercent = (minPercent + maxPercent) / 2;
  const ageContentSums = {};
  const ageContentCounts = {};
  const ageUserSums = {};
  const ageUserCounts = {};

  users.forEach((user) => {
    user.watch_movies.forEach((movie) => {
      ageContentSums[movie.title] = (ageContentSums[movie.title] || 0) + movie.content_age;
      ageContentCounts[movie.title] = (ageContentCounts[movie.title] || 0) + 1;

      ageUserSums[movie.title] = (ageUserSums[movie.title] || 0) + user.age;
      ageUserCounts[movie.title] = (ageUserCounts[movie.title] || 0) + 1;
    })
  });

  const movieAvgAgeContentNormalize = Object.fromEntries(
    movies.map((movie) => {
      const avg = ageContentCounts[movie.title] ?
        ageContentSums[movie.title] / ageContentCounts[movie.title] : midContentAge

      return [movie.title, normalize(avg, minContentAge, maxContentAge)]
    })
  );

  const userAvgAgeNormalize = Object.fromEntries(
    movies.map((movie) => {
      const avg = ageUserCounts[movie.title] ?
        ageUserSums[movie.title] / ageUserCounts[movie.title] : midUserAge;

      return [movie.title, normalize(avg, minUserAge, maxUserAge)]
    })
  );

  const dimensions = 2 +
    types.length +
    genres.length;// +
  // languages_movies.length +
  // imdb_ratings.length +
  // percent_popularities;
  // Implement context creation logic here
  return {
    movies,
    users,
    typesIndex,
    genresIndex,
    languagesMoviesIndex,
    imdbRatingsIndex,
    percentPopularityIndex,
    minContentAge,
    maxContentAge,
    movieAvgAgeContentNormalize,
    userAvgAgeNormalize,
    minPercent,
    maxPercent,
    numTypes: types.length,
    numGenres: genres.length,
    numLanguagesMovies: languages_movies.length,
    numImdbRatings: imdb_ratings.length,
    numPercentPopularity: percent_popularities.length,
    dimensions
  };
}

const oneHotWeighted = (index, length, weight) =>
  tf.oneHot(index, length).cast('float32').mul(weight);

function encodeMovie(movie, context) {
  const contentAge = tf.tensor1d([
    (context.movieAvgAgeContentNormalize[movie.title] ?? 0.5) * WEIGHTS.CONTENT_AGE
  ]);

  const userAge = tf.tensor1d([
    (context.userAvgAgeNormalize[movie.title] ?? 0.5) * WEIGHTS.USER_AGE
  ]);

  const type = oneHotWeighted(
    context.typesIndex[movie.type],
    context.numTypes,
    WEIGHTS.TYPE
  );

  const genre = oneHotWeighted(
    context.genresIndex[movie.genres],
    context.numGenres,
    WEIGHTS.GENRES
  );

  // const language = oneHotWeighted(
  //   context.languagesMoviesIndex[movie.languages],
  //   context.numLanguagesMovies,
  //   WEIGHTS.LANGUAGE
  // );

  return tf.concat([
    contentAge,
    userAge,
    type,
    genre
  ]);
}

function encodeUser(user, context) {
  if (user.watch_movies) {
    return tf.stack(
      user.watch_movies.map(movie => encodeMovie(movie, context))
    )
      .mean(0)
      .reshape([
        1,
        context.dimensions
      ])
  }

  return tf.concat1d([
    tf.zeros(1),
    tf.tensor1d([
      normalize(user.age, context.minUserAge, context.maxUserAge)
      * WEIGHTS.USER_AGE
    ]),
    tf.zeros([context.numTypes]),
    tf.zeros([context.numGenres]),
  ]).reshape([1, context.dimensions])
}

function createTrainingData(context) {
  const inputs = [];
  const labels = [];
  const users = context.users.slice(0, 10);
  users.forEach(user => {
    const userVector = encodeUser(user, context).dataSync();
    context.movies.forEach(movie => {
      const movieVector = encodeMovie(movie, context).dataSync();

      const label = user.watch_movies.some(
        (watch_movie) => watch_movie.title === movie.title ? 1 : 0
      )

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