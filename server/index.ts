import { config } from "dotenv";
config({ path: ".env.local" });
import express from "express";
import cors from "cors";
import { mkdirSync } from "fs";
import { join } from "path";
import apiRouter from "./routes/api";

// Ensure required data directories exist on startup
const DATA_DIR = join(__dirname, "../data");
mkdirSync(join(DATA_DIR, "document-dump"), { recursive: true });
mkdirSync(join(DATA_DIR, "document-unmatched"), { recursive: true });

const app = express();
const PORT = 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.use("/api", apiRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
