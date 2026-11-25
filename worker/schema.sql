-- Demandes proposées par les visiteurs (base D1 de Cloudflare, privée)
CREATE TABLE IF NOT EXISTS demandes (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'publiee')),
  type        TEXT NOT NULL,
  target_name TEXT NOT NULL,
  payload     TEXT NOT NULL, -- demande complète (JSON)
  ip_hash     TEXT           -- limite d'envois ; effacé après 24 h
);
CREATE INDEX IF NOT EXISTS demandes_date ON demandes(created_at);
