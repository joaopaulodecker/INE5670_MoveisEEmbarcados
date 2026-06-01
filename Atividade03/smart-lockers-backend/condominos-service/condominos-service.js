// ============================================================
//  Microservice: Cadastro de Condominos
//  Pessoas que tem acesso a um determinado locker.
//  Banco de dados proprio: condominos.db
// ============================================================

const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORTA = 8082;

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

// Cadastra um condomino (usado pelo administrador)
app.post('/condominos', (req, res) => {
  const { nome, contato, unidade, locker_id } = req.body;
  db.run(`INSERT INTO condominos (nome, contato, unidade, locker_id) VALUES (?, ?, ?, ?)`,
    [nome, contato, unidade, locker_id], function (err) {
      if (err) return res.status(500).send('Erro ao cadastrar condomino.');
      res.status(201).json({ id: this.lastID, nome, contato, unidade, locker_id });
    });
});

// Lista todos os condominos
app.get('/condominos', (req, res) => {
  db.all(`SELECT * FROM condominos`, [], (err, rows) => {
    if (err) return res.status(500).send('Erro ao obter condominos.');
    res.status(200).json(rows);
  });
});

// Busca um condomino pelo id (usado pelo servico de Entregas para validar)
app.get('/condominos/:id', (req, res) => {
  db.get(`SELECT * FROM condominos WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).send('Erro ao obter condomino.');
    if (!row) return res.status(404).send('Condomino nao encontrado.');
    res.status(200).json(row);
  });
});

// Altera os dados de um condomino
app.patch('/condominos/:id', (req, res) => {
  const { nome, contato, unidade } = req.body;
  db.run(`UPDATE condominos
            SET nome = COALESCE(?, nome),
                contato = COALESCE(?, contato),
                unidade = COALESCE(?, unidade)
            WHERE id = ?`,
    [nome, contato, unidade, req.params.id], function (err) {
      if (err) return res.status(500).send('Erro ao alterar condomino.');
      if (this.changes === 0) return res.status(404).send('Condomino nao encontrado.');
      res.status(200).send('Condomino alterado com sucesso!');
    });
});

// Remove um condomino
app.delete('/condominos/:id', (req, res) => {
  db.run(`DELETE FROM condominos WHERE id = ?`, [req.params.id], function (err) {
    if (err) return res.status(500).send('Erro ao remover condomino.');
    if (this.changes === 0) return res.status(404).send('Condomino nao encontrado.');
    res.status(200).send('Condomino removido com sucesso!');
  });
});

app.listen(PORTA, () => console.log(`[condominos] Servico em execucao na porta ${PORTA}`));
