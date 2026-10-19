# Mapa de producto · Garage Premium Moderno

Este mapa toma como referencia el **Hito 1** de la presentación de Joel Trujillo y Joaquín Guajardo. El archivo `Mapa-de-producto-editable.pptx` contiene una diapositiva editable con el recorrido y sus dependencias. `Presentacion-con-mapa-de-producto.pptx` añade esa diapositiva al final de la presentación original sin modificar sus ocho diapositivas.

## Recorrido que debe implementar el producto

| Bloque del mapa | Pantalla o ruta sugerida | Acción principal | Datos que necesita | Regla de acceso |
| --- | --- | --- | --- | --- |
| Inicio | `/` | Explicar el valor; ir a catálogo, planes o cuenta | Contenido editorial | Pública |
| Catálogo | `/catalogo` | Elegir tipo, marca, modelo, año y km | Catálogo versionado y rango de años por modelo | Público; explorar no guarda la ficha |
| Cuenta | `/acceso` | Registrarse e iniciar sesión | Supabase Auth y perfil | Pública; guardar requiere sesión |
| Mi garage | `/mi-garage` | Ver, agregar y actualizar vehículos propios | `vehicles`, propiedad por usuario | Free: máximo 2; Premium: sin límite |
| Planes | `/planes` | Comparar Free y Premium | Reglas y estado del plan | Pública; no afirmar pagos online |
| Orientación IA | `/ia/:vehicleId` | Añadir observaciones y solicitar guía | Vehículo, kilometraje y reporte | Sesión Premium; Gemini solo desde servidor |
| Hablemos | `/hablemos` | Enviar consulta o sugerencia | `contact_requests` | Pública; protección contra abuso |

El formulario del catálogo sigue `tipo → marca → modelo → año → kilometraje`. El kilometraje acepta enteros de **0 a 999.999 km**; el modelo define el rango de años. La presentación muestra auto y moto. Si se mantiene camioneta del código ya desarrollado, debe aparecer explícitamente en la propuesta y el catálogo debe respaldarla. Los años iniciales son referencias y requieren documentación chilena antes de declarar que representan la primera venta local.

## Flujo de datos

1. **Navegador:** HTML, CSS y JavaScript muestran las pantallas y mantienen el estado de la sesión. Puede leer el catálogo público. Usa la clave *pública* de Supabase; nunca contiene claves privadas.
2. **Supabase Auth:** confirma identidad. Cada vehículo tiene `user_id` y políticas RLS para que una cuenta solo pueda leer o modificar sus fichas.
3. **Planes:** el límite Free de dos vehículos se comprueba **en la base de datos o en una operación transaccional del servidor**, además de mostrarlo en la interfaz. El cliente no puede cambiar su propio estado Premium. Como no hay pago online en el Hito 1, la activación Premium debe ser administrativa o una prueba explícitamente simulada.
4. **API Node.js/Express en Render:** verifica el token de Supabase, comprueba que el vehículo pertenece al usuario y que el plan está activo, limita solicitudes y llama a Gemini con la clave guardada en el servidor. Devuelve un reporte breve de estado orientativo, puntos para revisar y mantenimiento. Debe evitar frases que parezcan un diagnóstico confirmado.
5. **Hablemos:** el formulario envía asunto, tema y mensaje a un endpoint con límite de frecuencia. Ese endpoint guarda la solicitud en Supabase y devuelve confirmación. La lectura de solicitudes queda reservada al equipo.
6. **Publicación:** Render sirve el frontend y la API. La URL pública y las redirecciones de Auth se configuran para ese dominio.

## Datos mínimos

| Tabla | Campos clave | Control |
| --- | --- | --- |
| `profiles` | `id`, `full_name`, `plan`, `premium_until` | El usuario lee su perfil; solo el servidor o administración cambia el plan |
| `vehicle_catalog` | `type`, `brand`, `model`, `first_year` | Lectura pública; cambios administrados |
| `vehicles` | `id`, `user_id`, `type`, `brand`, `model`, `year`, `mileage` | RLS por `user_id`; límite Free y validación de datos en servidor/base |
| `contact_requests` | `id`, `topic`, `subject`, `message`, `created_at`, `user_id` opcional | Inserción controlada y limitada; lectura solo del equipo |
| `ai_reports` (opcional) | `id`, `user_id`, `vehicle_id`, `input_summary`, `report`, `created_at` | RLS por usuario; conservar únicamente si el producto necesita historial de reportes |

## Diferencias con el código actualmente entregado

El repositorio de Garaje Premium construido en esta conversación ya tiene frontend, Supabase Auth, vehículos, bitácora, RLS y una demo funcional. **El mapa representa la visión de la presentación, no una lista de funciones ya terminadas.** Para llegar a esa visión faltan estos cambios:

- Agregar el plan **Free de hasta dos vehículos** y permitir usar el garage sin activar Premium. La aplicación actual exige activar una prueba simulada antes de registrar un vehículo.
- Agregar las páginas públicas **Inicio, Catálogo, Planes y Hablemos** tal como aparecen en las diapositivas. El formulario actual de vehículo vive dentro del flujo privado.
- Implementar **Hablemos** y su tabla de solicitudes.
- Cambiar la guía del servidor: el código actual usa una **Supabase Edge Function con OpenAI**. La presentación especifica **Node.js/Express con Gemini en Render**. Escoger una arquitectura antes de publicar para evitar dos motores paralelos.
- Ajustar la salida de IA para recibir las observaciones del conductor y generar el reporte breve descrito en la diapositiva 6. Mantener la aclaración de que no diagnostica fallas.
- Configurar y verificar Render, Auth y Gemini en un entorno real. El pago online sigue fuera del alcance del Hito 1.

## Orden de implementación sugerido

1. Definir el contrato de Free/Premium y aplicar el límite de dos vehículos en base de datos; probarlo con dos usuarios y concurrencia.
2. Completar Inicio, Catálogo público, Planes y Hablemos con el mismo diseño de la presentación.
3. Implementar la API Express y el adaptador Gemini; añadir autenticación, control de propiedad, cuota y manejo de errores.
4. Unificar frontend y backend en Render, configurar variables y redirecciones, y validar el recorrido completo en producción.

El mapa es una guía de alcance para el siguiente desarrollo; no atribuye funciones aún no implementadas al prototipo actual.
