-- Magazin de piese de robotica - Schema baza de date
-- Rulati cu: psql -U frumu -d cti_2026 -f resurse/sql/piese.sql

DROP TABLE IF EXISTS piese;
DROP TYPE IF EXISTS categ_piesa CASCADE;
DROP TYPE IF EXISTS subcateg_piesa CASCADE;
DROP TYPE IF EXISTS compat_piesa CASCADE;

-- Categoria mare (max 5 valori)
CREATE TYPE categ_piesa AS ENUM('microcontrolere', 'senzori', 'motoare', 'alimentare', 'module');

-- Subcategorie (clasificare mai putin importanta)
CREATE TYPE subcateg_piesa AS ENUM('wireless', 'cu_fir', 'analogic', 'digital', 'mecanic');

-- Compatibilitate (caracteristica cu o singura valoare)
CREATE TYPE compat_piesa AS ENUM('Arduino', 'RaspberryPi', 'ESP32', 'STM32', 'universal');

CREATE TABLE piese (
    id              SERIAL PRIMARY KEY,
    nume            VARCHAR(100) UNIQUE NOT NULL,
    descriere       TEXT,
    pret            NUMERIC(8,2) NOT NULL CHECK (pret >= 0),
    greutate        INT NOT NULL CHECK (greutate >= 0),       -- grame, a doua caracteristica numerica
    categorie       categ_piesa NOT NULL DEFAULT 'module',
    subcategorie    subcateg_piesa NOT NULL DEFAULT 'digital',
    compatibilitate compat_piesa DEFAULT 'universal',          -- valoare unica din set
    protocoale      VARCHAR[],                                  -- valori multiple
    in_stoc         BOOLEAN NOT NULL DEFAULT TRUE,             -- caracteristica booleana
    imagine         VARCHAR(300),
    data_adaugare   TIMESTAMP DEFAULT current_timestamp
);

INSERT INTO piese (nume, descriere, pret, greutate, categorie, subcategorie, compatibilitate, protocoale, in_stoc, imagine, data_adaugare) VALUES
('Arduino Uno R3',
 'Placă de dezvoltare bazată pe ATmega328P, ideală pentru prototipare rapidă. Include 14 pini digitali, 6 pini analogici, USB-B și regulator de tensiune 5V.',
 45.99, 25, 'microcontrolere', 'digital', 'Arduino',
 '{"I2C","SPI","UART","PWM"}', TRUE, 'arduino-uno.jpg', '2023-03-15'),

('Raspberry Pi 4 Model B 4GB',
 'Mini-computer cu procesor Cortex-A72 quad-core 1.8GHz și 4GB LPDDR4 RAM. Dispune de Wi-Fi dual-band, Bluetooth 5.0 și doua porturi USB 3.0.',
 299.99, 46, 'microcontrolere', 'wireless', 'RaspberryPi',
 '{"I2C","SPI","UART","USB"}', TRUE, 'rpi4.jpg', '2023-06-20'),

('ESP32 DevKit V1',
 'Modul Wi-Fi 802.11 b/g/n + Bluetooth 4.2 dual-core Xtensa LX6 cu 4MB flash. Perfect pentru proiecte IoT cu consum redus de energie.',
 35.50, 10, 'microcontrolere', 'wireless', 'ESP32',
 '{"I2C","SPI","UART","PWM","ADC"}', TRUE, 'esp32-devkit.jpg', '2023-09-01'),

('STM32 Nucleo-64 F401RE',
 'Placă de prototipare STM32 cu debugger ST-LINK/V2-1 integrat. Compatibilă cu shield-uri Arduino și conectori Morpho pentru acces la toti pinii.',
 89.99, 35, 'microcontrolere', 'cu_fir', 'STM32',
 '{"I2C","SPI","UART","CAN","USB"}', FALSE, 'stm32-nucleo.jpg', '2022-11-10'),

('Senzor ultrasonic HC-SR04',
 'Măsoară distanțe de la 2cm la 400cm cu precizie de ±3mm. Unghi efectiv de 15°, frecvența de lucru 40Hz, ideal pentru detectarea obstacolelor.',
 12.99, 8, 'senzori', 'digital', 'Arduino',
 '{"PWM","digital"}', TRUE, 'hcsr04.jpg', '2023-01-05'),

('Senzor temperatură și umiditate DHT22',
 'Senzor de temperatură (-40 la +80°C, ±0.5°C) și umiditate relativă (0-100%, ±2-5%). Ieșire digitală pe un singur fir, actualizare la 0.5Hz.',
 18.50, 5, 'senzori', 'digital', 'universal',
 '{"1-Wire","digital"}', TRUE, 'dht22.jpg', '2023-04-12'),

('Senzor luminozitate BH1750',
 'Senzor de luminozitate ambientală cu interfață I2C, gamă 1-65535 lux cu rezoluție de 1 lux. Include filtru spectral pentru lumina solara si electrica.',
 9.99, 3, 'senzori', 'digital', 'Arduino',
 '{"I2C"}', TRUE, 'bh1750.jpg', '2023-07-18'),

