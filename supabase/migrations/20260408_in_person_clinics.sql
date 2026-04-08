-- Build A: In-person clinic infrastructure
-- Creates clinics, clinic_providers, clinic_appointment_requests tables
-- Adds home location to profiles
-- Adds get_nearby_clinics(lat, lng, radius_miles) RPC using Haversine formula
-- Seeds the first Womenkind clinic (Salt Lake City — placeholder address)

-- ── Clinics ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinics (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  address     text        NOT NULL,
  city        text        NOT NULL,
  state       text        NOT NULL,
  zip         text        NOT NULL,
  lat         float       NOT NULL,
  lng         float       NOT NULL,
  phone       text,
  timezone    text        NOT NULL DEFAULT 'America/Denver',
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Clinic ↔ Provider join ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinic_providers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   uuid        NOT NULL REFERENCES clinics(id)    ON DELETE CASCADE,
  provider_id uuid        NOT NULL REFERENCES providers(id)  ON DELETE CASCADE,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, provider_id)
);

-- ── In-person appointment requests ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinic_appointment_requests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id        uuid        NOT NULL REFERENCES clinics(id)  ON DELETE CASCADE,
  preferred_dates  text,        -- freeform, e.g. "Weekdays after March 15"
  preferred_time   text,        -- 'morning' | 'afternoon' | 'either'
  notes            text,
  contact_phone    text,
  status           text        NOT NULL DEFAULT 'pending',  -- pending | scheduled | canceled
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Patient home location on profiles ────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS home_lat  float,
  ADD COLUMN IF NOT EXISTS home_lng  float,
  ADD COLUMN IF NOT EXISTS home_zip  text;

-- ── Haversine RPC ─────────────────────────────────────────────────────────────
-- Returns all active clinics within radius_miles, ordered by distance ascending.
-- Uses 3958.8 miles as Earth's radius.

CREATE OR REPLACE FUNCTION get_nearby_clinics(
  patient_lat   float,
  patient_lng   float,
  radius_miles  float DEFAULT 60
)
RETURNS TABLE (
  id             uuid,
  name           text,
  address        text,
  city           text,
  state          text,
  zip            text,
  phone          text,
  timezone       text,
  distance_miles float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.address,
    c.city,
    c.state,
    c.zip,
    c.phone,
    c.timezone,
    (
      3958.8 * acos(
        LEAST(1.0,
          cos(radians(patient_lat)) * cos(radians(c.lat)) *
          cos(radians(c.lng) - radians(patient_lng)) +
          sin(radians(patient_lat)) * sin(radians(c.lat))
        )
      )
    )::float AS distance_miles
  FROM   clinics c
  WHERE  c.active = true
  AND    (
    3958.8 * acos(
      LEAST(1.0,
        cos(radians(patient_lat)) * cos(radians(c.lat)) *
        cos(radians(c.lng) - radians(patient_lng)) +
        sin(radians(patient_lat)) * sin(radians(c.lat))
      )
    )
  ) <= radius_miles
  ORDER BY distance_miles ASC;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinics_authenticated_read"
  ON clinics FOR SELECT TO authenticated
  USING (active = true);

ALTER TABLE clinic_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinic_providers_authenticated_read"
  ON clinic_providers FOR SELECT TO authenticated
  USING (true);

ALTER TABLE clinic_appointment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients_own_clinic_requests"
  ON clinic_appointment_requests FOR ALL TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
  );
CREATE POLICY "service_role_all_clinic_requests"
  ON clinic_appointment_requests FOR ALL TO service_role
  USING (true);

-- ── Seed: Womenkind Salt Lake City ────────────────────────────────────────────
-- Placeholder address — update via Supabase dashboard when confirmed.
-- Coordinates are the approximate center of downtown SLC.

INSERT INTO clinics (name, address, city, state, zip, lat, lng, phone, timezone)
VALUES (
  'Womenkind Salt Lake City',
  '123 South Main Street',
  'Salt Lake City',
  'UT',
  '84101',
  40.7608,
  -111.8910,
  NULL,
  'America/Denver'
)
ON CONFLICT DO NOTHING;

-- Link Dr. Urban to the SLC clinic
INSERT INTO clinic_providers (clinic_id, provider_id)
SELECT c.id, p.id
FROM   clinics   c
JOIN   providers p ON p.id = 'b0000000-0000-0000-0000-000000000001'
WHERE  c.city = 'Salt Lake City'
ON CONFLICT DO NOTHING;
