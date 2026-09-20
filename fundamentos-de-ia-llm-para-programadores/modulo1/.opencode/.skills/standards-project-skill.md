SKILL: Padrões do Projeto (skill-project-standards.md)

Este documento estabelece as diretrizes obrigatórias de arquitetura, organização e código para desenvolvimento no ecossistema da aplicação. Todos os agentes desenvolvedores devem ler e seguir estas regras estritamente antes e durante a implementação.

---

## 1. BACKEND (.NET + Clean Architecture + Minimal APIs + DDD)

### 1.1. Estrutura de Projetos (Clean Architecture)

A solução deve ser dividida rigorosamente nas seguintes camadas e projetos por Bounded Context:

src/
├── Core/
│   ├── {Contexto}.Domain/       # Entidades, Value Objects, Exceções de Domínio, Interfaces de Repositório
│   └── {Contexto}.Application/  # Use Cases, DTOs (Input/Output), Services, Interfaces
├── Infrastructure/
│   └── {Contexto}.Data/         # DbContext (PostgreSQL), Repositórios, Mapeamentos EF Core, Migrations
└── Presentation/
└── {Contexto}.Api/          # Minimal APIs, Mapeamento de Endpoints, Injeção de Dependência
tests/
└── {Contexto}.Tests/            # Testes Unitários com xUnit

A aplicação é multi-tenant, ou seja, no token de autorização deverá conter as informações do `usuário autenticado`, `empresa logada` e `portal que a empresa pertence`.
Isso é necessário pois cada portal tem seu banco de dados e para as classes de dados deverá ser enviado via DI a string de conexão já formatada com a informação do banco de dados do portal.s 

### 1.2. Minimal APIs Escalonáveis

* É proibido concentrar a lógica de rotas diretamente no Program.cs.
* Utilizar Endpoint Modules ou Métodos de Extensão (IEndpointRouteBuilder) para organizar os grupos de rotas por Bounded Context.
* As Minimal APIs atuam apenas como receptores HTTP, delegando a execução imediatamente para os Use Cases da camada Application.

### 1.3. DDD e Camada Application

* Bounded Contexts: Delimitar as fronteiras do contexto de negócio de forma isolada.
* DTOs de Entrada e Saída: Cada caso de uso deve ter suas classes exclusivas de entrada (Input DTO) e saída (Output DTO). É proibido expor entidades de domínio em endpoints.
* Use Cases: Cada ação/fluxo deve ser encapsulado em uma classe de Caso de Uso (UseCase) com responsabilidade única.

### 1.4. Camada Domain

* Contém a lógica central do negócio, regras de domínio, entidades e Value Objects (com validações internas).
* Contém as interfaces de acesso a dados (IRepository), garantindo o desacoplamento da infraestrutura.

### 1.5. Camada Data

* Projeto focado na implementação do acesso a dados com banco PostgreSQL via EF Core ou Dapper.
* Implementa as interfaces de repositório declaradas na camada de Domínio.

### 1.6. Testes Unitários (xUnit + FluentAssertions + Moq)

* O projeto {Contexto}.Tests é obrigatório para cobrir cenários críticos de regras de negócio.
* Utilizar xUnit como framework base de testes.
* Utilizar FluentAssertions para asserções declarativas e legíveis.
* Utilizar Moq para criação de mocks de repositórios e dependências externas.

### 1.7. Libs padrões do projeto

* Deverá utilizar Dapper ao invés de EntityFramework.
* Caso tenha algum método que necessite de fazer requisição HTTP, deverá ser utilizado a lib Refit.

### 1.8. Segurança e autenticação

* Deverá ser gerado token JWT com tempo de expiração baixo (1hr no máximo) e refresh token com expiração máxima de 7 dias (ou menos conforme padrão global).
* Com exceção aos métodos de autenticação **TODOS** os demais métodos deverão ser restritos por autenticação.
---

## 2. FRONTEND (Vue.js 3 + TypeScript)

### 2.1. Organização por Contextos e Arquivos

* Estruturar os módulos em diretórios agrupados por contexto de negócio.
* Separação de arquivos: Arquivos de interface (.vue) e arquivos de código TypeScript (.ts) devem residir em pastas separadas dentro do diretório do contexto (ex: components/, composables/, services/, types/).
* Todo o código do frontend deve ser escrito em TypeScript.

### 2.2. Isolação de Lógica de Negócio e Uso de Composables

* Proibido inserir lógica de negócio nos componentes .vue: O componente deve ser responsável apenas pelo template, estilo e binding visual.
* Toda regra de negócio, gerenciamento de estado e integração HTTP (deverá consumir os métodos criados na etapa seguinte) deve ficar em Composables (useFeature.ts).
* Utilize arquivos separados para a criação dos métodos HTTP. Utilize a lib Axios para que realizar as requisições. Crie métodos (caso não exista) doGet, doPost, doPut, doDelete, doPatch e doQuery para cada tipo de verbo HTTP.
* Separe em um arquivo de constantes a URL de cada endpoint e concatene com o baseURL que poderá vir de um arquivo 
* Injeção de Dependências em Composables: Os composables podem receber dependências externas (como instâncias de serviços de API ou utilitários) via parâmetros para facilitar desacoplamento e testes.

### 2.3. Performance em Listas Volumosas (shallowRef)

* Para manipular arrays, coleções ou listas extensas vindas de endpoints da API, é obrigatório utilizar shallowRef em vez de ref.
* O shallowRef rastreia apenas a reatribuição do objeto/array completo, evitando a sobrecarga de memória da reatividade profunda e recursiva do ref.

### 2.4. Gestão de Estado via provide / inject

* Utilizar o padrão provide e inject com chaves tipadas (InjectionKey) para compartilhar dados e funções entre um componente pai e seus descendentes dentro do mesmo contexto.

### 2.5. Padronização e Nomenclatura de Componentes Filhos

* Componentes filhos que pertencem diretamente a um componente pai devem obrigatoriamente adotar a convenção de nome: NomeComponentePai + NomeComponenteFilho.
* Exemplo: Se o pai chama-se ExtratoFinanceiro.vue, os filhos devem ser ExtratoFinanceiroFiltro.vue e ExtratoFinanceiroTabela.vue.