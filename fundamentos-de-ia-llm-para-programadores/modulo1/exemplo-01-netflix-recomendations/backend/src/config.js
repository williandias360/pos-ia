import 'dotenv/config';

const requiredDatabaseUrl = process.env.DATABASE_URL;

if (!requiredDatabaseUrl) {
  throw new Error('DATABASE_URL nao foi definida. Copie .env.example para .env e configure o PostgreSQL.');
}

export const config = {
  port: Number(process.env.PORT || 3333),
  databaseUrl: requiredDatabaseUrl,
  trainingEpochs: Number(process.env.TRAINING_EPOCHS || 50),
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
