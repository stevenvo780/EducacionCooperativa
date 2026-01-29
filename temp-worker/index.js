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

const sessions = new Map();

socket.on("execute", (data) => {
  // data: { sessionId, command }
  const { sessionId, command } = data;

  // Initialize session buffer if needed
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { buffer: "" });
  }
  const session = sessions.get(sessionId);

  // command here is actually the raw input chunk (usually a single char)
  const input = command; 
  
  // Echo back to user immediately so they see what they type
  socket.emit("output", { sessionId, data: input });

  for (const char of input) {
    if (char === '\r') {
      // Enter pressed: Execute command
      socket.emit("output", { sessionId, data: '\r\n' }); // New line
      
      const cmdToRun = session.buffer.trim();
      session.buffer = ""; // Clear buffer
      
      if (!cmdToRun) {
         socket.emit("output", { sessionId, data: '$ ' });
         continue;
      }

      console.log(`🚀 Executing: ${cmdToRun}`);
      exec(cmdToRun, { cwd: process.cwd() }, (error, stdout, stderr) => {
        let output = stdout || "";
        if (stderr) output += stderr; // stderr is often just text in terminals
        if (error && !stderr) output += `Error: ${error.message}\n`;
        
        // Normalize line endings for xterm
        output = output.replace(/\n/g, '\r\n');
        
        socket.emit("output", { sessionId, data: output + '$ ' });
      });
      
    } else if (char === '\u007F') {
      // Backspace
      if (session.buffer.length > 0) {
        session.buffer = session.buffer.slice(0, -1);
        // Destructive backspace sequence
        socket.emit("output", { sessionId, data: '\b \b' });
      }
    } else {
      // Regular character
      session.buffer += char;
    }
  }
});
