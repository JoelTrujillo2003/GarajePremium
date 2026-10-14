import { validateVehicle } from "./catalog.js";
import { demoPlan } from "./planner.js";
const config = window.GARAJE_CONFIG;
const demo = config.demo === true;
const KEY = "garaje-premium-demo-v1";
let db;
function read() {
  try {
    return (
      JSON.parse(localStorage.getItem(KEY)) || {
        users: [],
        session: null,
        vehicles: [],
        records: [],
      }
    );
  } catch {
    throw new Error(
      "No se pudo leer la demo. Revisa el almacenamiento de tu navegador.",
    );
  }
}
function write(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}
function result({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}
async function hashPassword(password, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations: 120000,
    },
    material,
    256,
  );
  return Array.from(new Uint8Array(bits), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
function publicUser(u) {
  return { id: u.id, email: u.email, user_metadata: { full_name: u.name } };
}
function current(data) {
  const u = data.users.find((x) => x.id === data.session);
  if (!u) throw new Error("Inicia sesión para continuar.");
  return u;
}
function owner(data, id) {
  const u = current(data);
  const v = data.vehicles.find((x) => x.id === id && x.user_id === u.id);
  if (!v) throw new Error("Vehículo no disponible.");
  return v;
}
export const API = {
  demo,
  async init() {
    if (demo) {
      return API.session();
    }
    if (!config.supabaseUrl || !config.supabaseAnonKey)
      throw new Error(
        "Configura la URL y clave pública de Supabase en config.js, o activa demo.",
      );
    if (!window.supabase)
      throw new Error("No se pudo cargar Supabase. Revisa la conexión al CDN.");
    db = window.supabase.createClient(
      config.supabaseUrl,
      config.supabaseAnonKey,
    );
    return API.session();
  },
  async session() {
    if (demo) {
      const d = read(),
        u = d.users.find((u) => u.id === d.session);
      return u ? publicUser(u) : null;
    }
    const { session } = result(await db.auth.getSession());
    return session?.user || null;
  },
  onAuth(callback) {
    if (!demo)
      db.auth.onAuthStateChange((event) => {
        if (["SIGNED_IN", "SIGNED_OUT", "PASSWORD_RECOVERY"].includes(event))
          setTimeout(() => callback(event), 0);
      });
  },
  async signIn(email, password) {
    if (demo) {
      const d = read();
      const u = d.users.find((x) => x.email === email.toLowerCase());
      if (!u || u.hash !== (await hashPassword(password, u.salt)))
        throw new Error("Correo o contraseña incorrectos.");
      d.session = u.id;
      write(d);
      return publicUser(u);
    }
    return result(await db.auth.signInWithPassword({ email, password })).user;
  },
  async signUp(name, email, password) {
    if (demo) {
      const d = read();
      if (d.users.some((u) => u.email === email.toLowerCase()))
        throw new Error("Este correo ya está registrado en la demo.");
      const salt = crypto.randomUUID();
      const u = {
        id: crypto.randomUUID(),
        name,
        email: email.toLowerCase(),
        salt,
        hash: await hashPassword(password, salt),
        premium_until: null,
      };
      d.users.push(u);
      d.session = u.id;
      write(d);
      return publicUser(u);
    }
    const data = result(
      await db.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: location.origin + location.pathname,
        },
      }),
    );
    return data.session ? data.user : null;
  },
  async oauth(provider) {
    if (demo)
      throw new Error(
        "OAuth requiere configurar Supabase y el proveedor. Usa correo y contraseña para probar la demo.",
      );
    result(
      await db.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: location.origin + location.pathname,
          ...(provider === "azure" ? { scopes: "email" } : {}),
        },
      }),
    );
  },
  async reset(email) {
    if (demo)
      throw new Error(
        "La recuperación por correo está disponible al conectar Supabase. No uses una contraseña real en la demo.",
      );
    result(
      await db.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname,
      }),
    );
  },
  async changePassword(password) {
    if (demo) throw new Error("Disponible con Supabase.");
    result(await db.auth.updateUser({ password }));
  },
  async signOut() {
    if (demo) {
      const d = read();
      d.session = null;
      write(d);
    } else result(await db.auth.signOut());
  },
  async profile() {
    if (demo) {
      const d = read(),
        u = current(d);
      return { id: u.id, full_name: u.name, premium_until: u.premium_until };
    }
    return result(
      await db.from("profiles").select("id, full_name, premium_until").single(),
    );
  },
  async subscribe() {
    if (!config.enablePaymentSimulation)
      throw new Error(
        "La simulación está desactivada. Conecta una pasarela para habilitar pagos reales.",
      );
    if (demo) {
      const d = read(),
        u = current(d);
      u.premium_until = new Date(Date.now() + 30 * 86400000).toISOString();
      write(d);
      return;
    }
    result(await db.rpc("activate_simulated_subscription"));
  },
  async vehicles() {
    if (demo) {
      const d = read(),
        u = current(d);
      return d.vehicles.filter((v) => v.user_id === u.id);
    }
    return result(
      await db
        .from("vehicles")
        .select("*")
        .order("created_at", { ascending: false }),
    );
  },
  async addVehicle(values) {
    validateVehicle(values);
    if (demo) {
      const d = read(),
        u = current(d);
      if (!u.premium_until || Date.parse(u.premium_until) <= Date.now())
        throw new Error("Activa tu membresía.");
      const v = {
        ...values,
        id: crypto.randomUUID(),
        user_id: u.id,
        created_at: new Date().toISOString(),
      };
      d.vehicles.unshift(v);
      write(d);
      return v;
    }
    const user = await API.session();
    return result(
      await db
        .from("vehicles")
        .insert({ ...values, user_id: user.id })
        .select()
        .single(),
    );
  },
  async updateMileage(id, mileage) {
    if (!Number.isInteger(mileage) || mileage < 0 || mileage > 999999)
      throw new Error("Kilometraje inválido.");
    if (demo) {
      const d = read(),
        v = owner(d, id);
      if (mileage < v.mileage)
        throw new Error("El kilometraje no puede disminuir.");
      v.mileage = mileage;
      write(d);
      return;
    }
    result(
      await db.rpc("update_vehicle_mileage", {
        p_vehicle_id: id,
        p_mileage: mileage,
      }),
    );
  },
  async removeVehicle(id) {
    if (demo) {
      const d = read();
      owner(d, id);
      d.vehicles = d.vehicles.filter((v) => v.id !== id);
      d.records = d.records.filter((r) => r.vehicle_id !== id);
      write(d);
    } else result(await db.from("vehicles").delete().eq("id", id));
  },
  async records(id) {
    if (demo) {
      const d = read();
      owner(d, id);
      return d.records
        .filter((r) => r.vehicle_id === id)
        .sort((a, b) => b.service_date.localeCompare(a.service_date));
    }
    return result(
      await db
        .from("maintenance_records")
        .select("*")
        .eq("vehicle_id", id)
        .order("service_date", { ascending: false }),
    );
  },
  async addRecord(id, values) {
    if (demo) {
      const d = read(),
        v = owner(d, id);
      const u = current(d);
      if (!u.premium_until || Date.parse(u.premium_until) <= Date.now())
        throw new Error("Activa tu membresía.");
      d.records.unshift({
        ...values,
        id: crypto.randomUUID(),
        user_id: u.id,
        vehicle_id: id,
        created_at: new Date().toISOString(),
      });
      v.mileage = Math.max(v.mileage, values.mileage);
      write(d);
    } else
      result(
        await db.rpc("add_maintenance_record", {
          p_vehicle_id: id,
          p_category: values.category,
          p_mileage: values.mileage,
          p_service_date: values.service_date,
          p_cost: values.cost,
          p_workshop: values.workshop,
          p_notes: values.notes,
        }),
      );
  },
  async removeRecord(id) {
    if (demo) {
      const d = read(),
        u = current(d);
      d.records = d.records.filter((r) => !(r.id === id && r.user_id === u.id));
      write(d);
    } else result(await db.from("maintenance_records").delete().eq("id", id));
  },
  async plan(vehicle, records) {
    if (demo) return demoPlan(vehicle, records);
    const { data, error } = await db.functions.invoke("maintenance-plan", {
      body: { vehicle_id: vehicle.id },
    });
    if (error) {
      let message = error.message;
      try {
        const details = await error.context?.json();
        if (details?.error) message = details.error;
      } catch {}
      throw new Error(message);
    }
    if (data.error) throw new Error(data.error);
    return data;
  },
};
