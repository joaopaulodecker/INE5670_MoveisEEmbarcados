# Projeto Final - Sistemas Móveis e Embarcados

Sistema de detecção de presença por distância. Um sensor ultrassônico mede a
distância; se ela ficar abaixo de um **limite configurável**, um atuador (LED
ou buzzer) é acionado. O limite é definido pelo **app** e lido pelo **sistema
embarcado**; as leituras são guardadas no **backend** e mostradas no **app**.

Placa usada: **NodeMCU (ESP8266)**.

## Arquitetura

```
  NodeMCU ──┐                    ┌── CONTROLE (3001) ── config.db
  (ESP8266) ├── API GATEWAY (3000)┤
  App     ──┘                    └── LOGGING  (3002) ── registros.db
```

- **NodeMCU** e **App** só falam com o **API Gateway** (porta 3000).
- O Gateway encaminha `/config` para o **Controle** e `/leituras` para o **Logging**.
- Cada microservice tem seu próprio banco SQLite.

## O que cada parte faz

**Backend (Node.js + Express + SQLite):**

- `Gateway.js` – ponto único de entrada; encaminha as requisições.
- `Controle.js` – guarda/fornece a configuração (distância limite). `config.db`.
- `Logging.js` – recebe as leituras do sensor e devolve o histórico. `registros.db`.

**Sistema embarcado (`projeto_final.ino`):**

- Lê a distância com o HC-SR04.
- Busca o limite no backend (`GET /config`) a cada 10s.
- Aciona o LED/buzzer quando `distância < limite`.
- Envia as leituras ao backend (`POST /leituras`) a cada 5s.
- Usa a biblioteca `ESP8266WiFi` (WiFi embutido do NodeMCU).

**App (`App.js`, React Native / Expo):**

- Configura o limite e envia ao backend (`PUT /config`).
- Busca e mostra as leituras (`GET /leituras`), atualizando a cada 5s.

---

## Como rodar

### 1. Descobrir o IP do computador (o que roda o backend)

- **Windows:** `ipconfig` → procure "Endereço IPv4" (ex.: 192.168.0.100)
- **Linux/Mac:** `ifconfig` ou `ip addr`

> Coloque o **celular, o NodeMCU e o computador na MESMA rede WiFi**.

### 2. Backend

Os arquivos `Gateway.js`, `Controle.js`, `Logging.js` e `package.json` estão
todos na mesma pasta (`ProjetoFinal`).

```bash
cd ProjetoFinal
npm install
```

Depois rode os **3 serviços** (em 3 terminais, ou tudo junto):

**3 terminais separados** (mostra melhor que são microservices):

```bash
npm run controle
npm run logging
npm run gateway
```

**Ou tudo de uma vez:**

```bash
npm start
```

Teste no navegador do PC: `http://localhost:3000/config`
Deve aparecer algo como `{"id":1,"distancia_limite":20}`.

> **Windows:** se o celular/NodeMCU não conseguirem conectar, libere o Node.js
> no **Firewall do Windows** (aparece um aviso na primeira execução — clique em
> "Permitir acesso").

> **Se o `npm install` falhar ao compilar o `sqlite3`:** use o **Node.js 20 LTS**
> (ou 18). Versões muito novas do Node às vezes não têm o binário pronto do sqlite3.

### 3. Sistema embarcado (NodeMCU / ESP8266)

**Configurar a Arduino IDE para o ESP8266 (só na primeira vez):**

1. _Arquivo > Preferências_, no campo "URLs Adicionais para Gerenciadores de Placas", cole:
   `http://arduino.esp8266.com/stable/package_esp8266com_index.json`
2. _Ferramentas > Placa > Gerenciador de Placas_, procure **esp8266** e instale.
3. Selecione a placa **NodeMCU 1.0 (ESP-12E Module)**.

**No `projeto_final.ino`, edite no topo:**

```cpp
const char* ssid     = "NOME_DA_REDE";
const char* senha    = "SENHA_DA_REDE";
const char* servidor = "192.168.0.100";  // <- IP do PC (SÓ o número, sem http://)
```

Faça o upload e abra o **Monitor Serial em 115200 baud**.

**Circuito:**

- HC-SR04: `VCC → VIN (5V)`, `GND → GND`, `Trig → D5`, `Echo → D6` **com divisor de tensão**
- LED (atuador): `D7 → resistor 220Ω → LED → GND` (ou um buzzer no lugar)

