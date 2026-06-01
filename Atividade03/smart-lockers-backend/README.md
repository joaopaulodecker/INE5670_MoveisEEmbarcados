# Backend de Smart Lockers

Atividade 3 — Backend · INE5670 (Desenvolvimento de Sistemas Móveis e Embarcados) · UFSC

Backend de um sistema de _smart lockers_ (armários inteligentes para entrega de
encomendas em condomínios). É implementado como uma arquitetura de **microservices**
acessados por meio de um **API Gateway**, usando **Node.js + Express**, **SQLite**
como banco e **Axios** para a comunicação entre os serviços.

## Arquitetura

```
                    ┌──────────────────────────────────────────────┐
   App / Tela  ──▶  │                  API Gateway (8000)            │
                    └───────┬───────────┬───────────┬───────────────┘
                            │           │           │
            ┌───────────────┘     ┌─────┘      ┌─────┘
            ▼                     ▼            ▼
   Cadastro de Lockers   Cadastro de       Controle de Entregas ──┐
       (8081)            Condôminos (8082)      (8083)            │ Axios
            │                  │                   │              ▼
        lockers.db        condominos.db        entregas.db   Controle de
                                                              Abertura (8085)
                                              Serviço de Logging (8084)
                                                   │
                                                logs.db
```

Princípio central da atividade: **cada serviço tem o seu próprio banco e nunca
acessa o banco de outro**. Quando um serviço precisa de um dado de outro, ele
envia uma requisição REST (com o Axios). O serviço de Controle de Entregas é o
**orquestrador**: ele coordena os demais para armazenar e retirar uma encomenda.

| Serviço | Porta | Banco | Papel |
|---|---|---|---|
| API Gateway | 8000 | — | Ponto único de entrada; encaminha as requisições |
| Cadastro de Lockers | 8081 | `lockers.db` | Lockers e seus compartimentos (P, M, G, XG) |
| Cadastro de Condôminos | 8082 | `condominos.db` | Pessoas com acesso a cada locker |
| Controle de Entregas | 8083 | `entregas.db` | Orquestra o armazenamento e a retirada |
| Serviço de Logging | 8084 | `logs.db` | Histórico de todas as entregas |
| Controle de Abertura | 8085 | — | Simula a abertura de um compartimento |

O Controle de Abertura **não** fica atrás do gateway: ele "roda em cada locker" e
é chamado internamente pelo Controle de Entregas.

## Pré-requisitos

- Node.js instalado (`node --version` para conferir).

## Instalação

Instale as dependências dentro de **cada** pasta de serviço:

```bash
cd lockers-service     && npm install && cd ..
cd condominos-service  && npm install && cd ..
cd entregas-service    && npm install && cd ..
cd logging-service     && npm install && cd ..
cd abertura-service    && npm install && cd ..
cd api-gateway         && npm install && cd ..
```

## Execução

Cada serviço roda em um terminal separado (ou em segundo plano). Suba primeiro os
microservices e, por último, o gateway:

```bash
cd lockers-service     && npm start    # porta 8081
cd condominos-service  && npm start    # porta 8082
cd logging-service     && npm start    # porta 8084
cd abertura-service    && npm start    # porta 8085
cd entregas-service    && npm start    # porta 8083
cd api-gateway         && npm start    # porta 8000
```

> No Linux/macOS dá para rodar em segundo plano com `npm start &`.
> No Windows, use `start npm start` para abrir cada serviço em uma janela.

## Testando (Postman ou curl)

Todas as requisições passam pelo gateway em `http://localhost:8000`.

```bash
# 1. (admin) cadastrar um locker
curl -X POST localhost:8000/lockers \
  -H "Content-Type: application/json" \
  -d '{"condominio":"Res. Floripa","localizacao":"Hall de entrada"}'

# 2. (admin) adicionar compartimentos ao locker 1
curl -X POST localhost:8000/lockers/1/compartimentos \
  -H "Content-Type: application/json" -d '{"tamanho":"M"}'

# 3. (admin) cadastrar um condômino vinculado ao locker 1
curl -X POST localhost:8000/condominos \
  -H "Content-Type: application/json" \
  -d '{"nome":"Joao","contato":"joao@email.com","unidade":"302","locker_id":1}'

# 4. (entregador) armazenar uma encomenda tamanho M
curl -X POST localhost:8000/entregas \
  -H "Content-Type: application/json" \
  -d '{"condomino_id":1,"tamanho":"M"}'

# 5. (condômino) ver as próprias entregas
curl "localhost:8000/entregas?condomino_id=1"

# 6. (condômino) retirar a encomenda 1
curl -X POST localhost:8000/entregas/1/retirar

# 7. (admin) consultar o histórico de entregas
curl localhost:8000/logs
```

## Endpoints

**Lockers** (`/lockers`)
- `POST /lockers` — cadastra um locker
- `GET /lockers` · `GET /lockers/:id`
- `POST /lockers/:id/compartimentos` — adiciona um compartimento (P/M/G/XG)
- `GET /lockers/:id/compartimentos`
- `PATCH /lockers/:id/alocar` — aloca um compartimento livre (uso interno)
- `PATCH /lockers/:id/liberar` — libera um compartimento (uso interno)

**Condôminos** (`/condominos`)
- `POST` · `GET` · `GET /:id` · `PATCH /:id` · `DELETE /:id`

**Entregas** (`/entregas`)
- `POST /entregas` — armazena uma encomenda (orquestra os demais serviços)
- `GET /entregas` · `GET /entregas?condomino_id=:id`
- `POST /entregas/:id/retirar` — retira a encomenda

**Logs** (`/logs`)
- `POST /logs` (uso interno) · `GET /logs`

## Decisões de projeto

- **Bancos separados por serviço:** garante baixo acoplamento — é a essência da
  arquitetura de microservices. Um serviço não faz `SELECT` no banco do outro.
- **Comunicação via Axios:** sempre que o Controle de Entregas precisa de um dado
  de outro serviço, envia uma requisição REST, em vez de acessar o banco alheio.
- **Quem é dono de cada dado:** o _status_ (livre/ocupado) do compartimento fica
  no serviço de Lockers, porque o compartimento é um recurso físico do locker.
- **Controle de Abertura sem banco:** ele apenas simula a abertura imprimindo uma
  mensagem, como pede o enunciado.
