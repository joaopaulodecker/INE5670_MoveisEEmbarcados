//  APLICATIVO MOVEL - Projeto Final (React Native / Expo)
//
//  - Configura o sistema embarcado (envia a distancia limite
//    para o backend, via PUT /config)
//  - Mostra as leituras do sensor (busca do backend, via
//    GET /leituras) e atualiza a cada 5 segundos
//
//  IMPORTANTE: rode no CELULAR (Expo Go), nao no emulador,
//  porque o emulador nao acessa o backend pela rede.
//  O celular, o ESP32 e o PC do backend devem estar na
//  MESMA rede WiFi.
// ============================================================

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";

// IP do PC que roda o backend (Gateway). Troque pelo IP da sua maquina.
const SERVIDOR = "http://192.168.0.100:3000";

export default function App() {
  const [limite, setLimite] = useState("");
  const [leituras, setLeituras] = useState([]);

  // Quando o app abre: busca a config atual e as leituras.
  // Depois atualiza as leituras a cada 5 segundos.
  useEffect(() => {
    buscarConfig();
    buscarLeituras();
    const intervalo = setInterval(buscarLeituras, 5000);
    return () => clearInterval(intervalo);
  }, []);

  // Busca a configuracao atual do backend
  function buscarConfig() {
    fetch(SERVIDOR + "/config")
      .then((r) => r.json())
      .then((dados) => setLimite(String(dados.distancia_limite)))
      .catch((e) => console.log("Erro ao buscar config:", e));
  }

  // Envia a nova configuracao para o backend
  function salvarConfig() {
    fetch(SERVIDOR + "/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ distancia_limite: Number(limite) }),
    })
      .then((r) => r.json())
      .then(() => Alert.alert("Sucesso", "Configuracao salva!"))
      .catch((e) => console.log("Erro ao salvar config:", e));
  }

  // Busca as leituras do sensor no backend
  function buscarLeituras() {
    fetch(SERVIDOR + "/leituras")
      .then((r) => r.json())
      .then((dados) => setLeituras(dados))
      .catch((e) => console.log("Erro ao buscar leituras:", e));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Configuracao do Sensor</Text>
      <Text style={styles.label}>Distancia limite (cm):</Text>
      <TextInput
        style={styles.input}
        value={limite}
        onChangeText={setLimite}
        keyboardType="numeric"
      />
      <Button title="Salvar configuracao" onPress={salvarConfig} />

      <Text style={styles.titulo}>Leituras do Sensor</Text>
      <Button title="Atualizar agora" onPress={buscarLeituras} />

      <FlatList
        style={styles.lista}
        data={leituras}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemData}>{item.data_hora}</Text>
            <Text>
              {item.distancia} cm -{" "}
              <Text style={{ color: item.detectado ? "red" : "green" }}>
                {item.detectado ? "DETECTADO" : "LIVRE"}
              </Text>
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: "#fff" },
  titulo: { fontSize: 20, fontWeight: "bold", marginTop: 20, marginBottom: 10 },
  label: { marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    marginBottom: 10,
    borderRadius: 5,
  },
  lista: { marginTop: 10 },
  item: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  itemData: { fontSize: 12, color: "#666" },
});
