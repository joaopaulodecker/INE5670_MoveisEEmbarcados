// ============================================================
//  Microservice: Cadastro de Lockers
//  Mantem os lockers instalados e seus compartimentos (P, M, G, XG).
//  Banco de dados proprio: lockers.db
// ============================================================

const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORTA = 8081;

// --- Conexao com o banco de dados ---
const db = new sqlite3.Database('./lockers.db', (err) => {
  if (err) throw err;
  console.log('[lockers] Conectado ao SQLite.');
});

// Tabela de lockers
db.run(`CREATE TABLE IF NOT EXISTS lockers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          condominio TEXT NOT NULL,
          localizacao TEXT NOT NULL)`);

// Tabela de compartimentos (cada locker possui varios)
db.run(`CREATE TABLE IF NOT EXISTS compartimentos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          locker_id INTEGER NOT NULL,
          tamanho TEXT NOT NULL,                  -- P, M, G ou XG
          status TEXT NOT NULL DEFAULT 'livre',   -- livre / ocupado
          FOREIGN KEY (locker_id) REFERENCES lockers(id))`);

// ---------- CRUD de lockers ----------

// Cadastra um locker (usado pelo administrador)
app.post('/lockers', (req, res) => {
  const { condominio, localizacao } = req.body;
  db.run(`INSERT INTO lockers (condominio, localizacao) VALUES (?, ?)`,
    [condominio, localizacao], function (err) {
      if (err) return res.status(500).send('Erro ao cadastrar locker.');
      res.status(201).json({ id: this.lastID, condominio, localizacao });
    });
});

// Lista todos os lockers
app.get('/lockers', (req, res) => {
  db.all(`SELECT * FROM lockers`, [], (err, rows) => {
    if (err) return res.status(500).send('Erro ao obter lockers.');
    res.status(200).json(rows);
  });
});

// Busca um locker pelo id
app.get('/lockers/:id', (req, res) => {
  db.get(`SELECT * FROM lockers WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).send('Erro ao obter locker.');
    if (!row) return res.status(404).send('Locker nao encontrado.');
    res.status(200).json(row);
  });
});

// ---------- Compartimentos ----------

// Adiciona um compartimento de um determinado tamanho a um locker
app.post('/lockers/:id/compartimentos', (req, res) => {
  const { tamanho } = req.body;
  db.run(`INSERT INTO compartimentos (locker_id, tamanho) VALUES (?, ?)`,
    [req.params.id, tamanho], function (err) {
      if (err) return res.status(500).send('Erro ao criar compartimento.');
      res.status(201).json({
        id: this.lastID, locker_id: Number(req.params.id), tamanho, status: 'livre'
      });
    });
});

// Lista os compartimentos de um locker
app.get('/lockers/:id/compartimentos', (req, res) => {
  db.all(`SELECT * FROM compartimentos WHERE locker_id = ?`, [req.params.id], (err, rows) => {
    if (err) return res.status(500).send('Erro ao obter compartimentos.');
    res.status(200).json(rows);
  });
});

// ACAO: aloca um compartimento livre do tamanho pedido.
// Chamado pelo servico de Entregas ao armazenar uma encomenda.
app.patch('/lockers/:id/alocar', (req, res) => {
  const { tamanho } = req.body;
  db.get(`SELECT * FROM compartimentos
            WHERE locker_id = ? AND tamanho = ? AND status = 'livre'
            LIMIT 1`,
    [req.params.id, tamanho], (err, comp) => {
      if (err) return res.status(500).send('Erro ao buscar compartimento.');
      if (!comp) return res.status(409).send('Nenhum compartimento livre desse tamanho.');
      db.run(`UPDATE compartimentos SET status = 'ocupado' WHERE id = ?`, [comp.id], (err2) => {
        if (err2) return res.status(500).send('Erro ao alocar compartimento.');
        res.status(200).json({ ...comp, status: 'ocupado' });
      });
    });
});

// ACAO: libera um compartimento (quando a encomenda e retirada)
app.patch('/lockers/:id/liberar', (req, res) => {
  const { compartimento_id } = req.body;
  db.run(`UPDATE compartimentos SET status = 'livre' WHERE id = ? AND locker_id = ?`,
    [compartimento_id, req.params.id], function (err) {
      if (err) return res.status(500).send('Erro ao liberar compartimento.');
      if (this.changes === 0) return res.status(404).send('Compartimento nao encontrado.');
      res.status(200).send('Compartimento liberado.');
    });
});

app.listen(PORTA, () => console.log(`[lockers] Servico em execucao na porta ${PORTA}`));
