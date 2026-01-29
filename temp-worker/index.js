import { io } from "socket.io-client";
import { exec } from "child_process";

const NEXUS_URL = process.env.NEXUS_URL || "http://localhost:3010";
const WORKER_TOKEN = process.env.WORKER_TOKEN || "dev-user-123";

console.log(`🔌 Connecting to Nexus at ${NEXUS_URL} with token ${WORKER_TOKEN}...`);

const socket = io(NEXUS_URL, {
  auth: {
    type: "worker",
    workerToken: WORKER_TOKEN
  }
});

socket.on("connect", () => {
  console.log("✅ Connected to Hub!");
});

socket.on("connect_error", (err) => {
  console.error("❌ Connection Error:", err.message);
});

socket.on("execute", (data) => {
  // data: { sessionId, command }
  console.log("📝 Received command:", data);
  const { sessionId, command } = data;

  if (!command || !command.trim()) return;

  // Simple echo/exec
  // Dangerous in prod, but fine for test
  exec(command, (error, stdout, stderr) => {
    let output = stdout || "";
    if (stderr) output += `\n[stderr] ${stderr}`;
    if (error) output += `\n[error] ${error.message}`;

    socket.emit("output", {
      sessionId,
      data: output
    });
  });
});
