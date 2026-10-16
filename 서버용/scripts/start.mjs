import { spawn } from "node:child_process";

const port = process.env.PORT || "3847";
const child = spawn(
  process.execPath,
  ["./node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", port],
  { stdio: "inherit", env: process.env }
);

child.on("exit", (code) => process.exit(code ?? 0));