> **⚠ Divisor de tensão no Echo:** o HC-SR04 é alimentado em 5V e o pino Echo
> devolve 5V, mas o ESP8266 aceita só 3.3V nos pinos. Coloque um divisor entre o
> Echo e o D6: `Echo → 1kΩ → (nó) → D6` e `(nó) → 2kΩ → GND`. O pino Trig (D5)
> pode ir direto, pois é o NodeMCU que envia o sinal (3.3V) para o sensor.

### 4. App (celular)

1. Abra o Expo Snack (snack.expo.dev) ou um projeto Expo.
2. Cole o conteúdo de `App.js`.
3. Em `SERVIDOR`, troque o IP pelo do passo 1.
4. Abra no **celular** com o app **Expo Go** (o emulador NÃO acessa a rede).

---

## Roteiro pra apresentação (perguntas prováveis do professor)

**"Como o NodeMCU conecta na rede?"**
Ele já tem WiFi embutido. A função `conectarWiFi()` coloca o chip em modo
estação (`WIFI_STA`), chama `WiFi.begin(ssid, senha)` e espera até o status virar
`WL_CONNECTED`. É chamada no `setup()`.

**"Como o sistema embarcado recebe a configuração?"**
Função `buscarConfig()`: abre uma conexão TCP com o Gateway (`cliente.connect`),
monta uma requisição `GET /config` na mão, lê a resposta inteira numa String,
procura o campo `distancia_limite` e converte pra número. Roda a cada 10s.

**"Como as leituras chegam no backend?"**
Função `enviarLeitura()`: monta um JSON com a distância e se detectou, e envia
uma requisição `POST /leituras` (com `Content-Type` e `Content-Length`) pelo
mesmo cliente TCP. Roda a cada 5s.

**"Por que a distância pode dar -1?"**
Em `medirDistancia()`, o `pulseIn` tem um timeout de 30ms. Se não voltar eco
(objeto fora de alcance), retorna 0 e a função devolve -1, sinalizando leitura
inválida. No `loop`, só marcamos "detectado" quando a distância é válida (>= 0).

**"O que o Gateway faz?"**
É o único ponto de entrada. Ele não tem lógica de negócio: só recebe a
requisição e **encaminha** (com o axios) pro microservice certo — `/config` vai
pro Controle (3001), `/leituras` vai pro Logging (3002). Assim o NodeMCU e o app
só precisam saber um endereço.

**"Por que separar em Controle e Logging?"**
São responsabilidades diferentes: um cuida da configuração, o outro do registro
de dados. Cada um tem seu próprio banco. É a ideia de microservices.

**"Como os dados são guardados?"**
Cada serviço usa SQLite. O Controle tem a tabela `config` (uma linha com o
limite). O Logging tem a tabela `leituras` (id, distância, detectado, data/hora).

**"Como o app mostra os dados?"**
No `useEffect`, ao abrir, ele busca a config e as leituras, e cria um
`setInterval` que refaz o `GET /leituras` a cada 5s. A lista aparece num
`FlatList`, com a cor verde (LIVRE) ou vermelha (DETECTADO).

**"Como o atuador é acionado?"**
No `loop`, `digitalWrite(sinalizador, detectado)` liga o LED/buzzer quando
`detectado` é verdadeiro (distância abaixo do limite) e desliga quando não é.

---

## Onde cada critério de avaliação é atendido

| Critério                  | Onde                                              |
| ------------------------- | ------------------------------------------------- |
| Leitura do sensor         | `medirDistancia()` – trigPin/echoPin + `pulseIn`  |
| Controle do atuador       | `loop()` – `digitalWrite(sinalizador, detectado)` |
| Configuração via backend  | `buscarConfig()` – `GET /config`                  |
| Envio de dados p/ backend | `enviarLeitura()` – `POST /leituras`              |
| App: leitura dos dados    | `buscarLeituras()` – `GET /leituras`              |
| App: visualização         | `FlatList` no `App.js`                            |
| App: configuração         | `salvarConfig()` – `PUT /config`                  |
| Backend: configuração     | `Controle.js` – rotas `GET`/`PUT /config`         |
| Backend: recebe dados     | `Logging.js` – `POST /leituras`                   |
| Backend: envia ao app     | `Logging.js` – `GET /leituras`                    |
