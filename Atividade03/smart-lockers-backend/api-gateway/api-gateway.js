const express = require('express');
const httpProxy = require('express-http-proxy');
const logger = require('morgan');

const app = express();
app.use(logger('dev'));

const PORTA = 8000;

function selecionarServico(req) {
  if (req.path.startsWith('/lockers')) return 'http://localhost:8081';
  if (req.path.startsWith('/condominos')) return 'http://localhost:8082';
  if (req.path.startsWith('/entregas')) return 'http://localhost:8083';
  if (req.path.startsWith('/logs')) return 'http://localhost:8084';
  return null;
}

app.use((req, res, next) => {
  const destino = selecionarServico(req);
  if (!destino) return res.status(404).json({ error: 'Rota nao encontrada no gateway' });
  httpProxy(destino)(req, res, next);
});

app.listen(PORTA, () => console.log('API Gateway em execucao na porta 8000'));