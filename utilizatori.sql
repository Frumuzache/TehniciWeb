-- Tipul enum pentru rolurile utilizatorilor
CREATE TYPE roluri AS ENUM ('admin', 'moderator', 'comun');

-- Tabelul utilizatorilor
CREATE TABLE utilizatori (
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
CREATE TABLE accesari (
    id              SERIAL PRIMARY KEY,
    ip              VARCHAR(45),
    pagina          VARCHAR(500),
    user_id         INTEGER REFERENCES utilizatori(id) ON DELETE SET NULL,
    data_accesare   TIMESTAMP DEFAULT NOW()
);

-- Index pentru căutări rapide după username
CREATE INDEX idx_utilizatori_username ON utilizatori(username);

-- Index pentru curățarea accesărilor vechi (după dată)
CREATE INDEX idx_accesari_data ON accesari(data_accesare);
