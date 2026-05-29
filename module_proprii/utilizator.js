'use strict';

const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const AccesBD    = require('./accesbd');
const { RolFactory } = require('./roluri');

/**
 * Clasa Utilizator — reprezintă un utilizator al aplicației.
 * Gestionează proprietățile, validarea datelor și interacțiunea cu baza de date.
 *
 * @example
 * const u = new Utilizator({ username: 'ion', nume: 'Ion', prenume: 'Popescu', email: 'ion@ex.ro', parola: 'pass', culoare_chat: '#333' });
 * u.salvareUtilizator();
 */
class Utilizator {
    /** @type {string} Domeniul site-ului (folosit în linkuri de confirmare email) */
    static numeDomeniu = process.env.SITE_DOMENIU || 'localhost:8080';

    /**
     * Constructorul clasei.
     * Poate fi apelat fără parametri (valori implicite) sau cu un obiect de date.
     * @param {object} [date={}] - Obiect cu câmpurile tabelului `utilizatori`
     */
    constructor(date = {}) {
        /** @type {number|null} */
        this.id = date.id ?? null;
        /** @type {string} */
        this.username = date.username ?? '';
        /** @type {string} */
        this.nume = date.nume ?? '';
        /** @type {string} */
        this.prenume = date.prenume ?? '';
        /** @type {string} Parola stocată hash-uită */
        this.parola = date.parola ?? '';
        /** @type {'admin'|'moderator'|'comun'} */
        this.rol = date.rol ?? 'comun';
        /** @type {string} */
        this.email = date.email ?? '';
        /** @type {string} */
        this.culoare_chat = date.culoare_chat ?? '#1d3557';
        /** @type {Date|null} */
        this.data_adaugare = date.data_adaugare ?? null;
        /** @type {string|null} Token de confirmare email */
        this.cod = date.cod ?? null;
        /** @type {boolean} */
        this.confirmat_mail = date.confirmat_mail ?? false;
        /** @type {string|null} Numele fișierului pozei de profil */
        this.poza = date.poza ?? null;
    }

    // ─── Setters cu validare ─────────────────────────────────────────────────

    /**
     * Setter cu validare pentru câmpul `nume`.
     * @param {string} val
     * @throws {Error} Dacă valoarea nu trece validarea
     */
    set setareNume(val) {
        if (!Utilizator.verificaNume(val))
            throw new Error('Numele trebuie să conțină doar litere, spații sau cratime (min. 2 caractere).');
        this.nume = val;
    }

    /**
     * Setter cu validare pentru câmpul `username`.
     * @param {string} val
     * @throws {Error} Dacă valoarea nu trece validarea
     */
    set setareUsername(val) {
        if (!Utilizator.verificaUsername(val))
            throw new Error('Username invalid — 3-30 caractere alfanumerice sau underscore.');
        this.username = val;
    }

    // ─── Metode statice de validare ──────────────────────────────────────────

    /**
     * Verifică dacă un nume conține doar litere, spații sau cratime.
     * @param   {string} val
     * @returns {boolean}
     */
    static verificaNume(val) {
        return typeof val === 'string'
            && val.trim().length >= 2
            && /^[a-zA-ZăâîșțĂÂÎȘȚ\s\-]+$/.test(val);
    }

    /**
     * Verifică dacă un username are formatul corect (3-30 caractere alfanumerice/_).
     * @param   {string} val
     * @returns {boolean}
     */
    static verificaUsername(val) {
        return typeof val === 'string' && /^[a-zA-Z0-9_]{3,30}$/.test(val);
    }

    /**
     * Verifică dacă un string are formatul unui email valid.
     * @param   {string} val
     * @returns {boolean}
     */
    static verificaEmail(val) {
        return typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    }

    // ─── Criptare ────────────────────────────────────────────────────────────

    /**
     * Calculează hash-ul SHA-256 al parolei primite.
     * @param   {string} parola - Parola în clar
     * @returns {string} Hash SHA-256 hexadecimal
     */
    static criptareParola(parola) {
        return crypto.createHash('sha256').update(parola).digest('hex');
    }

    // ─── Interacțiune cu BD ──────────────────────────────────────────────────

    /**
     * Inserează utilizatorul în baza de date și trimite email de confirmare.
     * Hash-uiește parola înainte de stocare.
     * @throws {Error} Dacă username-ul există deja sau survine o eroare de BD
     */
    salvareUtilizator() {
        this.parola = Utilizator.criptareParola(this.parola);
        this.cod = crypto.randomBytes(16).toString('hex');

        AccesBD.getInstanta().insert({
            tabel: 'utilizatori',
            campuri: {
                username:      this.username,
                nume:          this.nume,
                prenume:       this.prenume,
                parola:        this.parola,
                rol:           this.rol,
                email:         this.email,
                culoare_chat:  this.culoare_chat,
                cod:           this.cod,
                confirmat_mail: false,
                poza:          this.poza
            }
        }, (err) => {
            if (err) { console.error('[Utilizator] Eroare salvare:', err.message); return; }
            const link = `http://${Utilizator.numeDomeniu}/cod/${this.username}/${this.cod}`;
            this.trimiteMail(
                'Confirmare cont — Magazin Robotică',
                `Bun venit, ${this.prenume}!\nConfirmați contul accesând: ${link}`,
                `<p>Bun venit, <b>${this.prenume}</b>!</p><p><a href="${link}">Confirmați contul</a></p>`
            ).catch(e => console.error('[Utilizator] Eroare trimitere mail:', e.message));
        });
    }

