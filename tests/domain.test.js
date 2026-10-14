import test from "node:test";
import assert from "node:assert/strict";
import {
  CATALOG,
  CURRENT_YEAR,
  validateVehicle,
  parseMileage,
  formatKm,
} from "../catalog.js";
import { demoPlan } from "../planner.js";
const v = {
  type: "Moto",
  brand: "Bajaj",
  model: "Pulsar RS200",
  year: 2020,
  mileage: 15000,
};
test("catálogo restringe tipos, marcas, modelos y años dependientes", () => {
  assert.equal(CURRENT_YEAR, 2026);
  assert.deepEqual(Object.keys(CATALOG), ["Automóvil", "Camioneta", "Moto"]);
  for (const [type, brands] of Object.entries(CATALOG))
    for (const [brand, models] of Object.entries(brands))
      for (const m of models) {
        assert.ok(m.firstYear >= 1950 && m.firstYear <= 2026);
        assert.doesNotThrow(() =>
          validateVehicle({
            type,
            brand,
            model: m.name,
            year: m.firstYear,
            mileage: 0,
          }),
        );
        assert.throws(() =>
          validateVehicle({
            type,
            brand,
            model: m.name,
            year: m.firstYear - 1,
            mileage: 0,
          }),
        );
      }
  for (const changes of [
    { type: "Camión" },
    { brand: "Ford" },
    { model: "Inventado" },
    { year: 1900 },
    { year: 2027 },
    { year: 2020.5 },
    { mileage: -1 },
    { mileage: 1000000 },
    { mileage: 2.5 },
  ])
    assert.throws(() => validateVehicle({ ...v, ...changes }));
});
test("kilometraje no admite vacíos, negativos, decimales ni más de seis dígitos", () => {
  for (const value of [
    "",
    "-5",
    "1.5",
    "12,5",
    "abc",
    "1000000",
    "1.000.000",
    "15.00",
    " 200",
    "1e4",
    "NaN",
  ])
    assert.throws(() => parseMileage(value));
  for (const [input, expected] of [
    ["0", 0],
    ["999999", 999999],
    ["999.999", 999999],
    ["15000", 15000],
    ["15.000", 15000],
  ])
    assert.equal(parseMileage(input), expected);
  assert.equal(formatKm(15000), "15.000");
});
test("plan demo distingue falta de historial y respeta servicios registrados", () => {
  const initial = demoPlan(v, []);
  assert.equal(initial.source, "demo");
  assert.ok(
    initial.immediate.some(
      (t) =>
        t.title === "Aceite y filtro" &&
        t.description.includes("Sin registro previo"),
    ),
  );
  const updated = demoPlan(v, [
    { category: "Aceite y filtro", mileage: 15000 },
  ]);
  assert.ok(!updated.immediate.some((t) => t.title === "Aceite y filtro"));
  assert.equal(
    updated.upcoming.find((t) => t.title === "Aceite y filtro").targetKm,
    20000,
  );
  assert.ok(updated.tips.some((t) => t.includes("costa")));
});
