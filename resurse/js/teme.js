"use strict";
/* ══════════════════════════════════════════════════════════════════
   teme.js — Bonus 2: selector de teme (luminos / întunecat / verde)
   ══════════════════════════════════════════════════════════════════ */

const TEME_VALIDE = ['luminos', 'dark', 'verde'];
const LS_CHEIE = 'tema-selectata';

function aplicaTema(tema) {
    if (!TEME_VALIDE.includes(tema)) tema = 'luminos';
    if (tema === 'luminos') {
        document.body.removeAttribute('data-tema');
    } else {
        document.body.setAttribute('data-tema', tema);
    }
    // Actualizare radio buttons
    const radio = document.querySelector('input[name="tema-radio"][value="' + tema + '"]');
    if (radio) radio.checked = true;
    // Actualizare iconiță buton soare/lună
    const btnTema = document.getElementById('btn-tema');
    if (btnTema) {
        const icon = btnTema.querySelector('i');
        if (icon) {
            icon.className = tema === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
    }
    localStorage.setItem(LS_CHEIE, tema);
}

// Initializare: citi din localStorage
(function init() {
    const temaSalvata = localStorage.getItem(LS_CHEIE) || 'luminos';
    aplicaTema(temaSalvata);

    // Asculta radio buttons
    document.querySelectorAll('input[name="tema-radio"]').forEach(function(radio) {
        radio.addEventListener('change', function() {
            if (this.checked) aplicaTema(this.value);
        });
    });

    // Buton toggle soare/lună: alterneaza intre luminos si dark
    const btnTema = document.getElementById('btn-tema');
    if (btnTema) {
        btnTema.addEventListener('click', function() {
            const curent = localStorage.getItem(LS_CHEIE) || 'luminos';
            aplicaTema(curent === 'dark' ? 'luminos' : 'dark');
        });
    }
})();