    /**
     * Actualizează datele utilizatorului existent în BD.
     * @throws {Error} Dacă utilizatorul nu are ID setat
     */
    modifica() {
        if (!this.id) throw new Error('[Utilizator] ID lipsă — nu se poate modifica.');
        AccesBD.getInstanta().update({
            tabel:      'utilizatori',
            campuri:    { nume: this.nume, prenume: this.prenume, email: this.email, culoare_chat: this.culoare_chat, poza: this.poza },
            conditiiAnd: [`id=${this.id}`]
        }, (err) => { if (err) console.error('[Utilizator] Eroare modificare:', err.message); });
    }

    /**
     * Șterge utilizatorul curent din BD.
     * @throws {Error} Dacă utilizatorul nu are ID setat
     */
    sterge() {
        if (!this.id) throw new Error('[Utilizator] ID lipsă — nu se poate șterge.');
        AccesBD.getInstanta().delete({
            tabel:       'utilizatori',
            conditiiAnd: [`id=${this.id}`]
        }, (err) => { if (err) console.error('[Utilizator] Eroare ștergere:', err.message); });
    }

    /**
     * Verifică dacă utilizatorul are un anumit drept, pe baza rolului său.
     * @param   {Symbol} drept - Dreptul de verificat (din obiectul Drepturi)
     * @returns {boolean}
     */
    areDreptul(drept) {
        try {
            return RolFactory.creeazaRol(this.rol).areDreptul(drept);
        } catch { return false; }
    }

    // ─── Metode statice de căutare ───────────────────────────────────────────

    /**
     * Caută un utilizator după username și apelează callback-ul cu rezultatul (sincron cu callback).
     * @param {string}   username
     * @param {object}   obParam   - Obiect suplimentar transmis callback-ului (ex: {req, res, parola})
     * @param {Function} callback  - (utilizator|null, obParam, eroare|null) — eroare=-1 dacă nu există
     */
    static getUtilizDupaUsername(username, obParam, callback) {
        AccesBD.getInstanta().select({
            tabel:       'utilizatori',
            conditiiAnd: [`username='${username.replace(/'/g, "''")}'`]
        }, (err, rez) => {
            if (err || rez.rowCount === 0) {
                callback(null, obParam, -1);
            } else {
                callback(new Utilizator(rez.rows[0]), obParam, null);
            }
        });
    }

    /**
     * Caută un utilizator după username (asincron).
     * @param   {string} username
     * @returns {Promise<Utilizator|null>} Null dacă nu există
     */
    static async getUtilizDupaUsernameAsync(username) {
        try {
            const rez = await AccesBD.getInstanta().selectAsync({
                tabel:       'utilizatori',
                conditiiAnd: [`username='${username.replace(/'/g, "''")}'`]
            });
            return rez.rowCount > 0 ? new Utilizator(rez.rows[0]) : null;
        } catch { return null; }
    }

    /**
     * Caută utilizatori ale căror proprietăți se potrivesc cu obParam (sincron cu callback).
     * Proprietățile cu valoare undefined sunt ignorate.
     * @param {object}   obParam  - Filtre de căutare (cheie=valoare)
     * @param {Function} callback - (listaUtilizatori: Utilizator[]) => void
     */
    static cauta(obParam, callback) {
        const conditii = Object.entries(obParam)
            .map(([k, v]) => `${k}='${String(v).replace(/'/g, "''")}'`);
        AccesBD.getInstanta().select({
            tabel:       'utilizatori',
            conditiiAnd: conditii
        }, (err, rez) => {
            if (err) { callback([]); return; }
            callback(rez.rows.map(r => new Utilizator(r)));
        });
    }

    /**
     * Caută utilizatori ale căror proprietăți se potrivesc cu obParam (asincron).
     * @param   {object} obParam - Filtre de căutare (cheie=valoare)
     * @returns {Promise<Utilizator[]>} Lista utilizatorilor găsiți (poate fi vidă)
     */
    static async cautaAsync(obParam) {
        try {
            const conditii = Object.entries(obParam)
                .map(([k, v]) => `${k}='${String(v).replace(/'/g, "''")}'`);
            const rez = await AccesBD.getInstanta().selectAsync({
                tabel:       'utilizatori',
                conditiiAnd: conditii
            });
            return rez.rows.map(r => new Utilizator(r));
        } catch { return []; }
    }

    // ─── Email ───────────────────────────────────────────────────────────────

    /**
     * Trimite un email utilizatorului curent.
     * Configurarea SMTP se face prin variabilele de mediu:
     * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
     * @param   {string}   subiect      - Subiectul emailului
     * @param   {string}   mesajText    - Conținut plain text
     * @param   {string}   [mesajHtml]  - Conținut HTML (fallback = mesajText)
     * @param   {object[]} [atasamente] - Lista de atașamente (format nodemailer)
     * @returns {Promise<void>}
     */
    async trimiteMail(subiect, mesajText, mesajHtml, atasamente) {
        const transport = nodemailer.createTransport({
            host:   process.env.SMTP_HOST || 'smtp.gmail.com',
            port:   parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.SMTP_USER || '',
                pass: process.env.SMTP_PASS || ''
            }
        });
        await transport.sendMail({
            from:        `"Magazin Robotică" <${process.env.SMTP_USER || 'noreply@robotica.ro'}>`,
            to:          this.email,
            subject:     subiect,
            text:        mesajText,
            html:        mesajHtml || mesajText,
            attachments: atasamente || []
        });
    }
}

module.exports = { Utilizator };
