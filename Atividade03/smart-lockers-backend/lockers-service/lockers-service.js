const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORTA = 8081;

const db = new sqlite3.Database('./lockers.db', (err) => {
  if (err) throw err;
  console.log('[lockers] Conectado ao SQLite.');
});

db.run(`CREATE TABLE IF NOT EXISTS lockers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          condominio TEXT NOT NULL,
          localizacao TEXT NOT NULL)`);

db.run(`CREATE TABLE IF NOT EXISTS compartimentos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          locker_id INTEGER NOT NULL,
          tamanho TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'livre',
          FOREIGN KEY (locker_id) REFERENCES lockers(id))`);

app.post('/lockers', (req, res) => {
  const { condominio, localizacao } = req.body;

  if (!condominio || !localizacao) {
    return res.status(400).json({ error: 'condominio e localizacao sao obrigatorios' });
  }

  db.run(
    `INSERT INTO lockers (condominio, localizacao) VALUES (?, ?)`,
    [condominio, localizacao],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao cadastrar locker' });

      res.status(201).json({
        id: this.lastID,
        condominio,
        localizacao
      });
    }
  );
});

app.get('/lockers', (req, res) => {
  db.all(`SELECT * FROM lockers`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao obter lockers' });
    res.status(200).json(rows);
  });
});

app.get('/lockers/:id', (req, res) => {
  db.get(`SELECT * FROM lockers WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro ao obter locker' });
    if (!row) return res.status(404).json({ error: 'Locker nao encontrado' });
    res.status(200).json(row);
  });
});

app.post('/lockers/:id/compartimentos', (req, res) => {
  const { tamanho } = req.body;
  const tamanhosValidos = ['P', 'M', 'G', 'XG'];

  if (!tamanho) {
    return res.status(400).json({ error: 'tamanho obrigatorio' });
  }

  if (!tamanhosValidos.includes(tamanho)) {
    return res.status(400).json({ error: 'Tamanho invalido. Use P, M, G ou XG' });
  }

  db.get(`SELECT * FROM lockers WHERE id = ?`, [req.params.id], (err, locker) => {
    if (err) return res.status(500).json({ error: 'Erro ao verificar locker' });
    if (!locker) return res.status(404).json({ error: 'Locker nao encontrado' });

    db.run(
      `INSERT INTO compartimentos (locker_id, tamanho) VALUES (?, ?)`,
      [req.params.id, tamanho],
      function (err2) {
        if (err2) return res.status(500).json({ error: 'Erro ao criar compartimento' });

        res.status(201).json({
          id: this.lastID,
          locker_id: Number(req.params.id),
          tamanho,
          status: 'livre'
        });
      }
    );
  });
});

app.get('/lockers/:id/compartimentos', (req, res) => {
  db.all(
    `SELECT * FROM compartimentos WHERE locker_id = ?`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Erro ao obter compartimentos' });
      res.status(200).json(rows);
    }
  );
});

app.patch('/lockers/:id/alocar', (req, res) => {
  const { tamanho } = req.body;
  const tamanhosValidos = ['P', 'M', 'G', 'XG'];

  if (!tamanho) {
    return res.status(400).json({ error: 'tamanho obrigatorio' });
  }

  if (!tamanhosValidos.includes(tamanho)) {
    return res.status(400).json({ error: 'Tamanho invalido' });
  }

  db.get(`SELECT * FROM lockers WHERE id = ?`, [req.params.id], (err, locker) => {
    if (err) return res.status(500).json({ error: 'Erro ao verificar locker' });
    if (!locker) return res.status(404).json({ error: 'Locker nao encontrado' });

    db.get(
      `SELECT * FROM compartimentos
       WHERE locker_id = ? AND tamanho = ? AND status = 'livre'
       LIMIT 1`,
      [req.params.id, tamanho],
      (err2, comp) => {
        if (err2) return res.status(500).json({ error: 'Erro ao buscar compartimento' });
        if (!comp) return res.status(409).json({ error: 'Nenhum compartimento livre desse tamanho' });

        db.run(
          `UPDATE compartimentos SET status = 'ocupado' WHERE id = ?`,
          [comp.id],
          (err3) => {
            if (err3) return res.status(500).json({ error: 'Erro ao alocar compartimento' });

            res.status(200).json({ ...comp, status: 'ocupado' });
          }
        );
      }
    );
  });
});

app.patch('/lockers/:id/liberar', (req, res) => {
  const { compartimento_id } = req.body;

  if (!compartimento_id) {
    return res.status(400).json({ error: 'compartimento_id obrigatorio' });
  }

  db.get(`SELECT * FROM lockers WHERE id = ?`, [req.params.id], (err, locker) => {
    if (err) return res.status(500).json({ error: 'Erro ao verificar locker' });
    if (!locker) return res.status(404).json({ error: 'Locker nao encontrado' });

    db.run(
      `UPDATE compartimentos SET status = 'livre' WHERE id = ? AND locker_id = ?`,
      [compartimento_id, req.params.id],
      function (err2) {
        if (err2) return res.status(500).json({ error: 'Erro ao liberar compartimento' });
        if (this.changes === 0) return res.status(404).json({ error: 'Compartimento nao encontrado' });

        res.status(200).json({ message: 'Compartimento liberado' });
      }
    );
  });
});

app.listen(PORTA, () =>
  console.log(`[lockers] Servico em execucao na porta ${PORTA}`)
);