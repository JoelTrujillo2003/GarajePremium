// Copia los valores públicos de Supabase > Project Settings > API.
// La clave publicable/anon es pública. Nunca uses service_role aquí.
window.GARAJE_CONFIG = Object.freeze({
  supabaseUrl: "",
  supabaseAnonKey: "",
  demo: true, // false exige Supabase; la demo almacena datos solo en este navegador.
  enablePaymentSimulation: true, // En Supabase requiere habilitar también app_settings.
});
