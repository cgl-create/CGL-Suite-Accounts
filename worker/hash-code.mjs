#!/usr/bin/env node
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const rl = createInterface({ input: stdin, output: stdout });
try {
  const code = await rl.question("Enter the employee code (input may be visible in this terminal): ");
  if (code.length < 12) {
    console.error("Use a unique code of at least 12 characters, preferably randomly generated.");
    process.exitCode = 1;
  } else {
    const salt = randomBytes(16);
    const hash = pbkdf2Sync(code, salt, 310000, 32, "sha256");
    console.log(JSON.stringify({
      codeSalt: salt.toString("hex"),
      codeHash: hash.toString("hex"),
      algorithm: "PBKDF2-HMAC-SHA-256",
      iterations: 310000
    }, null, 2));
    console.log("Store only codeSalt and codeHash in the Cloudflare secret. Never store or commit the plaintext code.");
  }
} finally {
  rl.close();
}
