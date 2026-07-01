# Projeto Final - Sistemas Móveis e Embarcados

Sistema de detecção de presença por distância. Um sensor ultrassônico mede a
distância; se ela ficar abaixo de um **limite configurável**, um atuador (LED
ou buzzer) é acionado. O limite é definido pelo **app** e lido pelo **sistema
embarcado**; as leituras são guardadas no **backend** e mostradas no **app**.

Placa usada: **Arduino Uno + módulo WiFi ESP8266 (ESP-01)**.

## Arquitetura

```
  Arduino ──┐                    ┌── CONTROLE (3001) ── config.db
   +ESP01   ├── API GATEWAY (3000)┤
  App     ──┘                    └── LOGGING  (3002) ── registros.db
```

- **Arduino** e **App** só falam com o **API Gateway** (porta 3000).
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
- Usa a biblioteca **WiFiEsp** + **SoftwareSerial** para falar com o ESP-01.

**App (`App.js`, React Native / Expo):**

- Configura o limite e envia ao backend (`PUT /config`).
- Busca e mostra as leituras (`GET /leituras`), atualizando a cada 5s.

---

## Como rodar

### 1. Descobrir o IP do computador (o que roda o backend)

- **Windows:** `ipconfig` → procure "Endereço IPv4" (ex.: 192.168.0.100)
- **Linux/Mac:** `ifconfig` ou `ip addr`

> Coloque o **celular, o Arduino e o computador na MESMA rede WiFi**.

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

> **Windows:** se o celular/Arduino não conseguirem conectar, libere o Node.js
> no **Firewall do Windows** (aparece um aviso na primeira execução — clique em
> "Permitir acesso").

> **Se o `npm install` falhar ao compilar o `sqlite3`:** use o **Node.js 20 LTS**
> (ou 18). Versões muito novas do Node às vezes não têm o binário pronto do sqlite3.

### 3. Sistema embarcado (Arduino Uno + ESP-01)

**Biblioteca:** na Arduino IDE, abra _Gerenciar Bibliotecas_ e instale **WiFiEsp**
(by bportaluri). A `SoftwareSerial` já vem com a IDE.

**No `projeto_final.ino`, edite no topo:**

```cpp
char ssid[]     = "NOME_DA_REDE";
char senha[]    = "SENHA_DA_REDE";
char servidor[] = "192.168.0.100";  // <- IP do PC (SÓ o número, sem http://)
```

Selecione a placa **Arduino Uno**, faça o upload e abra o **Monitor Serial**
(9600 baud) pra acompanhar.

**Circuito:**

_Sensor e atuador (funcionam em 5V, ligação direta):_

- HC-SR04: `VCC→5V`, `GND→GND`, `Trig→pino 9`, `Echo→pino 10`
- LED (atuador): `pino 7 → resistor 220Ω → LED → GND` (ou um buzzer no lugar)

_Módulo ESP-01 (3.3V — precisa de atenção):_

- `VCC → 3.3V` (use uma fonte 3.3V dedicada; ver aviso abaixo)
- `GND → GND` (GND comum entre Arduino, fonte e ESP-01)
- `CH_PD (EN) → 3.3V`
- `TX  do ESP → pino 2 do Arduino` (ligação direta)
- `RX  do ESP → pino 3 do Arduino` **através de um divisor de tensão** (5V→3.3V):
  `pino 3 → 1kΩ → (nó) → RX do ESP` e `(nó) → 2kΩ → GND`
- `GPIO0` e `RST`: deixar soltos (operação normal)

> **⚠ Alimentação do ESP-01:** ele puxa picos de corrente altos (~250mA). O pino
> 3.3V do Arduino Uno **não dá conta** e causa resets/instabilidade. Use uma
> fonte/regulador 3.3V dedicado e um capacitor de ~100µF entre VCC e GND do ESP-01.

> **⚠ Baud do ESP-01 (causa nº 1 de não funcionar):** o SoftwareSerial do Uno
> não é confiável a 115200. Se o seu ESP-01 vier de fábrica em 115200, mude para
> 9600 uma vez com o comando AT: **`AT+UART_DEF=9600,8,1,0,0`** (fica permanente).
> Depois disso o `esp8266.begin(9600)` do código funciona.

### 4. App (celular)

1. Abra o Expo Snack (snack.expo.dev) ou um projeto Expo.
2. Cole o conteúdo de `App.js`.
3. Em `SERVIDOR`, troque o IP pelo do passo 1.
4. Abra no **celular** com o app **Expo Go** (o emulador NÃO acessa a rede).

---

## Roteiro pra apresentação (perguntas prováveis do professor)

**"Como o Arduino conversa com o módulo WiFi?"**
O ESP-01 é um módulo serial. A gente usa a `SoftwareSerial` nos pinos 2 e 3 pra
trocar dados com ele, e a biblioteca `WiFiEsp` (com `WiFi.init(&esp8266)`) cuida
de conectar na rede e abrir conexões TCP. O monitor serial (USB) continua na
Serial de hardware.

**"Como o sistema embarcado recebe a configuração?"**
Função `buscarConfig()`: abre uma conexão TCP com o Gateway (`cliente.connect`),
monta uma requisição `GET /config` na mão, lê a resposta inteira numa String,
procura o campo `distancia_limite` e converte pra número. Roda a cada 10s.

**"Como as leituras chegam no backend?"**
Função `enviarLeitura()`: monta um JSON com a distância e se detectou, e envia
uma requisição `POST /leituras` (com `Content-Type` e `Content-Length`) pelo
mesmo cliente TCP. Roda a cada 5s.

**"O que o Gateway faz?"**
É o único ponto de entrada. Ele não tem lógica de negócio: só recebe a
requisição e **encaminha** (com o axios) pro microservice certo — `/config` vai
pro Controle (3001), `/leituras` vai pro Logging (3002). Assim o Arduino e o app
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
No `loop`, se `distancia < distanciaLimite`, liga o pino do LED/buzzer
(`digitalWrite(sinalizador, HIGH)`); senão, desliga.

---

## Onde cada critério de avaliação é atendido

| Critério                  | Onde                                        |
| ------------------------- | ------------------------------------------- |
| Leitura do sensor         | `loop()` – trigPin/echoPin + `pulseIn`      |
| Controle do atuador       | `loop()` – `digitalWrite(sinalizador, ...)` |
| Configuração via backend  | `buscarConfig()` – `GET /config`            |
| Envio de dados p/ backend | `enviarLeitura()` – `POST /leituras`        |
| App: leitura dos dados    | `buscarLeituras()` – `GET /leituras`        |
| App: visualização         | `FlatList` no `App.js`                      |
| App: configuração         | `salvarConfig()` – `PUT /config`            |
| Backend: configuração     | `Controle.js` – rotas `GET`/`PUT /config`   |
| Backend: recebe dados     | `Logging.js` – `POST /leituras`             |
| Backend: envia ao app     | `Logging.js` – `GET /leituras`              |
