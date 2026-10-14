-- Ejecutar con el SQL Editor de Supabase en un proyecto nuevo.
-- Idempotente para esta versión; no reemplaza migraciones de versiones futuras.
begin;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '',
 premium_until timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.app_settings (
 id boolean primary key default true check (id),
 payment_simulation_enabled boolean not null default false
);
insert into public.app_settings(id) values(true) on conflict do nothing;
create table if not exists public.vehicle_catalog (
 type text not null check(type in ('Automóvil','Camioneta','Moto')),
 brand text not null,
 model text not null,
 first_year integer not null check(first_year between 1950 and 2026),
 primary key(type,brand,model)
);
create table if not exists public.vehicles (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 type text not null, brand text not null, model text not null,
 year integer not null check(year between 1950 and 2026),
 mileage integer not null check(mileage between 0 and 999999),
 created_at timestamptz not null default now(),
 unique(id,user_id),
 foreign key(type,brand,model) references public.vehicle_catalog(type,brand,model)
);
create table if not exists public.maintenance_records (
 id uuid primary key default gen_random_uuid(),
 vehicle_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 category text not null check(category in ('Aceite y filtro','Transmisión y cadena','Frenos y neumáticos','Filtro de aire y bujía','Filtro de aire y habitáculo','Refrigeración y correas','Batería y sistema eléctrico','Revisión general','Otro servicio')),
 mileage integer not null check(mileage between 0 and 999999),
 service_date date not null,
 cost integer not null check(cost between 0 and 99999999),
 workshop text not null default '' check(char_length(workshop)<=100),
 notes text not null default '' check(char_length(notes)<=1500),
 created_at timestamptz not null default now(),
 foreign key(vehicle_id,user_id) references public.vehicles(id,user_id) on delete cascade
);
create table if not exists public.ai_requests (
 user_id uuid primary key references auth.users(id) on delete cascade,
 last_at timestamptz not null default now(),
 day date not null default current_date,
 count integer not null default 0
);
create index if not exists vehicles_user_idx on public.vehicles(user_id);
create index if not exists maintenance_user_vehicle_idx on public.maintenance_records(user_id,vehicle_id,service_date desc);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,full_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),80)) on conflict do nothing;
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles(id,full_name) select id,left(coalesce(raw_user_meta_data->>'full_name',''),80) from auth.users on conflict do nothing;

create or replace function public.is_premium() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and premium_until>now());
$$;
create or replace function public.validate_vehicle() returns trigger language plpgsql set search_path = '' as $$
begin
 if not exists(select 1 from public.vehicle_catalog c where c.type=new.type and c.brand=new.brand and c.model=new.model and new.year between c.first_year and 2026) then
  raise exception 'Modelo o año fuera del catálogo permitido';
 end if;
 if tg_op='UPDATE' then
  if new.user_id<>old.user_id or new.type<>old.type or new.brand<>old.brand or new.model<>old.model or new.year<>old.year then raise exception 'Los datos de identidad del vehículo no son editables'; end if;
  if new.mileage<old.mileage then raise exception 'El kilometraje no puede disminuir'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists validate_vehicle_data on public.vehicles;
create trigger validate_vehicle_data before insert or update on public.vehicles for each row execute function public.validate_vehicle();

create or replace function public.activate_simulated_subscription() returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 if not exists(select 1 from public.app_settings where id and payment_simulation_enabled) then raise exception 'La simulación está desactivada en el servidor'; end if;
 update public.profiles set premium_until=now()+interval '30 days' where id=auth.uid() and (premium_until is null or premium_until<=now());
 if not found then raise exception 'Ya tienes una membresía activa'; end if;
end; $$;
create or replace function public.update_vehicle_mileage(p_vehicle_id uuid,p_mileage integer) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_premium() then raise exception 'Membresía inactiva'; end if;
 update public.vehicles set mileage=p_mileage where id=p_vehicle_id and user_id=auth.uid();
 if not found then raise exception 'Vehículo no disponible'; end if;
