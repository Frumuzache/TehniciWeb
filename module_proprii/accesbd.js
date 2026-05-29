'use strict';

const pg = require('pg');

/**
 * Clasă Singleton pentru accesul la baza de date PostgreSQL.
 * Gestionează conexiunea și expune metode CRUD generice,
 * folosite de celelalte module ale aplicației.
 *
 * @example
 * // Inițializare (o singură dată, la pornirea serverului):
 * AccesBD.getInstanta({ database: 'mydb', user: 'user', password: 'pass', host: 'localhost', port: 5432 });
 *
 * // Utilizare în rute:
 * AccesBD.getInstanta().select({ tabel: 'utilizatori', campuri: ['*'], conditiiAnd: [] }, callback);
 */
class AccesBD {
    /** @type {AccesBD|null} Instanța unică (Singleton) */
    static instanta = null;

    /** @type {pg.Client} Clientul PostgreSQL */
    client;

    /**
     * Constructor — inițializează conexiunea la BD.
     * Nu apelați direct; folosiți {@link AccesBD.getInstanta}.
     * @param {object} config              - Parametrii conexiunii
     * @param {string} config.database     - Numele bazei de date
     * @param {string} config.user         - Utilizatorul BD
     * @param {string} config.password     - Parola BD
     * @param {string} config.host         - Gazda serverului BD
     * @param {number} config.port         - Portul serverului BD
     * @throws {Error} Dacă se încearcă crearea a doua instanțe
     */
    constructor(config) {
        if (AccesBD.instanta !== null) {
            throw new Error('AccesBD este Singleton — folosiți AccesBD.getInstanta().');
        }
        this.client = new pg.Client(config);
        this.client.connect()
            .catch(err => console.error('[AccesBD] Eroare la conectare:', err.message));
    }

    /**
     * Returnează instanța Singleton, creând-o la prima apelare.
     * @param   {object} [config] - Configurarea BD (necesar doar la prima apelare)
     * @returns {AccesBD} Instanța unică
     * @throws  {Error} Dacă la prima apelare lipsește configurarea
     */
    static getInstanta(config) {
        if (!AccesBD.instanta) {
            if (!config) throw new Error('[AccesBD] Prima apelare necesită configurarea BD.');
            AccesBD.instanta = new AccesBD(config);
        }
        return AccesBD.instanta;
    }

    // ─── Utilitare interne ───────────────────────────────────────────────────

    /**
     * Construiește clauza WHERE din un vector de condiții AND.
     * @param   {string[]} conditii
     * @returns {string}
     */
    _buildWhere(conditii) {
        return (conditii && conditii.length) ? ' WHERE ' + conditii.join(' AND ') : '';
    }

    /**
     * Serializează o valoare JavaScript într-un literal SQL (cu ghilimele).
     * @param   {*} v
     * @returns {string}
     */
    _sqlVal(v) {
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'boolean') return String(v);
        if (typeof v === 'number') return String(v);
        return `'${String(v).replace(/'/g, "''")}'`;
    }

    // ─── Metode CRUD ─────────────────────────────────────────────────────────

    /**
     * Selectare date dintr-un tabel.
     * @param {object}            obiect             - Parametrii cererii
     * @param {string}            obiect.tabel        - Numele tabelului
     * @param {string[]|string}   [obiect.campuri]    - Câmpuri de selectat (default '*')
     * @param {string[]}          [obiect.conditiiAnd]- Condiții WHERE
     * @param {string}            [obiect.orderBy]    - Clauza ORDER BY
     * @param {Function}          callback            - (err, rez) => void
     */
    select(obiect, callback) {
        const campuri = Array.isArray(obiect.campuri)
            ? obiect.campuri.join(', ')
            : (obiect.campuri || '*');
        const where   = this._buildWhere(obiect.conditiiAnd);
        const orderBy = obiect.orderBy ? ' ORDER BY ' + obiect.orderBy : '';
        this.client.query(`SELECT ${campuri} FROM ${obiect.tabel}${where}${orderBy}`, callback);
    }

    /**
     * Selectare asincronă dintr-un tabel.
     * @param   {object}            obiect
     * @param   {string}            obiect.tabel
     * @param   {string[]|string}   [obiect.campuri]
     * @param   {string[]}          [obiect.conditiiAnd]
     * @returns {Promise<pg.QueryResult>}
     */
    async selectAsync(obiect) {
        const campuri = Array.isArray(obiect.campuri)
            ? obiect.campuri.join(', ')
            : (obiect.campuri || '*');
        const where = this._buildWhere(obiect.conditiiAnd);
        return this.client.query(`SELECT ${campuri} FROM ${obiect.tabel}${where}`);
    }

    /**
     * Actualizare înregistrări (câmpuri transmise ca obiect cheie→valoare).
     * @param {object}   obiect
     * @param {string}   obiect.tabel
     * @param {object}   obiect.campuri    - { numeColoana: valoare }
     * @param {string[]} [obiect.conditiiAnd]
     * @param {Function} callback          - (err, rez) => void
     */
    update(obiect, callback) {
        const set   = Object.entries(obiect.campuri)
            .map(([k, v]) => `${k}=${this._sqlVal(v)}`).join(', ');
        const where = this._buildWhere(obiect.conditiiAnd);
        this.client.query(`UPDATE ${obiect.tabel} SET ${set}${where}`, callback);
    }

    /**
     * Actualizare parametrizată (vectori paraleli de câmpuri și valori).
     * @param {object}   obiect
     * @param {string}   obiect.tabel
     * @param {string[]} obiect.campuri      - Câmpurile de actualizat
     * @param {any[]}    obiect.valori       - Valorile corespunzătoare
     * @param {string[]} [obiect.conditiiAnd]
     * @param {Function} callback            - (err, rez) => void
     */
    updateParametrizat(obiect, callback) {
        const set   = obiect.campuri
            .map((c, i) => `${c}=${this._sqlVal(obiect.valori[i])}`).join(', ');
        const where = this._buildWhere(obiect.conditiiAnd);
        this.client.query(`UPDATE ${obiect.tabel} SET ${set}${where}`, callback);
    }

    /**
     * Inserare înregistrare nouă.
     * @param {object}         obiect
     * @param {string}         obiect.tabel
     * @param {object|string[]}obiect.campuri  - Obiect {col:val} SAU vector de câmpuri (cu obiect.valori)
     * @param {any[]}          [obiect.valori] - Valorile (când campuri e vector)
     * @param {Function}       callback        - (err, rez) => void
     */
    insert(obiect, callback) {
        let campuri, valori;
        if (Array.isArray(obiect.campuri)) {
            campuri = obiect.campuri.join(', ');
            valori  = (obiect.valori || []).map(v => this._sqlVal(v)).join(', ');
        } else {
            campuri = Object.keys(obiect.campuri).join(', ');
            valori  = Object.values(obiect.campuri).map(v => this._sqlVal(v)).join(', ');
        }
        this.client.query(`INSERT INTO ${obiect.tabel} (${campuri}) VALUES (${valori})`, callback);
    }

    /**
     * Ștergere înregistrări dintr-un tabel.
     * @param {object}   obiect
     * @param {string}   obiect.tabel
     * @param {string[]} [obiect.conditiiAnd]
     * @param {Function} callback              - (err, rez) => void
     */
    delete(obiect, callback) {
        const where = this._buildWhere(obiect.conditiiAnd);
        this.client.query(`DELETE FROM ${obiect.tabel}${where}`, callback);
    }
}

module.exports = AccesBD;
