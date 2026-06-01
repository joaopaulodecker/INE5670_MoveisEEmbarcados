// ============================================================
//  Microservice: Servico de Logging
//  Mantem o historico de todas as entregas (armazenamento/retirada).
//  Banco de dados proprio: logs.db
// ============================================================

const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORTA = 8084;

const db = new sqlite3.Database('./logs.db', (err) => {
  if (err) throw err;
  console.log('[logging] Conectado ao SQLite.');
});

db.run(`CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entrega_id INTEGER,
          evento TEXT NOT NULL,        -- armazenamento / retirada
          detalhes TEXT,
          data TEXT NOT NULL)`);

// Registra um evento no historico (chamado pelo servico de Entregas)
app.post('/logs', (req, res) => {
  const { entrega_id, evento, detalhes } = req.body;
  const data = new Date().toISOString();
  db.run(`INSERT INTO logs (entrega_id, evento, detalhes, data) VALUES (?, ?, ?, ?)`,
    [entrega_id, evento, detalhes, data], function (err) {
      if (err) return res.status(500).send('Erro ao registrar log.');
      res.status(201).json({ id: this.lastID, entrega_id, evento, detalhes, data });
    });
});

// Consulta todo o historico (usado pelo administrador)
app.get('/logs', (req, res) => {
  db.all(`SELECT * FROM logs ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).send('Erro ao obter logs.');
    res.status(200).json(rows);
  });
});

app.listen(PORTA, () => console.log(`[logging] Servico em execucao na porta ${PORTA}`));
