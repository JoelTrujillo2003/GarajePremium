// Plan orientativo para demo. No se presenta como una respuesta de IA real.
export function demoPlan(vehicle, records = []) {
  const moto = vehicle.type === "Moto";
  const intervals = moto
    ? [
        [
          "Aceite y filtro",
          5000,
          "Revisa el nivel y utiliza la especificación indicada en el manual.",
        ],
        [
          "Transmisión y cadena",
          1000,
          "Si tu moto usa cadena, revisa tensión, limpieza y lubricación.",
        ],
        [
          "Frenos y neumáticos",
          5000,
          "Comprueba desgaste, presión en frío y funcionamiento de ambos frenos.",
        ],
        [
          "Filtro de aire y bujía",
          10000,
          "Inspecciona según el manual; el polvo puede acortar el intervalo.",
        ],
      ]
    : [
        [
          "Aceite y filtro",
          10000,
          "Consulta el intervalo y la viscosidad en el manual de tu motorización.",
        ],
        [
          "Frenos y neumáticos",
          10000,
          "Revisa pastillas, discos, presión en frío y desgaste irregular.",
        ],
        [
          "Filtro de aire y habitáculo",
          15000,
          "Inspecciona ambos filtros, especialmente si circulas por caminos de tierra.",
        ],
        [
          "Refrigeración y correas",
          20000,
          "Revisa fugas, niveles y estado visible; la distribución sigue el manual específico.",
        ],
      ];
  const now = [],
    upcoming = [];
  intervals.forEach(([title, interval, description]) => {
    const completed = records
      .filter((r) => r.category === title)
      .sort((a, b) => b.mileage - a.mileage)[0];
    const target = completed ? completed.mileage + interval : interval;
    if (target <= vehicle.mileage)
      now.push({
        title,
        description: completed
          ? description
          : "Sin registro previo: verifica el historial antes de decidir un cambio. " +
            description,
        targetKm: target,
      });
    else if (target <= 999999)
      upcoming.push({ title, description, targetKm: target });
  });
  return {
    source: "demo",
    immediate: now,
    upcoming: upcoming.sort((a, b) => a.targetKm - b.targetKm),
    tips: [
      moto
        ? "En pavimento mojado, aumenta la distancia y evita frenar bruscamente sobre pintura vial."
        : "En tacos urbanos y trayectos cortos, revisa si el manual recomienda el programa de uso severo.",
      "Después de caminos con polvo, revisa el filtro de aire. No lo cambies solo por kilometraje sin inspección.",
      "Si circulas cerca de la costa, lava la sal con agua dulce y revisa signos de corrosión.",
      "Antes de un viaje por carretera o cordillera, controla neumáticos, frenos y niveles con el motor frío.",
    ],
    summary:
      "Plan de referencia basado en intervalos genéricos y tu bitácora. Confirma los plazos por tiempo, kilometraje y motorización en el manual del fabricante.",
  };
}
