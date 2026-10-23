const TOKEN_AUDIENCE = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";
const PBKDF2_ITERATIONS = 310000;
const encoder = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function utf8Base64url(value) {
  return base64url(encoder.encode(value));
}

function hexToBytes(hex) {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error("Invalid hash configuration");
  return Uint8Array.from(hex.match(/.{2}/g), byte => parseInt(byte, 16));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hashCode(code, saltHex) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(code), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

async function signCustomToken(uid, claims, env) {
  const privateKeyPem = env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n").trim();
  const body = privateKeyPem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const der = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const header = utf8Base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = utf8Base64url(JSON.stringify({
    iss: env.FIREBASE_SERVICE_ACCOUNT_EMAIL,
    sub: env.FIREBASE_SERVICE_ACCOUNT_EMAIL,
    aud: TOKEN_AUDIENCE,
    iat: now,
    exp: now + 3600,
    uid,
    claims,
  }));
  const input = header + "." + payload;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(input));
  return input + "." + base64url(new Uint8Array(signature));
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "https://cgl-create.github.io,https://accounts.crazygamelabs.co.uk")
    .split(",").map(value => value.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : "";
}

function corsHeaders(origin) {
  return origin ? {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    "vary": "Origin",
  } : {};
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    const cors = corsHeaders(origin);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors });
    }
    if (url.pathname !== "/employee-login") return json({ error: "Not found" }, 404, cors);
    if (!origin) return json({ error: "Origin not allowed" }, 403);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

    if (!env.LOGIN_LIMIT) return json({ error: "Rate limiting is not configured. Contact the administrator." }, 503, cors);

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    {
      const ipLimit = await env.LOGIN_LIMIT.limit({ key: "ip:" + ip });
      if (!ipLimit.success) return json({ error: "Too many attempts. Wait a minute and try again." }, 429, cors);
    }

    let input;
    try {
      const length = Number(request.headers.get("content-length") || "0");
      if (length > 4096) return json({ error: "Invalid request" }, 413, cors);
      input = await request.json();
    } catch {
      return json({ error: "Invalid request" }, 400, cors);
    }

    const employeeId = typeof input.employeeId === "string" ? input.employeeId.trim() : "";
    const username = typeof input.username === "string" ? input.username.trim().toLowerCase() : "";
    const code = typeof input.code === "string" ? input.code : "";
    if (!employeeId || !username || !code || employeeId.length > 128 || username.length > 64 || code.length > 128) {
      return json({ error: "Enter your employee ID, username, and code." }, 400, cors);
    }

    if (env.LOGIN_LIMIT) {
      const userLimit = await env.LOGIN_LIMIT.limit({ key: "user:" + username });
      if (!userLimit.success) return json({ error: "Too many attempts for this username. Wait a minute and try again." }, 429, cors);
    }

    let employees;
    try {
      employees = JSON.parse(env.EMPLOYEE_RECORDS_JSON || "[]");
      if (!Array.isArray(employees)) throw new Error("Expected array");
    } catch {
      return json({ error: "Employee sign-in is not configured correctly. Contact the administrator." }, 503, cors);
    }

    const employee = employees.find(record =>
      record && record.active === true &&
      typeof record.username === "string" &&
      record.username.toLowerCase() === username &&
      record.employeeId === employeeId
    );

    // Do a PBKDF2 derivation even when the username does not exist to reduce timing differences.
    const record = employee || {
      codeSalt: "00112233445566778899aabbccddeeff",
      codeHash: "0000000000000000000000000000000000000000000000000000000000000000",
    };

    try {
      const actual = await hashCode(code, record.codeSalt);
      const expected = hexToBytes(record.codeHash);
      const validHash = safeEqual(actual, expected);
      if (!employee || !validHash) return json({ error: "Employee ID, username, or code is incorrect." }, 401, cors);

      if (!env.FIREBASE_SERVICE_ACCOUNT_EMAIL || !env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY) {
        return json({ error: "Firebase custom authentication is not configured yet." }, 503, cors);
      }

      const uid = "cgl_emp_" + employee.username.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
      const customToken = await signCustomToken(uid, {
        employee: true,
        employeeId: employee.employeeId,
        username: employee.username,
        displayName: employee.displayName,
        role: employee.role || "Employee",
      }, env);

      return json({
        customToken,
        employee: {
          uid,
          employeeId: employee.employeeId,
          username: employee.username,
          displayName: employee.displayName,
          role: employee.role || "Employee",
        },
      }, 200, cors);
    } catch {
      return json({ error: "Employee sign-in could not be completed. Contact the administrator." }, 503, cors);
    }
  },
};
