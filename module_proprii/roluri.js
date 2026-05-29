'use strict';

const Drepturi = require('./drepturi');

/**
 * Clasa de bază pentru toate rolurile.
 * Stochează codul rolului și lista de drepturi asociată.
 */
class Rol {
    /**
     * @param {string}   cod      - Codul rolului (ex: 'admin', 'comun')
     * @param {Symbol[]} drepturi - Lista de drepturi acordate rolului
     */
    constructor(cod, drepturi) {
        /** @type {string} Codul rolului, corespunde valorii din tabelul BD */
        this.cod = cod;
        /** @type {Symbol[]} */
        this._drepturi = drepturi;
    }

    /**
     * Verifică dacă rolul deține un anumit drept.
     * @param   {Symbol}  drept - Dreptul de verificat (din obiectul Drepturi)
     * @returns {boolean} true dacă rolul are dreptul, false altfel
     */
    areDreptul(drept) {
        return this._drepturi.includes(drept);
    }

    /**
     * Returnează copia listei de drepturi a rolului.
     * @returns {Symbol[]}
     */
    getDrepturi() {
        return [...this._drepturi];
    }
}

/**
 * Rolul de client — utilizator comun înregistrat.
 * Are doar dreptul de a vizualiza produsele.
 * @extends Rol
 */
class RolClient extends Rol {
    constructor() {
        super('comun', [
            Drepturi.vizualizareProduse
        ]);
    }
}

/**
 * Rolul de moderator.
 * Poate vizualiza și modifica utilizatori, dar nu îi poate șterge și nu poate gestiona produse.
 * @extends Rol
 */
class RolModerator extends Rol {
    constructor() {
        super('moderator', [
            Drepturi.vizualizareProduse,
            Drepturi.vizualizareUtilizatori,
            Drepturi.modificareUtilizatori
        ]);
    }
}

/**
 * Rolul de administrator — deține toate drepturile posibile.
 * @extends Rol
 */
class RolAdmin extends Rol {
    constructor() {
        super('admin', Object.values(Drepturi));
    }
}

/**
 * Factory (design pattern) pentru crearea obiectelor Rol.
 * Returnează instanța corectă în funcție de codul primit.
 */
class RolFactory {
    /**
     * Creează și returnează obiectul Rol corespunzător codului dat.
     * @param   {string} tip - Codul rolului: 'admin', 'moderator' sau 'comun'
     * @returns {Rol} Instanța rolului corespunzător
     * @throws  {Error} Dacă tipul nu este recunoscut
     */
    static creeazaRol(tip) {
        switch (tip) {
            case 'admin':     return new RolAdmin();
            case 'moderator': return new RolModerator();
            case 'comun':     return new RolClient();
            default:          throw new Error(`Tip rol necunoscut: "${tip}"`);
        }
    }
}

module.exports = { Rol, RolClient, RolModerator, RolAdmin, RolFactory };