end; $$;
create or replace function public.add_maintenance_record(p_vehicle_id uuid,p_category text,p_mileage integer,p_service_date date,p_cost integer,p_workshop text,p_notes text) returns void language plpgsql security definer set search_path = '' as $$
declare v public.vehicles;
begin
 if not public.is_premium() then raise exception 'Membresía inactiva'; end if;
 select * into v from public.vehicles where id=p_vehicle_id and user_id=auth.uid() for update;
 if not found then raise exception 'Vehículo no disponible'; end if;
 if p_service_date<make_date(v.year,1,1) or p_service_date>(now() at time zone 'America/Santiago')::date then raise exception 'Fecha inválida'; end if;
 insert into public.maintenance_records(vehicle_id,user_id,category,mileage,service_date,cost,workshop,notes)
 values(v.id,auth.uid(),p_category,p_mileage,p_service_date,p_cost,coalesce(p_workshop,''),coalesce(p_notes,''));
 update public.vehicles set mileage=greatest(mileage,p_mileage) where id=v.id;
end; $$;
-- Cuota atómica: máximo 20 solicitudes diarias y una cada 30 segundos por usuario.
create or replace function public.claim_ai_request() returns void language plpgsql security definer set search_path = '' as $$
declare r public.ai_requests;
begin
 if not public.is_premium() then raise exception 'Membresía inactiva'; end if;
 insert into public.ai_requests(user_id,last_at,day,count) values(auth.uid(),'-infinity',current_date,0) on conflict do nothing;
 select * into r from public.ai_requests where user_id=auth.uid() for update;
 if r.last_at>now()-interval '30 seconds' then raise exception 'Espera 30 segundos antes de generar otro plan'; end if;
 if r.day=current_date and r.count>=20 then raise exception 'Alcanzaste el límite de 20 análisis diarios'; end if;
 update public.ai_requests set last_at=now(),day=current_date,count=case when r.day=current_date then r.count+1 else 1 end where user_id=auth.uid();
end; $$;

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.vehicle_catalog enable row level security;
alter table public.app_settings enable row level security;
alter table public.ai_requests enable row level security;
drop policy if exists own_profile on public.profiles;
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
drop policy if exists read_catalog on public.vehicle_catalog;
create policy read_catalog on public.vehicle_catalog for select to authenticated using(true);
drop policy if exists own_vehicles_read on public.vehicles;
create policy own_vehicles_read on public.vehicles for select to authenticated using(user_id=auth.uid());
drop policy if exists own_vehicles_insert on public.vehicles;
create policy own_vehicles_insert on public.vehicles for insert to authenticated with check(user_id=auth.uid() and public.is_premium());
drop policy if exists own_vehicles_delete on public.vehicles;
create policy own_vehicles_delete on public.vehicles for delete to authenticated using(user_id=auth.uid());
drop policy if exists own_records_read on public.maintenance_records;
create policy own_records_read on public.maintenance_records for select to authenticated using(user_id=auth.uid());
drop policy if exists own_records_delete on public.maintenance_records;
create policy own_records_delete on public.maintenance_records for delete to authenticated using(user_id=auth.uid());
-- Sin políticas de escritura para perfiles, settings, catálogo y cuota.
-- La bitácora se escribe exclusivamente mediante una transacción RPC.
revoke all on public.profiles,public.vehicles,public.maintenance_records,public.vehicle_catalog,public.app_settings,public.ai_requests from anon,authenticated;
grant select on public.profiles,public.vehicle_catalog to authenticated;
grant select,insert,delete on public.vehicles to authenticated;
grant select,delete on public.maintenance_records to authenticated;
revoke all on function public.handle_new_user(),public.validate_vehicle(),public.is_premium(),public.activate_simulated_subscription(),public.update_vehicle_mileage(uuid,integer),public.add_maintenance_record(uuid,text,integer,date,integer,text,text),public.claim_ai_request() from public,anon;
grant execute on function public.is_premium(),public.activate_simulated_subscription(),public.update_vehicle_mileage(uuid,integer),public.add_maintenance_record(uuid,text,integer,date,integer,text,text),public.claim_ai_request() to authenticated;