('Accelerometru și giroscop MPU-6050',
 'IMU cu 6 axe: accelerometru 3D ±2g/±4g/±8g/±16g și giroscop 3D ±250/±500/±1000/±2000°/s. Procesor DMP integrat pentru calculul orientării.',
 22.00, 4, 'senzori', 'digital', 'universal',
 '{"I2C","SPI"}', TRUE, 'mpu6050.jpg', '2022-12-20'),

('Senzor distanță IR Sharp GP2Y0A21',
 'Senzor de distanță infraroșu analogic, gamă 10-80cm. Tensiune ieșire 0.4-2.4V proporțională cu distanța, timp de actualizare 25ms.',
 27.50, 12, 'senzori', 'analogic', 'Arduino',
 '{"analogic"}', FALSE, 'sharp-ir.jpg', '2023-02-28'),

('Motor DC 6V 200RPM cu reductoare',
 'Motor de curent continuu cu cutie de reducere metalică, cuplu 0.8kg.cm, curent nominal 250mA. Ax de 3mm cu aplatizare pentru fixare sigură.',
 29.99, 120, 'motoare', 'mecanic', 'universal',
 '{"PWM"}', TRUE, 'motor-dc.jpg', '2023-05-10'),

('Servomotor SG90 Micro 9G',
 'Micro-servomotor plastic cu unghi de rotație 180°, cuplu 1.8kg.cm la 4.8V, viteză 0.1s/60°. Include pârghii și șuruburi de montaj.',
 15.99, 9, 'motoare', 'mecanic', 'Arduino',
 '{"PWM"}', TRUE, 'sg90.jpg', '2023-08-22'),

('Motor pas cu pas NEMA17 42x42mm',
 'Motor pas cu pas bifazic 1.8°/pas (200 pași/rotație), curent 2A pe fază, cuplu de menținere 4.4kg.cm. Standard NEMA17, frecvent utilizat în imprimante 3D.',
 65.00, 280, 'motoare', 'digital', 'universal',
 '{"digital","SPI"}', TRUE, 'nema17.jpg', '2022-10-15'),

('Driver motor L298N Punte H',
 'Modul punte H dublă pentru controlul a 2 motoare DC sau 1 motor pas cu pas. Tensiune motor 5-35V, curent continuu 2A pe canal, protecție termică.',
 19.99, 45, 'module', 'digital', 'Arduino',
 '{"PWM","digital"}', TRUE, 'l298n.jpg', '2023-03-30'),

('Modul releu 4 canale 5V',
 'Releu electromecanic cu 4 canale independente 5V cu optocuplor de izolare. 10A/250VAC sau 10A/30VDC, declanșare pe nivel LOW sau HIGH (selectabil).',
 24.99, 60, 'module', 'digital', 'universal',
 '{"digital"}', TRUE, 'releu-4ch.jpg', '2023-06-05'),

('Modul Bluetooth HC-05 Serial',
 'Modul Bluetooth 2.0 EDR în mod master/slave configurabil prin comenzi AT. Rază operare ~10m, viteză UART până la 1382400 baud.',
 28.50, 8, 'module', 'wireless', 'Arduino',
 '{"UART","Bluetooth"}', TRUE, 'hc05.jpg', '2023-09-15'),

('Modul Wi-Fi ESP8266 NodeMCU',
 'Modul IoT cu ESP8266 12-E, 4MB flash, 11 pini GPIO, 1 pin ADC. Programabil direct din Arduino IDE, include USB-Serial CH340G integrat.',
 32.00, 15, 'module', 'wireless', 'Arduino',
 '{"I2C","SPI","UART","ADC"}', FALSE, 'nodemcu.jpg', '2023-10-05'),

('Baterie LiPo 3.7V 2000mAh',
 'Acumulator LiPo slim (5mm grosime) cu conector JST-PH 2.0mm, descărcare maximă 2C (4A), protecție BMS integrată contra supraîncărcării.',
 42.00, 38, 'alimentare', 'cu_fir', 'universal',
 '{"analogic"}', TRUE, 'lipo-2000.jpg', '2023-01-20'),

('Regulator tensiune LM7805 5V',
 'Regulator liniar de tensiune fixă 5V, curent maxim 1.5A în carcasă TO-220 cu radiator. Protecție termică și contra scurtcircuitului inclusă.',
 5.50, 15, 'alimentare', 'analogic', 'universal',
 '{"analogic"}', TRUE, 'lm7805.jpg', '2022-09-01'),

('Modul încărcare LiPo TP4056 5V',
 'Modul compact de încărcare pentru celule LiPo/Li-Ion 3.7V la 1A prin micro-USB. Include protecție la supraîncărcare, supradescărcare și supracurent.',
 8.99, 5, 'alimentare', 'cu_fir', 'universal',
 '{"analogic","I2C"}', FALSE, 'tp4056.jpg', '2023-04-08'),

('Convertor DC-DC Step-Up MT3608',
 'Convertor boost DC-DC, intrare 2-24V, ieșire reglabilă 5-28V, curent maxim 2A. Eficiență până la 93%, frecvența de comutare 1.2MHz.',
 11.99, 6, 'alimentare', 'analogic', 'universal',
 '{"analogic"}', TRUE, 'mt3608.jpg', '2023-07-25');
