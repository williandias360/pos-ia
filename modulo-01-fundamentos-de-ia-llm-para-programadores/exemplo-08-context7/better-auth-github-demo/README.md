# Better Auth + GitHub + SQLite

Demo mínimo em Next.js App Router com login social pelo GitHub, Better Auth e
persistência local em SQLite.

## Pré-requisitos

- Node.js 20 ou mais recente
- Uma aplicação OAuth criada no GitHub

## Configuração do GitHub

No GitHub, crie uma OAuth App em **Settings > Developer settings > OAuth Apps**.
Use esta callback URL:

```text
http://localhost:3000/api/auth/callback/github
```

Copie `.env.example` para `.env.local` e preencha `GITHUB_CLIENT_ID` e
`GITHUB_CLIENT_SECRET`.

## Instalação e execução

```bash
npm install
npx @better-auth/cli migrate
npm run dev
```

Abra http://localhost:3000.

O comando de migração cria as tabelas `user`, `session`, `account` e `verification`
no arquivo `better-auth.sqlite`. Esse arquivo é local e não deve ser versionado.

## Validação

```bash
npm run lint
npm run typecheck
```

## Documentação consultada

- Better Auth: integração com Next.js e `toNextJsHandler`.
- Better Auth: provider GitHub e callback `/api/auth/callback/github`.
- Better Auth: SQLite com `new Database("database.sqlite")`.
- Better Auth: client React com `createAuthClient` e `signIn.social`.This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
