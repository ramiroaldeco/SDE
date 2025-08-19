import express from "express";
import cors from "cors";
import fs from "fs/promises";
import { nanoid } from "nanoid";

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = "./votes.json";

// OPCIONES DE VOTACIÓN (cambialas si querés)
const OPTIONS = [
  "PRIMER AÑO",
  "SEGUNDO AÑO",
  "TERCER AÑO",
  "CUARTO AÑO",
  "QUINTO AÑO"
];

app.use(cors());
app.use(express.json());

// Cargar/crear archivo de datos
async function loadData() {
  try {
    const txt = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(txt);
  } catch {
    const initial = {
      options: OPTIONS,
      counts: Object.fromEntries(OPTIONS.map(o => [o, 0])),
      votedClientIds: {} // clientId -> { option, at }
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
}

async function saveData(data) {
  // Escritura atómica simple
  const tmp = DATA_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, DATA_FILE);
}

// Endpoint para obtener opciones (por si las necesitás)
app.get("/options", async (req, res) => {
  const data = await loadData();
  res.json({ options: data.options });
});

// Resultados actuales (totales y porcentajes)
app.get("/results", async (req, res) => {
  const data = await loadData();
  const total = Object.values(data.counts).reduce((a, b) => a + b, 0);
  const percentages = Object.fromEntries(
    Object.entries(data.counts).map(([opt, n]) => [
      opt,
      total > 0 ? +( (n * 100) / total ).toFixed(1) : 0
    ])
  );
  res.json({ counts: data.counts, total, percentages });
});

// Votar
app.post("/vote", async (req, res) => {
  const { option, clientId } = req.body || {};
  if (!option || !OPTIONS.includes(option)) {
    return res.status(400).json({ error: "Opción inválida." });
  }
  // clientId es obligatorio (lo genera el frontend y lo guarda en localStorage)
  if (!clientId || typeof clientId !== "string") {
    return res.status(400).json({ error: "clientId faltante." });
  }

  const data = await loadData();

  if (data.votedClientIds[clientId]) {
    return res.status(409).json({ error: "Este dispositivo ya votó." });
  }

  data.counts[option] += 1;
  data.votedClientIds[clientId] = { option, at: new Date().toISOString() };
  await saveData(data);

  res.json({ ok: true });
});

// Generar clientId desde el servidor (por si querés)
app.get("/new-client-id", (req, res) => {
  res.json({ clientId: nanoid() });
});

app.listen(PORT, () => {
  console.log("Servidor escuchando en puerto", PORT);
});
