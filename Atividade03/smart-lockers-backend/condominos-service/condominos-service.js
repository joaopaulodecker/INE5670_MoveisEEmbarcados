const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORTA = 8082;
const LOCKERS_SERVICE = 'http://localhost:8081';

const db = new sqlite3.Database('./condominos.db', (err) => {
  if (err) throw err;
  console.log('[condominos] Conectado ao SQLite.');
});

db.run(`CREATE TABLE IF NOT EXISTS condominos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          contato TEXT,
          unidade TEXT,
          locker_id INTEGER NOT NULL)`);

app.post('/condominos', async (req, res) => {
  const { nome, contato, unidade, locker_id } = req.body;

  if (!nome || !locker_id) {
    return res.status(400).json({ error: 'nome e locker_id sao obrigatorios' });
  }

  if (!Number.isInteger(locker_id) || locker_id <= 0) {
    return res.status(400).json({ error: 'locker_id invalido' });
  }

  try {
    const locker = await axios.get(`${LOCKERS_SERVICE}/lockers/${locker_id}`);

    if (!locker.data) {
      return res.status(400).json({ error: 'locker nao existe' });
    }

    db.run(
      `INSERT INTO condominos (nome, contato, unidade, locker_id) VALUES (?, ?, ?, ?)`,
      [nome, contato, unidade, locker_id],
      function (err) {
        if (err) return res.status(500).json({ error: 'Erro ao cadastrar condomino' });

        res.status(201).json({
          id: this.lastID,
          nome,
          contato,
          unidade,
          locker_id
        });
      }
    );

  } catch (e) {
    return res.status(502).json({ error: 'erro ao validar locker em outro microservice' });
  }
});

app.get('/condominos', (req, res) => {
  db.all(`SELECT * FROM condominos`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao obter condominos' });
    res.status(200).json(rows);
  });
});

app.get('/condominos/:id', (req, res) => {
  db.get(`SELECT * FROM condominos WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro ao obter condomino' });
    if (!row) return res.status(404).json({ error: 'Condomino nao encontrado' });
    res.status(200).json(row);
  });
});

app.patch('/condominos/:id', (req, res) => {
  const { nome, contato, unidade } = req.body;

  if (!nome && !contato && !unidade) {
    return res.status(400).json({ error: 'nenhum dado informado' });
  }

  db.run(
    `UPDATE condominos
     SET nome = COALESCE(?, nome),
         contato = COALESCE(?, contato),
         unidade = COALESCE(?, unidade)
     WHERE id = ?`,
    [nome, contato, unidade, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao alterar condomino' });
      if (this.changes === 0) return res.status(404).json({ error: 'Condomino nao encontrado' });

      res.status(200).json({ message: 'Condomino alterado com sucesso' });
    }
  );
});

app.delete('/condominos/:id', (req, res) => {
  db.run(`DELETE FROM condominos WHERE id = ?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao remover condomino' });
    if (this.changes === 0) return res.status(404).json({ error: 'Condomino nao encontrado' });

    res.status(200).json({ message: 'Condomino removido com sucesso' });
  });
});

app.listen(PORTA, () => console.log(`[condominos] Servico em execucao na porta ${PORTA}`));