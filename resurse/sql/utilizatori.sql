-- Tipul enum pentru rolurile utilizatorilor
DO $$ BEGIN
    CREATE TYPE roluri AS ENUM ('admin', 'moderator', 'comun');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tabelul utilizatorilor
CREATE TABLE IF NOT EXISTS utilizatori (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(30)  UNIQUE NOT NULL,
    nume            VARCHAR(100),
    prenume         VARCHAR(100),
    parola          VARCHAR(64)  NOT NULL,
    rol             roluri       DEFAULT 'comun',
    email           VARCHAR(200) UNIQUE NOT NULL,
    culoare_chat    VARCHAR(10)  DEFAULT '#1d3557',
    data_adaugare   TIMESTAMP    DEFAULT NOW(),
    cod             VARCHAR(32),
    confirmat_mail  BOOLEAN      DEFAULT FALSE,
    poza            VARCHAR(200)
);

-- Tabelul accesărilor paginilor (istoric navigare)
CREATE TABLE IF NOT EXISTS accesari (
    id              SERIAL PRIMARY KEY,
    ip              VARCHAR(45),
    pagina          VARCHAR(500),
    user_id         INTEGER REFERENCES utilizatori(id) ON DELETE SET NULL,
    data_accesare   TIMESTAMP DEFAULT NOW()
);

-- Index pentru căutări rapide după username
CREATE INDEX IF NOT EXISTS idx_utilizatori_username ON utilizatori(username);

-- Index pentru curățarea accesărilor vechi (după dată)
CREATE INDEX IF NOT EXISTS idx_accesari_data ON accesari(data_accesare);
