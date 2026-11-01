-- =============================================================================
-- SOS MOBILITÉ — Schéma principal
-- « Votre tranquillité, notre engagement. »
--
-- Montants : entiers en FCFA (XOF). Coordonnées : WGS84 (degrés décimaux).
-- Toutes les modifications d'état métier passent par les fonctions RPC
-- (voir 20261031000003_workflow.sql) : aucune table de workflow n'est
-- modifiable directement par les utilisateurs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('client', 'mechanic', 'admin');

-- Niveaux d'autorisation administrateur (croissants)
--   support     : réclamations, consultation des demandes
--   operations  : + validation des mécaniciens, attribution manuelle, suspensions
--   super_admin : + tarifs, paramètres, gestion de l'équipe
create type public.admin_level as enum ('support', 'operations', 'super_admin');

create type public.vehicle_type as enum ('auto', 'moto', 'marine');

create type public.verification_status as enum ('pending', 'approved', 'rejected', 'suspended');

create type public.mechanic_kind as enum ('independant', 'garage', 'depanneur');

create type public.mechanic_plan as enum ('starter', 'pro');

create type public.request_status as enum (
  'searching',       -- 1-4. demande créée, propositions envoyées aux mécaniciens compatibles
  'accepted',        -- 5.   un mécanicien a accepté la mission
  'quoted',          -- 6.   devis communiqué au client
  'quote_accepted',  -- 7.   le client a validé le devis
  'en_route',        -- 8.   le mécanicien se déplace
  'in_progress',     -- 9.   intervention commencée (code d'arrivée vérifié)
  'completed',       -- 10.  le mécanicien a terminé, en attente de confirmation client
  'paid',            -- 11.  paiement confirmé par le client, reçu émis
  'closed',          -- 12.  prestation évaluée / dossier clos
  'cancelled',
  'disputed',
  'expired'
);

create type public.assignment_status as enum ('proposed', 'accepted', 'declined', 'expired', 'withdrawn', 'cancelled');

create type public.quote_status as enum ('proposed', 'accepted', 'rejected', 'superseded');

create type public.payment_method as enum ('cash', 'orange_money', 'mtn_momo', 'wave', 'card', 'other');

create type public.payment_status as enum ('declared', 'confirmed', 'disputed', 'refunded');

create type public.ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');

create type public.ticket_category as enum ('intervention', 'paiement', 'litige', 'compte', 'securite', 'autre');

create type public.maintenance_kind as enum ('vidange', 'pneus', 'batterie', 'freins', 'revision', 'assurance', 'autre');

create type public.document_type as enum ('piece_identite', 'registre_commerce', 'photo_atelier', 'attestation', 'autre');

create type public.document_status as enum ('pending', 'accepted', 'rejected');

-- ---------------------------------------------------------------------------
-- Profils (1-1 avec auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          public.user_role not null default 'client',
  admin_level   public.admin_level,
  full_name     text not null default '' check (char_length(full_name) <= 120),
  phone         text check (phone is null or phone ~ '^\+?[0-9 ]{8,20}$'),
  email         text,
  city          text not null default 'Abidjan' check (char_length(city) <= 80),
  commune       text check (commune is null or char_length(commune) <= 80),
  avatar_url    text,
  is_suspended  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint admin_level_only_for_admins check (
    (role = 'admin' and admin_level is not null) or (role <> 'admin' and admin_level is null)
  )
);
comment on table public.profiles is 'Profil applicatif de chaque utilisateur (client, mécanicien, administrateur).';

-- ---------------------------------------------------------------------------
-- Véhicules & entretien (« Mon véhicule »)
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references public.profiles (id) on delete cascade,
  type                  public.vehicle_type not null default 'auto',
  brand                 text not null check (char_length(brand) between 1 and 60),
  model                 text not null check (char_length(model) between 1 and 60),
  year                  int check (year is null or year between 1950 and 2100),
  plate                 text check (plate is null or char_length(plate) between 2 and 20),
  color                 text check (color is null or char_length(color) <= 30),
  insurance_expires_at  date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index vehicles_owner_idx on public.vehicles (owner_id);
create unique index vehicles_owner_plate_uniq on public.vehicles (owner_id, upper(plate)) where plate is not null;

create table public.maintenance_records (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references public.vehicles (id) on delete cascade,
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  kind          public.maintenance_kind not null,
  performed_at  date not null,
  mileage_km    int check (mileage_km is null or mileage_km >= 0),
  cost          int check (cost is null or cost >= 0),
  next_due_at   date,
  notes         text check (notes is null or char_length(notes) <= 500),
  created_at    timestamptz not null default now()
);
create index maintenance_vehicle_idx on public.maintenance_records (vehicle_id, performed_at desc);
create index maintenance_due_idx on public.maintenance_records (owner_id, next_due_at) where next_due_at is not null;

-- ---------------------------------------------------------------------------
-- Catalogue des services & tarifs
-- ---------------------------------------------------------------------------
create table public.service_categories (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9_]+$'),
  name            text not null,
  description     text,
  icon            text not null default 'wrench',
  vehicle_types   public.vehicle_type[] not null default array['auto','moto']::public.vehicle_type[],
  -- Tarifs indicatifs : définis par l'administration. NULL = non communiqué.
  base_price_min  int check (base_price_min is null or base_price_min >= 0),
  base_price_max  int check (base_price_max is null or base_price_max >= 0),
  travel_fee      int check (travel_fee is null or travel_fee >= 0),
  is_active       boolean not null default true,
  sort_order      int not null default 100,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint price_range_valid check (base_price_min is null or base_price_max is null or base_price_min <= base_price_max)
);

