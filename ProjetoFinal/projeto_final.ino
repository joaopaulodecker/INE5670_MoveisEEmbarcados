// ============================================================
//  SISTEMA EMBARCADO - Projeto Final
//  Placa: Arduino Uno + modulo WiFi ESP8266 (ESP-01)
//
//  Sensor:  HC-SR04 (ultrassonico) -> mede a distancia
//  Atuador: LED / buzzer            -> liga quando algo e detectado
//
//  O limite de distancia e lido do BACKEND (servico Controle).
//  As leituras sao enviadas ao BACKEND (servico Logging).
//
//  Biblioteca necessaria (instalar pelo Gerenciador de
//  Bibliotecas da Arduino IDE):  WiFiEsp  (by bportaluri)
//  (SoftwareSerial ja vem com a IDE)
// ============================================================

#include "WiFiEsp.h"
#include <SoftwareSerial.h>

// ===== Comunicacao com o modulo ESP-01 =====
// Pino 2 do Arduino = RX  <- ligado no TX do ESP-01
// Pino 3 do Arduino = TX  -> ligado no RX do ESP-01 (usar divisor de tensao!)
SoftwareSerial esp8266(2, 3); // (RX, TX)

// ===== Rede WiFi (PREENCHER) =====
char ssid[] = "NOME_DA_REDE";
char senha[] = "SENHA_DA_REDE";

// ===== Backend =====
// So o IP (sem "http://"). Descubra com ipconfig/ifconfig.
char servidor[] = "192.168.0.100";
int porta = 3000;

WiFiEspClient cliente;

// ===== Pinos do sensor e do atuador =====
const int trigPin     = 9;
const int echoPin     = 10;
const int sinalizador = 7;   // LED ou buzzer

// ===== Variaveis =====
long  duracao;
float distancia;
int   distanciaLimite = 20;  // valor padrao; sera atualizado pelo backend

unsigned long ultimaConfig = 0;
unsigned long ultimoEnvio  = 0;

void setup() {
  Serial.begin(9600);     // monitor serial (USB)
  esp8266.begin(9600);    // comunicacao com o ESP-01 (deve estar em 9600 baud)
  WiFi.init(&esp8266);    // a WiFiEsp vai usar o ESP-01

  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(sinalizador, OUTPUT);

  // verifica se o modulo respondeu
  if (WiFi.status() == WL_NO_SHIELD) {
    Serial.println("Modulo ESP-01 nao encontrado. Verifique a fiacao/baud.");
    while (true);  // trava aqui de proposito
  }

  // conecta na rede (tenta ate conseguir)
  int status = WL_IDLE_STATUS;
  while (status != WL_CONNECTED) {
    Serial.print("Conectando na rede: ");
    Serial.println(ssid);
    status = WiFi.begin(ssid, senha);
  }
  Serial.print("Conectado! IP: ");
  Serial.println(WiFi.localIP());

  buscarConfig();  // pega a configuracao inicial do backend
}

void loop() {
  // ----- Mede a distancia com o sensor ultrassonico -----
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  duracao = pulseIn(echoPin, HIGH);
  distancia = duracao * 0.034 / 2;

  bool detectado = (distancia < distanciaLimite);

  // ----- Aciona o atuador -----
  if (detectado) {
    Serial.print("DETECTADO! ");
    digitalWrite(sinalizador, HIGH);
  } else {
    Serial.print("LIVRE ");
    digitalWrite(sinalizador, LOW);
  }

  Serial.print("Limite:");
  Serial.print(distanciaLimite);
  Serial.print(" Dist:");
  Serial.println(distancia);

  // ----- A cada 10s: atualiza a configuracao vinda do backend -----
  if (millis() - ultimaConfig > 10000) {
    buscarConfig();
    ultimaConfig = millis();
  }

  // ----- A cada 5s: envia a leitura ao backend -----
  if (millis() - ultimoEnvio > 5000) {
    enviarLeitura(distancia, detectado);
    ultimoEnvio = millis();
  }

  delay(300);
}

// Le a configuracao (distancia limite) do backend
void buscarConfig() {
  if (cliente.connect(servidor, porta)) {
    // monta a requisicao HTTP GET "na mao"
    cliente.println("GET /config HTTP/1.1");
    cliente.print("Host: ");
    cliente.println(servidor);
    cliente.println("Connection: close");
    cliente.println();

    // le a resposta inteira numa String
    String resposta = "";
    unsigned long inicio = millis();
    while (cliente.connected() && (millis() - inicio < 3000)) {
      while (cliente.available()) {
        resposta += (char) cliente.read();
        inicio = millis();
      }
    }
    cliente.stop();

    // procura "distancia_limite" no corpo da resposta
    // resposta contem algo como: {"id":1,"distancia_limite":20}
    int i = resposta.indexOf("distancia_limite");
    if (i >= 0) {
      int ini = resposta.indexOf(":", i) + 1;
      int fim = resposta.indexOf("}", ini);
      distanciaLimite = resposta.substring(ini, fim).toInt();
      Serial.print(">> Config atualizada. Limite = ");
      Serial.println(distanciaLimite);
    }
  } else {
    Serial.println(">> Falha ao conectar no backend (config)");
  }
}

// Envia uma leitura do sensor ao backend
void enviarLeitura(float dist, bool detectado) {
  if (cliente.connect(servidor, porta)) {
    // monta o JSON
    String corpo = "{\"distancia\":" + String(dist, 1) +
                   ",\"detectado\":" + (detectado ? "true" : "false") + "}";

    // monta a requisicao HTTP POST "na mao"
    cliente.println("POST /leituras HTTP/1.1");
    cliente.print("Host: ");
    cliente.println(servidor);
    cliente.println("Content-Type: application/json");
    cliente.print("Content-Length: ");
    cliente.println(corpo.length());
    cliente.println("Connection: close");
    cliente.println();
    cliente.print(corpo);   // corpo, sem quebra de linha extra

    Serial.println(">> Leitura enviada");
    cliente.stop();
  } else {
    Serial.println(">> Falha ao conectar no backend (leitura)");
  }
}
