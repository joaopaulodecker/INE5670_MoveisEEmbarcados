// ============================================================
//  API Gateway
//  Ponto unico de entrada do backend. Encaminha cada requisicao
//  para o microservice correto com base no caminho da URL.
//
//  Obs.: o servico de Controle de Abertura NAO e exposto aqui,
//  pois ele roda em cada locker e e chamado internamente pelo
//  servico de Controle de Entregas.
// ============================================================

const express = require('express');
const httpProxy = require('express-http-proxy');
const logger = require('morgan');

const app = express();
app.use(logger('dev'));

// Decide para qual servico encaminhar com base no inicio do caminho
function selecionarServico(req) {
  if (req.path.startsWith('/lockers'))    return 'http://localhost:8081';
  if (req.path.startsWith('/condominos')) return 'http://localhost:8082';
  if (req.path.startsWith('/entregas'))   return 'http://localhost:8083';
  if (req.path.startsWith('/logs'))       return 'http://localhost:8084';
  return null;
}

app.use((req, res, next) => {
  const destino = selecionarServico(req);
  if (!destino) return res.status(404).send('Rota nao encontrada no gateway.');
  httpProxy(destino)(req, res, next);
});

app.listen(8000, () => console.log('API Gateway em execucao na porta 8000.'));
