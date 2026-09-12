import { listUsers, listUsersWatches } from '../repositories/usersRepository.js';


export async function listUsersWithWatches() {
  const mapMovie = ({
    id_movie,
    title,
    type,
    release_year,
    release_decade,
    content_age,
    genres,
    imdb_rating,
    popularity_percentile,
    primary_county,
    watch_at
  }) => {
    return {
      id_movie: id_movie,
      title: title,
      type: type,
      release_year: release_year,
      release_decade: release_decade,
      content_age: content_age,
      genres: genres,
      imdb_rating: imdb_rating,
      popularity_percentile: Math.round(popularity_percentile * 100) / 100,
      primary_county: primary_county,
      watch_at: watch_at
    }
  };

  const mapUser = ({ user_id, name, age, contry, language }) => {
    return {
      user_id,
      name,
      age,
      contry,
      language,
      watch_movies: []
    }
  };

  const list = [];
  const usersWatches = await listUsersWatches();

  if (!usersWatches.length)
    return list;

  const dicUser = new Map();
  let countUsers = 0;
  for (let index = 0; index < usersWatches.length; index++) {
    const item = usersWatches[index];

    if (dicUser.has(item.user_id)) {
      const position = dicUser.get(item.user_id);
      list[position].watch_movies.push(mapMovie(item));
      continue;
    }

    const user = mapUser(item);
    user.watch_movies.push(mapMovie(item));
    list.push(user);

    dicUser.set(user.user_id, countUsers);
    countUsers++;
  }

  return list;
}