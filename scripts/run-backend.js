import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(__dirname, "..", "backend");
const isWin = process.platform === "win32";

const candidates = isWin ? ["python", "py"] : ["python3", "python"];

function trySpawn(index) {
  if (index >= candidates.length) {
    console.error(
      "Python을 찾을 수 없습니다. backend/requirements.txt 설치 후 다시 시도하세요.",
    );
    console.error("  Windows: pip install -r backend/requirements.txt");
    console.error("  macOS:   pip3 install -r backend/requirements.txt");
    process.exit(1);
  }

  const python = candidates[index];
  const args = ["-m", "uvicorn", "main:app", "--reload", "--port", "8000"];
  const proc = spawn(python, args, {
    cwd: backendDir,
    stdio: "inherit",
  });

  proc.on("error", () => trySpawn(index + 1));
  proc.on("exit", (code) => process.exit(code ?? 1));
}

trySpawn(0);
