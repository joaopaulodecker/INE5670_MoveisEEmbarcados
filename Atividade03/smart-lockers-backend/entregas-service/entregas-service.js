// ============================================================
//  Microservice: Controle de Entregas  (ORQUESTRADOR)
//  Administra as encomendas armazenadas nos lockers.
//  Nao acessa o banco de nenhum outro servico: toda interacao
//  e feita por requisicoes REST usando o Axios.
//    - Condominos -> valida o destinatario
//    - Lockers    -> aloca / libera um compartimento
//    - Logging    -> registra o evento no historico
//    - Abertura   -> manda abrir a porta do compartimento
//  Banco de dados proprio: entregas.db
// ============================================================

const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORTA = 8083;

// Enderecos dos outros servicos (em um ambiente real viriam de configuracao)
const CONDOMINOS = 'http://localhost:8082';
const LOCKERS    = 'http://localhost:8081';
const LOGGING    = 'http://localhost:8084';
const ABERTURA   = 'http://localhost:8085';

const db = new sqlite3.Database('./entregas.db', (err) => {
  if (err) throw err;
  console.log('[entregas] Conectado ao SQLite.');
});

db.run(`CREATE TABLE IF NOT EXISTS entregas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          condomino_id INTEGER NOT NULL,
          locker_id INTEGER NOT NULL,
          compartimento_id INTEGER NOT NULL,
          tamanho TEXT NOT NULL,
          codigo INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'armazenada',  -- armazenada / retirada
          data_armazenamento TEXT,
          data_retirada TEXT)`);

// Funcao auxiliar: grava a entrega no banco e devolve o id gerado
function inserirEntrega(e) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO entregas
              (condomino_id, locker_id, compartimento_id, tamanho, codigo, data_armazenamento)
              VALUES (?, ?, ?, ?, ?, ?)`,
      [e.condomino_id, e.locker_id, e.compartimento_id, e.tamanho, e.codigo, e.data],
      function (err) {
        if (err) reject(err); else resolve(this.lastID);
      });
  });
}

// ---------- Armazenar uma encomenda ----------
// Fluxo: valida condomino -> aloca compartimento -> grava -> loga -> abre
app.post('/entregas', async (req, res) => {
  const { condomino_id, tamanho } = req.body;
  try {
    // 1. Valida o condomino e descobre a qual locker ele pertence
    const cond = await axios.get(`${CONDOMINOS}/condominos/${condomino_id}`);
    const lockerId = cond.data.locker_id;

    // 2. Pede ao servico de Lockers um compartimento livre do tamanho desejado
    const comp = await axios.patch(`${LOCKERS}/lockers/${lockerId}/alocar`, { tamanho });
    const compartimento = comp.data;

    // 3. Gera um codigo de retirada e grava a entrega no PROPRIO banco
    const codigo = Math.floor(1000 + Math.random() * 9000);
    const data = new Date().toISOString();
    const entregaId = await inserirEntrega({
      condomino_id, locker_id: lockerId, compartimento_id: compartimento.id,
      tamanho, codigo, data
    });

    // 4. Registra o evento no historico (Logging)
    await axios.post(`${LOGGING}/logs`, {
      entrega_id: entregaId, evento: 'armazenamento',
      detalhes: `Compartimento ${compartimento.id} do locker ${lockerId}`
    });

    // 5. Manda abrir o compartimento para o entregador depositar
    await axios.post(`${ABERTURA}/abrir`, {
      locker_id: lockerId, compartimento_id: compartimento.id
    });

    res.status(201).json({
      id: entregaId, condomino_id, locker_id: lockerId,
      compartimento_id: compartimento.id, codigo, status: 'armazenada'
    });
  } catch (err) {
    // Repassa o erro do servico que falhou (condomino inexistente, sem vaga, etc.)
    const status = err.response ? err.response.status : 500;
    const msg = err.response ? err.response.data : 'Erro ao registrar entrega.';
    res.status(status).send(msg);
  }
});

// ---------- Listar entregas (todas ou de um condomino) ----------
app.get('/entregas', (req, res) => {
  const { condomino_id } = req.query;
  const sql = condomino_id
    ? `SELECT * FROM entregas WHERE condomino_id = ?`
    : `SELECT * FROM entregas`;
  const params = condomino_id ? [condomino_id] : [];
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).send('Erro ao obter entregas.');
    res.status(200).json(rows);
  });
});

// ---------- Retirar uma encomenda ----------
// Fluxo: abre -> atualiza status -> libera compartimento -> loga
app.post('/entregas/:id/retirar', (req, res) => {
  db.get(`SELECT * FROM entregas WHERE id = ?`, [req.params.id], async (err, entrega) => {
    if (err) return res.status(500).send('Erro ao buscar entrega.');
    if (!entrega) return res.status(404).send('Entrega nao encontrada.');
    if (entrega.status === 'retirada') return res.status(409).send('Encomenda ja foi retirada.');
    try {
      // 1. Abre o compartimento para o condomino retirar
      await axios.post(`${ABERTURA}/abrir`, {
        locker_id: entrega.locker_id, compartimento_id: entrega.compartimento_id
      });

      // 2. Atualiza o status da entrega no proprio banco
      const data = new Date().toISOString();
      db.run(`UPDATE entregas SET status = 'retirada', data_retirada = ? WHERE id = ?`,
        [data, entrega.id]);

      // 3. Libera o compartimento no servico de Lockers
      await axios.patch(`${LOCKERS}/lockers/${entrega.locker_id}/liberar`, {
        compartimento_id: entrega.compartimento_id
      });

      // 4. Registra o evento no historico (Logging)
      await axios.post(`${LOGGING}/logs`, {
        entrega_id: entrega.id, evento: 'retirada',
        detalhes: `Compartimento ${entrega.compartimento_id} liberado`
      });

      res.status(200).send('Encomenda retirada com sucesso!');
    } catch (e) {
      res.status(500).send('Erro ao retirar encomenda.');
    }
  });
});

app.listen(PORTA, () => console.log(`[entregas] Servico em execucao na porta ${PORTA}`));
