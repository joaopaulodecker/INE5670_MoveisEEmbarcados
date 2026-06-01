// ============================================================
//  Microservice: Controle de Abertura
//  Executa "em cada locker". Apenas recebe o pedido de abertura
//  de um compartimento e simula a abertura imprimindo na tela.
//  Nao possui banco de dados.
// ============================================================

const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORTA = 8085;

// Recebe o pedido e simula a abertura com uma mensagem na tela
app.post('/abrir', (req, res) => {
  const { locker_id, compartimento_id } = req.body;
  console.log(`>>> Abrindo o compartimento ${compartimento_id} do locker ${locker_id}...`);
  res.status(200).send(`Compartimento ${compartimento_id} aberto.`);
});

app.listen(PORTA, () => console.log(`[abertura] Servico em execucao na porta ${PORTA}`));