-- ---------------------------------------------------------------------------
-- Mécaniciens / professionnels
-- ---------------------------------------------------------------------------
create table public.mechanic_profiles (
  id                   uuid primary key references public.profiles (id) on delete cascade,
  business_name        text not null default '' check (char_length(business_name) <= 120),
  kind                 public.mechanic_kind not null default 'independant',
  bio                  text check (bio is null or char_length(bio) <= 800),
  years_experience     int check (years_experience is null or years_experience between 0 and 70),
  vehicle_types        public.vehicle_type[] not null default array['auto']::public.vehicle_type[],
  service_radius_km    numeric(5,1) not null default 10 check (service_radius_km between 1 and 100),
  base_lat             double precision check (base_lat is null or base_lat between -90 and 90),
  base_lng             double precision check (base_lng is null or base_lng between -180 and 180),
  commune              text check (commune is null or char_length(commune) <= 80),
  address              text check (address is null or char_length(address) <= 200),
  opening_hours        text check (opening_hours is null or char_length(opening_hours) <= 200),
  verification_status  public.verification_status not null default 'pending',
  verified_at          timestamptz,
  verified_by          uuid references public.profiles (id),
  rejection_reason     text,
  is_available         boolean not null default false,
  plan                 public.mechanic_plan not null default 'starter',
  rating_avg           numeric(3,2) not null default 0,
  rating_count         int not null default 0,
  completed_missions   int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint available_requires_approval check (not is_available or verification_status = 'approved')
);
create index mechanic_matching_idx on public.mechanic_profiles (verification_status, is_available);

create table public.mechanic_specialties (
  mechanic_id  uuid not null references public.mechanic_profiles (id) on delete cascade,
  category_id  uuid not null references public.service_categories (id) on delete cascade,
  primary key (mechanic_id, category_id)
);
create index mechanic_specialties_category_idx on public.mechanic_specialties (category_id);

create table public.mechanic_documents (
  id            uuid primary key default gen_random_uuid(),
  mechanic_id   uuid not null references public.mechanic_profiles (id) on delete cascade,
  doc_type      public.document_type not null,
  storage_path  text not null,
  status        public.document_status not null default 'pending',
  reviewed_by   uuid references public.profiles (id),
  reviewed_at   timestamptz,
  uploaded_at   timestamptz not null default now()
);
create index mechanic_documents_mechanic_idx on public.mechanic_documents (mechanic_id);

-- ---------------------------------------------------------------------------
-- Demandes d'assistance
-- ---------------------------------------------------------------------------
create sequence public.request_ref_seq;
create sequence public.receipt_seq;

