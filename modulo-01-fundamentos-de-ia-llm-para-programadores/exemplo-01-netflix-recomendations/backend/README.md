# Netflix Recommendations API

API Node.js para catalogo e recomendacao de filmes. O treinamento e executado em um `Worker` separado para nao bloquear o processo HTTP. O worker treina um autoencoder com os metadados dos filmes e salva o vetor da camada `embedding` na coluna `movies.embedding` do PostgreSQL com `pgvector`.

## Requisitos

- Node.js 20 ou superior
- PostgreSQL com a extensao `vector` instalada
- Banco `exemplo_netflix` criado e populado com o SQL existente do exemplo

## Configuracao

```bash
cp .env.example .env
npm install
npm run dev
```

A aplicacao inicializa a coluna `embedding vector(32)` automaticamente. Para uma instalacao nova, crie o banco e execute o SQL de carga de filmes antes de iniciar a API.

## Popular usuarios

O seed usa `@faker-js/faker` e insere 1.000 usuarios por padrao, sem apagar os registros existentes:

```bash
npm run seed:users
```

Para escolher outra quantidade, informe o numero como argumento ou use `USERS_COUNT`:

```bash
npm run seed:users -- 5000
USERS_COUNT=2500 npm run seed:users
```

Cada usuario recebe nome, pais, idioma e idade entre 18 e 80 anos.

## Popular historico de filmes

O seed cria 5.000 relacionamentos aleatorios em `movies_watched_user`. Por padrao, aproximadamente 70% dos usuarios recebem pelo menos um filme, e os demais podem ficar sem historico:

```bash
npm run seed:watch-history
```

Para escolher a quantidade de relacionamentos e o percentual de usuarios ativos:

```bash
npm run seed:watch-history -- 10000
WATCHED_USERS_RATIO=0.5 npm run seed:watch-history
```

O comando usa apenas usuarios e filmes existentes, nao apaga relacionamentos anteriores e insere as datas `watched_at` aleatoriamente nos ultimos dois anos. Execute `npm run seed:users` e popule `movies` antes dele.

## Endpoints

- `GET /health`: verifica a conexao com o banco.
- `GET /api/movies?genre=Drama&minRating=7&limit=20`: lista filmes com filtros.
- `GET /api/movies/:id`: consulta um filme.
- `POST /api/movies`: cadastra um filme e invalida o embedding ate o proximo treinamento.
- `GET /api/recommendations?movieId=10&limit=10`: recomenda filmes semanticamente proximos ao filme informado.
- `GET /api/recommendations?genre=Comedy&year=2020`: recomenda por filtros e ordena por avaliacao/popularidade.
- `POST /api/training`: inicia o treinamento em segundo plano; retorna `202` enquanto estiver executando.
- `GET /api/training/status`: acompanha estado, epoca, loss e progresso.

Exemplo de fluxo:

```bash
curl -X POST http://localhost:3333/api/training
curl http://localhost:3333/api/training/status
curl 'http://localhost:3333/api/recommendations?movieId=1&limit=5'
```

O arquivo `schema.sql` contem a parte idempotente da migracao para ambientes em que a inicializacao automatica nao seja desejada.
