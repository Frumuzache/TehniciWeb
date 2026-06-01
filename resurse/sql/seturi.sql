-- Bonus 17a: Tabele pentru seturi de produse
CREATE TABLE IF NOT EXISTS seturi (
    id SERIAL PRIMARY KEY,
    nume_set VARCHAR(100) UNIQUE NOT NULL,
    descriere_set TEXT
);

CREATE TABLE IF NOT EXISTS asociere_set (
    id SERIAL PRIMARY KEY,
    id_set INT REFERENCES seturi(id) ON DELETE CASCADE,
    id_produs INT REFERENCES piese(id) ON DELETE CASCADE,
    UNIQUE(id_set, id_produs)
);

INSERT INTO seturi (nume_set, descriere_set) VALUES
('Kit Arduino Starter', 'Set complet pentru incepatori cu Arduino'),
('Kit Senzori ESP32', 'Combinatie senzori pentru ESP32 IoT'),
('Robot Mobil Basic', 'Componente pentru robot cu roti'),
('Statia Meteo', 'Senzori pentru monitorizare temperatura si umiditate'),
('Modul Comunicatii', 'Module wireless si Bluetooth')
ON CONFLICT (nume_set) DO NOTHING;

-- asocieri (assuming piese IDs 1-20 exist)
INSERT INTO asociere_set (id_set, id_produs) VALUES
(1,1),(1,5),(1,6),(1,12),
(2,3),(2,5),(2,7),(2,15),
(3,9),(3,10),(3,11),(3,12),
(4,6),(4,7),(4,8),
(5,14),(5,15),(5,16)
ON CONFLICT (id_set, id_produs) DO NOTHING;
