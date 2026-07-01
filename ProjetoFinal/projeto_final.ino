#include <ESP8266WiFi.h>

const char* ssid = "NOME_DA_REDE";
const char* senha = "SENHA_DA_REDE";

const char* servidor = "192.168.0.100";
const int porta = 3000;

WiFiClient cliente;

const int trigPin = D5;
const int echoPin = D6;
const int sinalizador = D7;

float distancia = 0;
int distanciaLimite = 20;

unsigned long ultimaConfig = 0;
unsigned long ultimoEnvio = 0;

void conectarWiFi() {
WiFi.mode(WIFI_STA);
WiFi.begin(ssid, senha);

Serial.print("Conectando");

while (WiFi.status() != WL_CONNECTED) {
delay(500);
Serial.print(".");
}

Serial.println();
Serial.print("IP: ");
Serial.println(WiFi.localIP());
}

float medirDistancia() {
digitalWrite(trigPin, LOW);
delayMicroseconds(2);

digitalWrite(trigPin, HIGH);
delayMicroseconds(10);

digitalWrite(trigPin, LOW);

long duracao = pulseIn(echoPin, HIGH, 30000);

if (duracao == 0)
return -1;

return duracao * 0.0343 / 2.0;
}

void buscarConfig() {
if (!cliente.connect(servidor, porta)) {
Serial.println("Erro ao buscar configuração");
return;
}

cliente.println("GET /config HTTP/1.1");
cliente.print("Host: ");
cliente.println(servidor);
cliente.println("Connection: close");
cliente.println();

String resposta = "";

while (cliente.connected() || cliente.available()) {
if (cliente.available()) {
resposta += (char)cliente.read();
}
}

cliente.stop();

int i = resposta.indexOf("distancia_limite");

if (i >= 0) {
int inicio = resposta.indexOf(':', i) + 1;
int fim = resposta.indexOf('}', inicio);

distanciaLimite = resposta.substring(inicio, fim).toInt();

Serial.print("Novo limite: ");
Serial.println(distanciaLimite);
}
}

void enviarLeitura(float distancia, bool detectado) {
if (!cliente.connect(servidor, porta)) {
Serial.println("Erro ao enviar leitura");
return;
}

String json =
"{\"distancia\":" + String(distancia, 1) +
",\"detectado\":" + String(detectado ? "true" : "false") +
"}";

cliente.println("POST /leituras HTTP/1.1");
cliente.print("Host: ");
cliente.println(servidor);
cliente.println("Content-Type: application/json");
cliente.print("Content-Length: ");
cliente.println(json.length());
cliente.println("Connection: close");
cliente.println();

cliente.print(json);

while (cliente.connected() || cliente.available()) {
while (cliente.available()) {
cliente.read();
}
}

cliente.stop();

Serial.println("Leitura enviada");
}

void setup() {
Serial.begin(115200);

pinMode(trigPin, OUTPUT);
pinMode(echoPin, INPUT);
pinMode(sinalizador, OUTPUT);
}

void loop() {
distancia = medirDistancia();

bool detectado = false;

if (distancia >= 0) {
detectado = distancia < distanciaLimite;
}

digitalWrite(sinalizador, detectado);

Serial.print("Distancia: ");
Serial.print(distancia);
Serial.print(" cm | Limite: ");
Serial.print(distanciaLimite);
Serial.print(" | ");
Serial.println(detectado ? "DETECTADO" : "LIVRE");

if (millis() - ultimaConfig >= 10000) {
buscarConfig();
ultimaConfig = millis();
}

if (millis() - ultimoEnvio >= 5000) {
enviarLeitura(distancia, detectado);
ultimoEnvio = millis();
}

delay(300);
}