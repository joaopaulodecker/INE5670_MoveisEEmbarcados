int trigPin = 9;
int echoPin = 10;
int sinalizadores = 7;
int potPin = A0;
int valor = 0;

long duracao;
float distancia;

void setup() {
Serial.begin(9600);
pinMode(trigPin, OUTPUT);
pinMode(echoPin, INPUT);
pinMode(sinalizadores, OUTPUT);
}

void loop() {
valor = analogRead(potPin);
digitalWrite(trigPin, LOW);
delayMicroseconds(2);

digitalWrite(trigPin, HIGH);
delayMicroseconds(10);
digitalWrite(trigPin, LOW);

duracao = pulseIn(echoPin, HIGH);
distancia = duracao * 0.034 / 2;


if (distancia < valor) {
Serial.print("DETECTADO! ");
} else {
Serial.print("LIVRE ");
}

Serial.print("Limite:");
Serial.print(valor);
Serial.print(" Dist:");
Serial.println(distancia);

if (distancia < valor) {
digitalWrite(sinalizadores, HIGH);
delay(500);
digitalWrite(sinalizadores, LOW);
}

delay(500);
}