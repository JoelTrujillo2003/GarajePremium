// Ejecuta el código real de la Edge Function con transporte y autenticación simulados.
// Requiere Node 24+ por stripTypeScriptTypes. No llama a Supabase ni al proveedor.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
let handler;
let state;
const env = {
  ALLOWED_ORIGIN: "https://garaje.example",
  AI_API_KEY: "test-key",
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_ANON_KEY: "public-test-key",
};
globalThis.Deno = {
  env: { get: (key) => env[key] },
  serve: (fn) => {
    handler = fn;
  },
};
globalThis.__createClient = () => ({
  auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
  from(table) {
    const q = {
      select() {
        return q;
      },
      eq() {
        return q;
      },
      order() {
        return q;
      },
      async single() {
        return {
          data:
            table === "profiles"
              ? { premium_until: state.premium ? "2099-01-01" : null }
              : state.vehicle,
          error: null,
        };
      },
      async limit() {
        return { data: [], error: null };
      },
    };
    return q;
  },
  async rpc() {
    return { error: state.quota ? { message: "Espera 30 segundos" } : null };
  },
});
const source = await fs.readFile(
  new URL("../supabase/functions/maintenance-plan/index.ts", import.meta.url),
  "utf8",
);
const js = stripTypeScriptTypes(
  source.replace(
    /^import .*?;\n/,
    "const createClient = globalThis.__createClient;\n",
  ),
);
await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const reset = () => {
  state = {
    user: { id: "user-a" },
    premium: true,
    vehicle: {
      type: "Moto",
      brand: "Bajaj",
      model: "Pulsar RS200",
      year: 2020,
      mileage: 15000,
    },
    quota: false,
  };
};
const request = (changes = {}) =>
  handler(
    new Request("https://test/functions/v1/maintenance-plan", {
      method: "POST",
      headers: {
        Origin: "https://garaje.example",
        Authorization: "Bearer test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vehicle_id: "11111111-1111-4111-8111-111111111111",
      }),
      ...changes,
    }),
  );
test("Edge verifica origen, sesión, membresía, vehículo, JSON, configuración y cuota", async () => {
  reset();
  assert.equal(
    (await request({ headers: { Origin: "https://intruso.example" } })).status,
    403,
  );
  assert.equal(
    (await request({ headers: { Origin: "https://garaje.example" } })).status,
    401,
  );
  state.user = null;
  assert.equal((await request()).status, 401);
  reset();
  state.premium = false;
  assert.equal((await request()).status, 403);
  reset();
  state.vehicle = null;
  assert.equal((await request()).status, 404);
  reset();
  assert.equal((await request({ body: "{broken" })).status, 400);
  assert.equal(
    (await request({ body: JSON.stringify({ vehicle_id: "invalid" }) })).status,
    400,
  );
  const key = env.AI_API_KEY;
  delete env.AI_API_KEY;
  assert.equal((await request()).status, 503);
  env.AI_API_KEY = key;
  state.quota = true;
  assert.equal((await request()).status, 429);
  reset();
});
test("Edge acepta un plan estructurado y rechaza respuestas inválidas del proveedor", async () => {
  reset();
  const originalFetch = globalThis.fetch;
  try {
    const plan = {
      immediate: [
        {
          title: "Revisar frenos",
          description: "Verifica desgaste.",
          targetKm: 15000,
        },
      ],
      upcoming: [
        {
          title: "Aceite y filtro",
          description: "Confirma en el manual.",
          targetKm: 20000,
        },
      ],
      tips: ["Revisa presión en frío."],
      summary: "Orientación, confirma con manual e inspección.",
    };
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/chat/completions");
      const body = JSON.parse(options.body);
      assert.equal(body.response_format.json_schema.strict, true);
      assert.ok(!body.messages[1].content.includes("user-a"));
      return Response.json({
        choices: [{ message: { content: JSON.stringify(plan) } }],
      });
    };
    const good = await request();
    assert.equal(good.status, 200);
    assert.equal((await good.json()).source, "ai");
    plan.upcoming[0].targetKm = -1;
    assert.equal((await request()).status, 502);
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    assert.equal((await request()).status, 502);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
