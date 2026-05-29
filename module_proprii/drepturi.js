'use strict';

/**
 * Obiect care conține toate drepturile posibile ale utilizatorilor.
 * Fiecare drept este un Symbol unic, evitând coliziunile de nume.
 * @namespace Drepturi
 */
const Drepturi = {
    /** @type {Symbol} Dreptul de a vizualiza produsele */
    vizualizareProduse: Symbol('vizualizareProduse'),

    /** @type {Symbol} Dreptul de a adăuga produse noi */
    adaugareProduse: Symbol('adaugareProduse'),

    /** @type {Symbol} Dreptul de a modifica produse existente */
    modificareProduse: Symbol('modificareProduse'),

    /** @type {Symbol} Dreptul de a șterge produse */
    stergeProduse: Symbol('stergeProduse'),

    /** @type {Symbol} Dreptul de a vizualiza lista utilizatorilor */
    vizualizareUtilizatori: Symbol('vizualizareUtilizatori'),

    /** @type {Symbol} Dreptul de a modifica datele utilizatorilor */
    modificareUtilizatori: Symbol('modificareUtilizatori'),

    /** @type {Symbol} Dreptul de a șterge utilizatori */
    stergereUtilizatori: Symbol('stergereUtilizatori'),

    /** @type {Symbol} Dreptul de acces la panoul de administrare */
    accesPanouAdmin: Symbol('accesPanouAdmin')
};

module.exports = Drepturi;
