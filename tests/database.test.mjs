// Usa PGlite (PostgreSQL embebido) para verificar esquema y RLS sin credenciales.
// PGLITE_MODULE=/ruta/node_modules/@electric-sql/pglite/dist/index.js node tests/database.test.mjs
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
const sql = await fs.readFile(
  new URL("../supabase/schema.sql", import.meta.url),
  "utf8",
);
await db.exec(sql);
await db.exec(sql);
console.log("PASS esquema ejecutable e idempotente");
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
await db.query("insert into auth.users values ($1,$3),($2,$3)", [
  a,
  b,
  JSON.stringify({ full_name: "Prueba" }),
]);
const asUser = async (id) => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
};
const denied = async (sql) => {
  await assert.rejects(() => db.exec(sql));
};
await asUser(a);
assert.equal((await db.query("select * from public.profiles")).rows.length, 1);
await denied(
  "update public.profiles set premium_until=now()+interval '1 year'",
);
await denied("select public.activate_simulated_subscription()");
await denied(
  `insert into public.vehicles(user_id,type,brand,model,year,mileage) values('${a}','Moto','Bajaj','Pulsar RS200',2020,15000)`,
);
await db.exec(
  "reset role; update public.app_settings set payment_simulation_enabled=true",
);
await asUser(a);
await db.exec("select public.activate_simulated_subscription()");
await denied("select public.activate_simulated_subscription()");
await denied(
  `insert into public.vehicles(user_id,type,brand,model,year,mileage) values('${a}','Moto','Bajaj','Pulsar RS200',1900,15000)`,
);
const v = (
  await db.query(
    "insert into public.vehicles(user_id,type,brand,model,year,mileage) values($1,'Moto','Bajaj','Pulsar RS200',2020,15000) returning id",
    [a],
  )
).rows[0].id;
await db.query(
  "select public.add_maintenance_record($1,'Aceite y filtro',16000,current_date,45000,'Taller','Filtro original')",
  [v],
);
assert.equal(
  (await db.query("select mileage from public.vehicles")).rows[0].mileage,
  16000,
);
await denied(`select public.update_vehicle_mileage('${v}',15000)`);
await denied(
  `select public.add_maintenance_record('${v}','Otro servicio',16000,current_date+1,100,'','')`,
);
await db.exec("select public.claim_ai_request()");
await denied("select public.claim_ai_request()");
console.log("PASS membresía protegida, validación, transacción y límite IA");
await asUser(b);
assert.equal((await db.query("select * from public.vehicles")).rows.length, 0);
assert.equal(
  (await db.query("select * from public.maintenance_records")).rows.length,
  0,
);
await db.exec("select public.activate_simulated_subscription()");
await denied(`select public.update_vehicle_mileage('${v}',17000)`);
await denied(
  `select public.add_maintenance_record('${v}','Otro servicio',17000,current_date,0,'','')`,
);
await denied(
  `insert into public.vehicles(user_id,type,brand,model,year,mileage) values('${a}','Moto','Bajaj','Pulsar RS200',2020,15000)`,
);
assert.equal(
  (await db.query("delete from public.vehicles where id=$1 returning id", [v]))
    .rows.length,
  0,
);
console.log("PASS aislamiento entre usuarios (RLS y RPC)");
await asUser(a);
await db.query("delete from public.vehicles where id=$1", [v]);
assert.equal(
  (await db.query("select * from public.maintenance_records")).rows.length,
  0,
);
console.log("PASS eliminación en cascada");
await db.close();
