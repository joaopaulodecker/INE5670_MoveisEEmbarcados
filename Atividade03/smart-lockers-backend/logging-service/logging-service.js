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
  entrega_id INTEGER NOT NULL,
  evento TEXT NOT NULL,
  detalhes TEXT,
  data TEXT NOT NULL
)`);

app.post('/logs', (req, res) => {
  const { entrega_id, evento, detalhes } = req.body;

  const eventosValidos = ['armazenamento', 'retirada'];

  if (!entrega_id || !evento) {
    return res.status(400).json({ error: 'entrega_id e evento sao obrigatorios' });
  }

  if (!Number.isInteger(entrega_id) || entrega_id <= 0) {
    return res.status(400).json({ error: 'entrega_id invalido' });
  }

  if (!eventosValidos.includes(evento)) {
    return res.status(400).json({ error: 'evento invalido. Use armazenamento ou retirada' });
  }

  const data = new Date().toISOString();

  db.run(
    `INSERT INTO logs (entrega_id, evento, detalhes, data) VALUES (?, ?, ?, ?)`,
    [entrega_id, evento, detalhes, data],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao registrar log' });

      res.status(201).json({
        id: this.lastID,
        entrega_id,
        evento,
        detalhes,
        data
      });
    }
  );
});

app.get('/logs', (req, res) => {
  db.all(`SELECT * FROM logs ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao obter logs' });
    res.status(200).json(rows);
  });
});

app.listen(PORTA, () => console.log(`[logging] Servico em execucao na porta ${PORTA}`));