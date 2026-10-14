// Catálogo inicial acotado al mercado chileno. Los años son referencias de
// disponibilidad, no certificación de homologación ni de la primera importación.
// Antes de producción contrasta cada rango con documentación del distribuidor
// chileno. No se permiten modelos libres: evita años arbitrarios sin un rango.
export const CURRENT_YEAR = 2026;
const models = (entries) =>
  entries.map(([name, firstYear]) => ({ name, firstYear }));
export const CATALOG = {
  Automóvil: {
    Chevrolet: models([
      ["Sail", 2011],
      ["Onix", 2013],
      ["Spark", 2006],
    ]),
    Suzuki: models([
      ["Swift", 2005],
      ["Baleno", 2016],
      ["Alto", 2000],
    ]),
    Toyota: models([
      ["Yaris", 2000],
      ["Corolla", 1990],
      ["RAV4", 1996],
    ]),
    Hyundai: models([
      ["Accent", 1995],
      ["Grand i10", 2014],
      ["Tucson", 2005],
    ]),
    Kia: models([
      ["Rio", 2001],
      ["Morning", 2004],
      ["Sportage", 1995],
    ]),
    Peugeot: models([
      ["208", 2013],
      ["308", 2008],
      ["2008", 2014],
    ]),
    Mazda: models([
      ["Mazda3", 2004],
      ["Mazda2", 2008],
      ["CX-5", 2013],
    ]),
    Volkswagen: models([
      ["Golf", 1995],
      ["Polo", 1996],
      ["T-Cross", 2020],
    ]),
    Nissan: models([
      ["Versa", 2012],
      ["Sentra", 1995],
      ["Qashqai", 2008],
    ]),
    Subaru: models([
      ["Impreza", 1995],
      ["Forester", 1998],
      ["XV", 2012],
    ]),
  },
  Camioneta: {
    Toyota: models([["Hilux", 1990]]),
    Ford: models([
      ["Ranger", 1997],
      ["F-150", 1998],
    ]),
    Mitsubishi: models([["L200", 1990]]),
    Nissan: models([
      ["Navara", 2008],
      ["NP300", 2016],
    ]),
    Chevrolet: models([
      ["D-Max", 2005],
      ["Colorado", 2016],
      ["Silverado", 1999],
    ]),
    "Great Wall": models([
      ["Wingle 5", 2011],
      ["Wingle 7", 2019],
      ["Poer", 2021],
    ]),
    Maxus: models([
      ["T60", 2017],
      ["T90", 2022],
    ]),
    JAC: models([
      ["T6", 2016],
      ["T8", 2019],
    ]),
    Changan: models([["Hunter", 2020]]),
    Mahindra: models([["Pik Up", 2007]]),
  },
  Moto: {
    Yamaha: models([
      ["MT-03", 2016],
      ["YZF-R3", 2015],
      ["FZ 16", 2010],
      ["Tenere 700", 2020],
    ]),
    Kawasaki: models([
      ["Ninja 400", 2018],
      ["Z400", 2019],
      ["Versys 650", 2008],
    ]),
    KTM: models([
      ["Duke 200", 2013],
      ["Duke 390", 2014],
      ["390 Adventure", 2020],
    ]),
    Bajaj: models([
      ["Pulsar RS200", 2016],
      ["Pulsar NS200", 2013],
      ["Dominar 400", 2018],
    ]),
    Honda: models([
      ["CB190R", 2016],
      ["CB500F", 2014],
      ["XR150L", 2015],
    ]),
    Suzuki: models([
      ["Gixxer 150", 2015],
      ["V-Strom 650", 2005],
      ["GSX-R150", 2018],
    ]),
    TVS: models([
      ["Apache RTR 160", 2014],
      ["Apache RTR 200", 2017],
      ["Apache RR 310", 2019],
    ]),
    "BMW Motorrad": models([
      ["G 310 R", 2017],
      ["G 310 GS", 2018],
      ["R 1250 GS", 2019],
    ]),
    Benelli: models([
      ["TNT 300", 2015],
      ["TRK 502", 2018],
      ["Leoncino 500", 2018],
    ]),
  },
};
export function validateVehicle(v) {
  const model = CATALOG[v.type]?.[v.brand]?.find((m) => m.name === v.model);
  if (!model)
    throw new Error("Selecciona un tipo, marca y modelo del catálogo.");
  if (
    !Number.isInteger(v.year) ||
    v.year < model.firstYear ||
    v.year > CURRENT_YEAR
  )
    throw new Error(
      `El año debe estar entre ${model.firstYear} y ${CURRENT_YEAR}.`,
    );
  if (!Number.isInteger(v.mileage) || v.mileage < 0 || v.mileage > 999999)
    throw new Error("Ingresa un kilometraje entero entre 0 y 999.999 km.");
  return v;
}
export const formatKm = (n) => new Intl.NumberFormat("es-CL").format(n);
export function parseMileage(value) {
  if (!/^\d{1,3}(?:\.\d{3})*$|^\d{1,6}$/.test(String(value)))
    throw new Error(
      "Ingresa un kilometraje válido, sin negativos ni decimales.",
    );
  const n = Number(String(value).replaceAll(".", ""));
  if (!Number.isInteger(n) || n > 999999)
    throw new Error("El máximo es 999.999 km.");
  return n;
}
