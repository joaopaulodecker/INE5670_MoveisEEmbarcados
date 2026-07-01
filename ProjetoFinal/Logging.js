// ============================================================
//  SERVIÇO: LOGGING
//  Recebe as leituras enviadas pelo sistema embarcado e
//  devolve o historico de leituras para o aplicativo.
//  Banco de dados: registros.db (tabela leituras)
//  Porta: 3002 (so o Gateway acessa este servico)
// ============================================================

const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(express.json());

// Abre (ou cria) o banco de dados de registros
const db = new sqlite3.Database("registros.db");

// Cria a tabela caso ainda nao exista
db.run(`CREATE TABLE IF NOT EXISTS leituras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  distancia REAL,
  detectado INTEGER,
  data_hora TEXT
)`);

// POST /leituras -> registra uma leitura do sensor
// (usado pelo sistema embarcado)
app.post("/leituras", (req, res) => {
  const { distancia, detectado } = req.body;
  const dataHora = new Date().toLocaleString("pt-BR"); // ex: 01/07/2026, 16:49:51

  db.run(
    "INSERT INTO leituras (distancia, detectado, data_hora) VALUES (?, ?, ?)",
    [distancia, detectado ? 1 : 0, dataHora],
    function (err) {
      if (err) return res.status(500).json({ erro: err.message });
      console.log(
        "Leitura registrada:",
        distancia,
        "cm -",
        detectado ? "DETECTADO" : "LIVRE",
      );
      res.json({ ok: true, id: this.lastID });
    },
  );
});

// GET /leituras -> devolve as ultimas 50 leituras (mais recentes primeiro)
// (usado pelo aplicativo)
app.get("/leituras", (req, res) => {
  db.all("SELECT * FROM leituras ORDER BY id DESC LIMIT 50", (err, linhas) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(linhas);
  });
});

app.listen(3002, () => {
  console.log("Servico LOGGING rodando na porta 3002");
});
