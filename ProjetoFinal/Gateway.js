// ============================================================
//  API GATEWAY
//  E o unico ponto de entrada do backend. O sistema embarcado
//  e o app so falam com o Gateway (porta 3000). O Gateway
//  encaminha cada requisicao para o microservice correto:
//    /config   -> servico CONTROLE (porta 3001)
//    /leituras -> servico LOGGING  (porta 3002)
//  Porta: 3000
// ============================================================

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Enderecos internos dos microservices
const CONTROLE = "http://localhost:3001";
const LOGGING = "http://localhost:3002";

// ---------- Rotas de configuracao (encaminha para o CONTROLE) ----------

app.get("/config", async (req, res) => {
  try {
    const resposta = await axios.get(CONTROLE + "/config");
    res.json(resposta.data);
  } catch (e) {
    res.status(500).json({ erro: "Falha ao acessar o servico de Controle" });
  }
});

app.put("/config", async (req, res) => {
  try {
    const resposta = await axios.put(CONTROLE + "/config", req.body);
    res.json(resposta.data);
  } catch (e) {
    res.status(500).json({ erro: "Falha ao acessar o servico de Controle" });
  }
});

// ---------- Rotas de leituras (encaminha para o LOGGING) ----------

app.post("/leituras", async (req, res) => {
  try {
    const resposta = await axios.post(LOGGING + "/leituras", req.body);
    res.json(resposta.data);
  } catch (e) {
    res.status(500).json({ erro: "Falha ao acessar o servico de Logging" });
  }
});

app.get("/leituras", async (req, res) => {
  try {
    const resposta = await axios.get(LOGGING + "/leituras");
    res.json(resposta.data);
  } catch (e) {
    res.status(500).json({ erro: "Falha ao acessar o servico de Logging" });
  }
});

app.listen(3000, () => {
  console.log("API GATEWAY rodando na porta 3000");
});