-- Mantener sincronizado con catalog.js.
insert into public.vehicle_catalog(type,brand,model,first_year) values
('Automóvil','Chevrolet','Sail',2011),
('Automóvil','Chevrolet','Onix',2013),
('Automóvil','Chevrolet','Spark',2006),
('Automóvil','Suzuki','Swift',2005),
('Automóvil','Suzuki','Baleno',2016),
('Automóvil','Suzuki','Alto',2000),
('Automóvil','Toyota','Yaris',2000),
('Automóvil','Toyota','Corolla',1990),
('Automóvil','Toyota','RAV4',1996),
('Automóvil','Hyundai','Accent',1995),
('Automóvil','Hyundai','Grand i10',2014),
('Automóvil','Hyundai','Tucson',2005),
('Automóvil','Kia','Rio',2001),
('Automóvil','Kia','Morning',2004),
('Automóvil','Kia','Sportage',1995),
('Automóvil','Peugeot','208',2013),
('Automóvil','Peugeot','308',2008),
('Automóvil','Peugeot','2008',2014),
('Automóvil','Mazda','Mazda3',2004),
('Automóvil','Mazda','Mazda2',2008),
('Automóvil','Mazda','CX-5',2013),
('Automóvil','Volkswagen','Golf',1995),
('Automóvil','Volkswagen','Polo',1996),
('Automóvil','Volkswagen','T-Cross',2020),
('Automóvil','Nissan','Versa',2012),
('Automóvil','Nissan','Sentra',1995),
('Automóvil','Nissan','Qashqai',2008),
('Automóvil','Subaru','Impreza',1995),
('Automóvil','Subaru','Forester',1998),
('Automóvil','Subaru','XV',2012),
('Camioneta','Toyota','Hilux',1990),
('Camioneta','Ford','Ranger',1997),
('Camioneta','Ford','F-150',1998),
('Camioneta','Mitsubishi','L200',1990),
('Camioneta','Nissan','Navara',2008),
('Camioneta','Nissan','NP300',2016),
('Camioneta','Chevrolet','D-Max',2005),
('Camioneta','Chevrolet','Colorado',2016),
('Camioneta','Chevrolet','Silverado',1999),
('Camioneta','Great Wall','Wingle 5',2011),
('Camioneta','Great Wall','Wingle 7',2019),
('Camioneta','Great Wall','Poer',2021),
('Camioneta','Maxus','T60',2017),
('Camioneta','Maxus','T90',2022),
('Camioneta','JAC','T6',2016),
('Camioneta','JAC','T8',2019),
('Camioneta','Changan','Hunter',2020),
('Camioneta','Mahindra','Pik Up',2007),
('Moto','Yamaha','MT-03',2016),
('Moto','Yamaha','YZF-R3',2015),
('Moto','Yamaha','FZ 16',2010),
('Moto','Yamaha','Tenere 700',2020),
('Moto','Kawasaki','Ninja 400',2018),
('Moto','Kawasaki','Z400',2019),
('Moto','Kawasaki','Versys 650',2008),
('Moto','KTM','Duke 200',2013),
('Moto','KTM','Duke 390',2014),
('Moto','KTM','390 Adventure',2020),
('Moto','Bajaj','Pulsar RS200',2016),
('Moto','Bajaj','Pulsar NS200',2013),
('Moto','Bajaj','Dominar 400',2018),
('Moto','Honda','CB190R',2016),
('Moto','Honda','CB500F',2014),
('Moto','Honda','XR150L',2015),
('Moto','Suzuki','Gixxer 150',2015),
('Moto','Suzuki','V-Strom 650',2005),
('Moto','Suzuki','GSX-R150',2018),
('Moto','TVS','Apache RTR 160',2014),
('Moto','TVS','Apache RTR 200',2017),
('Moto','TVS','Apache RR 310',2019),
('Moto','BMW Motorrad','G 310 R',2017),
('Moto','BMW Motorrad','G 310 GS',2018),
('Moto','BMW Motorrad','R 1250 GS',2019),
('Moto','Benelli','TNT 300',2015),
('Moto','Benelli','TRK 502',2018),
('Moto','Benelli','Leoncino 500',2018)
on conflict(type,brand,model) do update set first_year=excluded.first_year;
commit;
