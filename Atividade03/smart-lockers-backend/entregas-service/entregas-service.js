const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORTA = 8083;

const CONDOMINOS = 'http://localhost:8082';
const LOCKERS = 'http://localhost:8081';
const LOGGING = 'http://localhost:8084';
const ABERTURA = 'http://localhost:8085';

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
  status TEXT NOT NULL DEFAULT 'armazenada',
  data_armazenamento TEXT,
  data_retirada TEXT
)`);

function inserirEntrega(e) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO entregas (condomino_id, locker_id, compartimento_id, tamanho, codigo, data_armazenamento)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [e.condomino_id, e.locker_id, e.compartimento_id, e.tamanho, e.codigo, e.data],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

app.post('/entregas', async (req, res) => {
  const { condomino_id, tamanho } = req.body;

  if (!condomino_id || !tamanho) {
    return res.status(400).json({ error: 'condomino_id e tamanho sao obrigatorios' });
  }

  if (!Number.isInteger(condomino_id) || condomino_id <= 0) {
    return res.status(400).json({ error: 'condomino_id invalido' });
  }

  if (!['P', 'M', 'G', 'XG'].includes(tamanho)) {
    return res.status(400).json({ error: 'tamanho invalido' });
  }

  try {
    const cond = await axios.get(`${CONDOMINOS}/condominos/${condomino_id}`);

    if (!cond.data || !cond.data.locker_id) {
      return res.status(404).json({ error: 'condomino invalido' });
    }

    const lockerId = cond.data.locker_id;

    const comp = await axios.patch(`${LOCKERS}/lockers/${lockerId}/alocar`, { tamanho });

    if (!comp.data) {
      return res.status(409).json({ error: 'sem compartimento disponivel' });
    }

    const codigo = Math.floor(1000 + Math.random() * 9000);
    const data = new Date().toISOString();

    const entregaId = await inserirEntrega({
      condomino_id,
      locker_id: lockerId,
      compartimento_id: comp.data.id,
      tamanho,
      codigo,
      data
    });

    await axios.post(`${LOGGING}/logs`, {
      entrega_id: entregaId,
      evento: 'armazenamento',
      detalhes: `compartimento ${comp.data.id}`
    });

    await axios.post(`${ABERTURA}/abrir`, {
      locker_id: lockerId,
      compartimento_id: comp.data.id
    });

    res.status(201).json({
      id: entregaId,
      condomino_id,
      locker_id: lockerId,
      compartimento_id: comp.data.id,
      codigo,
      status: 'armazenada'
    });

  } catch (err) {
    const status = err.response?.status || 500;
    const msg = err.response?.data || 'erro ao registrar entrega';
    res.status(status).json({ error: msg });
  }
});

app.get('/entregas', (req, res) => {
  const { condomino_id } = req.query;

  const sql = condomino_id
    ? `SELECT * FROM entregas WHERE condomino_id = ?`
    : `SELECT * FROM entregas`;

  const params = condomino_id ? [condomino_id] : [];

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'erro ao obter entregas' });
    res.status(200).json(rows);
  });
});

app.post('/entregas/:id/retirar', (req, res) => {
  db.get(`SELECT * FROM entregas WHERE id = ?`, [req.params.id], async (err, entrega) => {
    if (err) return res.status(500).json({ error: 'erro ao buscar entrega' });
    if (!entrega) return res.status(404).json({ error: 'entrega nao encontrada' });
    if (entrega.status === 'retirada') {
      return res.status(409).json({ error: 'ja retirada' });
    }

    try {
      await axios.post(`${ABERTURA}/abrir`, {
        locker_id: entrega.locker_id,
        compartimento_id: entrega.compartimento_id
      });

      const data = new Date().toISOString();

      db.run(
        `UPDATE entregas SET status = 'retirada', data_retirada = ? WHERE id = ?`,
        [data, entrega.id],
        async function (err2) {
          if (err2) return res.status(500).json({ error: 'erro ao atualizar entrega' });

          await axios.patch(`${LOCKERS}/lockers/${entrega.locker_id}/liberar`, {
            compartimento_id: entrega.compartimento_id
          });

          await axios.post(`${LOGGING}/logs`, {
            entrega_id: entrega.id,
            evento: 'retirada',
            detalhes: `compartimento ${entrega.compartimento_id}`
          });

          res.status(200).json({ message: 'encomenda retirada com sucesso' });
        }
      );

    } catch (e) {
      res.status(500).json({ error: 'erro ao processar retirada' });
    }
  });
});

app.listen(PORTA, () => console.log(`[entregas] Servico em execucao na porta ${PORTA}`));