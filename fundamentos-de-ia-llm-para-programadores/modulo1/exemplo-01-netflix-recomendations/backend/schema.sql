CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE movies ADD COLUMN IF NOT EXISTS embedding vector(32);

CREATE INDEX IF NOT EXISTS movies_release_year_idx ON movies (release_year);
CREATE INDEX IF NOT EXISTS movies_imdb_rating_idx ON movies (imdb_rating);