create table public.service_requests (
  id                    uuid primary key default gen_random_uuid(),
  reference             text not null unique,
  client_id             uuid not null references public.profiles (id) on delete restrict,
  vehicle_id            uuid references public.vehicles (id) on delete set null,
  vehicle_type          public.vehicle_type not null default 'auto',
  category_id           uuid not null references public.service_categories (id),
  symptoms              text[] not null default '{}',
  description           text check (description is null or char_length(description) <= 1000),
  photos                text[] not null default '{}' check (cardinality(photos) <= 5),
  lat                   double precision not null check (lat between -90 and 90),
  lng                   double precision not null check (lng between -180 and 180),
  location_accuracy_m   int,
  address_hint          text check (address_hint is null or char_length(address_hint) <= 200),
  location_consent_at   timestamptz not null,
  status                public.request_status not null default 'searching',
  search_radius_km      numeric(5,1) not null default 5,
  assigned_mechanic_id  uuid references public.mechanic_profiles (id),
  accepted_at           timestamptz,
  quote_accepted_at     timestamptz,
  en_route_at           timestamptz,
  started_at            timestamptz,
  completed_at          timestamptz,
  paid_at               timestamptz,
  closed_at             timestamptz,
  cancelled_at          timestamptz,
  cancelled_by          uuid references public.profiles (id),
  cancel_reason         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index service_requests_client_idx on public.service_requests (client_id, created_at desc);
create index service_requests_mechanic_idx on public.service_requests (assigned_mechanic_id, created_at desc);
create index service_requests_status_idx on public.service_requests (status, created_at desc);

-- Code de confirmation à l'arrivée : table séparée, lisible par le client seulement.
create table public.request_arrival_codes (
  request_id   uuid primary key references public.service_requests (id) on delete cascade,
  code         text not null check (code ~ '^[0-9]{4}$'),
  attempts     int not null default 0,
  verified_at  timestamptz
);

-- Propositions / attributions de missions aux mécaniciens
create table public.assignments (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.service_requests (id) on delete cascade,
  mechanic_id     uuid not null references public.mechanic_profiles (id) on delete cascade,
  status          public.assignment_status not null default 'proposed',
  distance_km     numeric(6,2),
  is_manual       boolean not null default false,
  proposed_at     timestamptz not null default now(),
  expires_at      timestamptz not null,
  responded_at    timestamptz,
  decline_reason  text,
  unique (request_id, mechanic_id)
);
create index assignments_mechanic_idx on public.assignments (mechanic_id, status, proposed_at desc);
create index assignments_request_idx on public.assignments (request_id, status);

-- Devis
create table public.quotes (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.service_requests (id) on delete cascade,
  mechanic_id    uuid not null references public.mechanic_profiles (id),
  version        int not null,
  labor_amount   int not null default 0 check (labor_amount >= 0),
  parts_amount   int not null default 0 check (parts_amount >= 0),
  travel_amount  int not null default 0 check (travel_amount >= 0),
  total_amount   int generated always as (labor_amount + parts_amount + travel_amount) stored,
  eta_minutes    int check (eta_minutes is null or eta_minutes between 1 and 600),
  notes          text check (notes is null or char_length(notes) <= 600),
  status         public.quote_status not null default 'proposed',
  created_at     timestamptz not null default now(),
  responded_at   timestamptz,
  unique (request_id, version),
  constraint quote_not_empty check (labor_amount + parts_amount + travel_amount > 0)
);
create index quotes_request_idx on public.quotes (request_id, version desc);

-- Historique des statuts (traçabilité)
create table public.status_history (
  id           bigint generated always as identity primary key,
  request_id   uuid not null references public.service_requests (id) on delete cascade,
  from_status  public.request_status,
  to_status    public.request_status not null,
  changed_by   uuid references public.profiles (id),
  note         text,
  created_at   timestamptz not null default now()
);
create index status_history_request_idx on public.status_history (request_id, created_at);

-- ---------------------------------------------------------------------------
-- Paiements & reçus
-- ---------------------------------------------------------------------------
create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  request_id         uuid not null unique references public.service_requests (id) on delete restrict,
  client_id          uuid not null references public.profiles (id),
  mechanic_id        uuid not null references public.mechanic_profiles (id),
  quote_id           uuid not null references public.quotes (id),
  amount             int not null check (amount > 0),
  method             public.payment_method not null,
  status             public.payment_status not null default 'declared',
  commission_rate    numeric(5,4) not null check (commission_rate between 0 and 1),
  commission_amount  int not null check (commission_amount >= 0),
  mechanic_net       int not null check (mechanic_net >= 0),
  receipt_number     text unique,
  -- Référence d'un prestataire de paiement (Orange Money, MTN, Wave, carte) :
  -- renseignée uniquement par une intégration réelle (non activée à ce stade).
  provider_reference text,
  declared_at        timestamptz not null default now(),
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index payments_mechanic_idx on public.payments (mechanic_id, created_at desc);
create index payments_status_idx on public.payments (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Avis
-- ---------------------------------------------------------------------------
create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null unique references public.service_requests (id) on delete cascade,
  client_id    uuid not null references public.profiles (id),
  mechanic_id  uuid not null references public.mechanic_profiles (id),
  rating       int not null check (rating between 1 and 5),
  comment      text check (comment is null or char_length(comment) <= 600),
  is_hidden    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index reviews_mechanic_idx on public.reviews (mechanic_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Notifications (in-app ; push/SMS branchés plus tard sur cette table)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  request_id  uuid references public.service_requests (id) on delete cascade,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Support / réclamations
-- ---------------------------------------------------------------------------
create table public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid not null references public.profiles (id) on delete cascade,
  request_id      uuid references public.service_requests (id) on delete set null,
  category        public.ticket_category not null default 'autre',
  subject         text not null check (char_length(subject) between 3 and 140),
  message         text not null check (char_length(message) between 3 and 2000),
  status          public.ticket_status not null default 'open',
  assigned_admin  uuid references public.profiles (id),
  admin_response  text check (admin_response is null or char_length(admin_response) <= 2000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
create index support_tickets_creator_idx on public.support_tickets (created_by, created_at desc);
create index support_tickets_status_idx on public.support_tickets (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Paramètres de la plateforme (modifiables par super_admin)
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id)
);
