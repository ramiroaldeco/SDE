import express from "express";
import cors from "cors";
import fs from "fs/promises";
import { nanoid } from "nanoid";

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = "./votes.json";

// Deben coincidir con el frontend:
const OPTIONS = ["PRIMER AÑO","SEGUNDO AÑO","TERCER AÑO","CUARTO AÑO","QUINTO AÑO"];

app.use(cors({ origin: true, methods: ["GET","POST","OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.options("*", cors());
app.use(express.json());

async function loadData() {
  try {
    const txt = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(txt);
  } catch {
    const initial = {
      options: OPTIONS,
      counts: Object.fromEntries(OPTIONS.map(o => [o, 0])),
      votedClientIds: {},
      resetAt: new Date().toISOString()
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
}

async function saveData(data) {
  const tmp = DATA_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, DATA_FILE);
}

// Ruta raíz (evita "Cannot GET /")
app.get("/", (req, res) => res.send("OK"));

// Resultados
app.get("/results", async (req, res) => {
  try {
    const data = await loadData();
    const total = Object.values(data.counts).reduce((a, b) => a + b, 0);
    const percentages = Object.fromEntries(
      Object.entries(data.counts).map(([opt, n]) => [opt, total ? +((n*100)/total).toFixed(1) : 0])
    );
    res.json({ counts: data.counts, total, percentages, resetAt: data.resetAt });
  } catch {
    res.status(500).json({ error: "No se pudieron cargar resultados." });
  }
});

// Votar
app.post("/vote", async (req, res) => {
  try {
    const { option, clientId } = req.body || {};
    if (!option || !OPTIONS.includes(option)) return res.status(400).json({ error: "Opción inválida." });
    if (!clientId || typeof clientId !== "string") return res.status(400).json({ error: "clientId faltante." });

    const data = await loadData();
    if (data.votedClientIds[clientId]) return res.status(409).json({ error: "Este dispositivo ya votó." });

    data.counts[option] += 1;
    data.votedClientIds[clientId] = { option, at: new Date().toISOString() };
    await saveData(data);

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "No se pudo registrar el voto." });
  }
});

// Generar nuevo id opcional
app.get("/new-client-id", (req, res) => res.json({ clientId: nanoid() }));

// Resetear votos + dispositivos
app.post("/reset", async (req, res) => {
  try {
    const initial = {
      options: OPTIONS,
      counts: Object.fromEntries(OPTIONS.map(o => [o, 0])),
      votedClientIds: {},
      resetAt: new Date().toISOString()
    };
    await saveData(initial);
    res.json({ ok: true, msg: "Votos reseteados a 0" });
  } catch (e) {
    res.status(500).json({ error: "No se pudo resetear." });
  }
});

app.listen(PORT, () => console.log("Servidor escuchando en puerto", PORT));
