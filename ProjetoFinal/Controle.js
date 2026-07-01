// ============================================================
//  SERVIÇO: CONTROLE
//  Guarda e fornece os parametros de configuracao do sistema
//  embarcado (aqui: a distancia limite para acionar o atuador).
//  Banco de dados: config.db (tabela config)
//  Porta: 3001 (so o Gateway acessa este servico)
// ============================================================

const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(express.json());

// Abre (ou cria) o banco de dados de configuracao
const db = new sqlite3.Database("config.db");

// Cria a tabela caso ainda nao exista
db.run(`CREATE TABLE IF NOT EXISTS config (
  id INTEGER PRIMARY KEY,
  distancia_limite INTEGER
)`);

// Insere um valor padrao na primeira vez que roda
db.get("SELECT * FROM config WHERE id = 1", (err, linha) => {
  if (!linha) {
    db.run("INSERT INTO config (id, distancia_limite) VALUES (1, 20)");
    console.log("Config inicial criada: distancia_limite = 20");
  }
});

// GET /config -> devolve a configuracao atual
// (usado pelo sistema embarcado e pelo app)
app.get("/config", (req, res) => {
  db.get("SELECT * FROM config WHERE id = 1", (err, linha) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(linha);
  });
});

// PUT /config -> atualiza a configuracao
// (usado pelo app para configurar o sistema embarcado)
app.put("/config", (req, res) => {
  const { distancia_limite } = req.body;
  db.run(
    "UPDATE config SET distancia_limite = ? WHERE id = 1",
    [distancia_limite],
    (err) => {
      if (err) return res.status(500).json({ erro: err.message });
      console.log("Config atualizada: distancia_limite =", distancia_limite);
      res.json({ ok: true, distancia_limite });
    },
  );
});

app.listen(3001, () => {
  console.log("Servico CONTROLE rodando na porta 3001");
});
