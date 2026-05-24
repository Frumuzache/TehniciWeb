"use strict";

/* ══════════════════════════════════════════════════════════════════
   produse.js — filtrare, sortare și calcul pentru pagina /produse
   ══════════════════════════════════════════════════════════════════ */

const articole = Array.from(document.querySelectorAll('#grid-produse .produs'));
const gridProduse = document.getElementById('grid-produse');
const mesajValidare = document.getElementById('mesaj-validare');

/* ── Inițializare range preț ────────────────────────────────────── */
function initRange() {
    const preturi = articole.map(a => parseFloat(a.dataset.pret));
    const pretMin = Math.floor(Math.min(...preturi));
    const pretMax = Math.ceil(Math.max(...preturi));

    const rangeEl = document.getElementById('filtru-pret');
    rangeEl.min = pretMin;
    rangeEl.max = pretMax;
    rangeEl.value = pretMax;

    document.getElementById('pret-min-label').textContent = pretMin;
    document.getElementById('pret-max-label').textContent = pretMax;
    document.getElementById('pret-valoare-curenta').textContent = `(${pretMax} RON)`;

    rangeEl.addEventListener('input', function () {
        document.getElementById('pret-valoare-curenta').textContent = `(${this.value} RON)`;
    });
}

/* ── is-invalid auto-remove pe textarea (Bootstrap floating label) ── */
function initTextareaValidare() {
    const textarea = document.getElementById('filtru-descriere');
    textarea.addEventListener('input', function () {
        if (this.value.length === 0 || this.value.trim().length > 0) {
            this.classList.remove('is-invalid');
        }
    });
}

/* ── Populare datalist greutate ─────────────────────────────────── */
function initDatalistGreutate() {
    const greutati = [...new Set(articole.map(a => parseInt(a.dataset.greutate)))]
        .sort((a, b) => a - b);
    const datalist = document.getElementById('lista-greutati');
    greutati.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        datalist.appendChild(opt);
    });
}

/* ── Validare inputuri ──────────────────────────────────────────── */
function afiseazaEroare(mesaj) {
    mesajValidare.textContent = mesaj;
    mesajValidare.hidden = false;
    mesajValidare.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function ascundeEroare() {
    mesajValidare.hidden = true;
    mesajValidare.textContent = '';
}

function valideaza() {
    const protocol    = document.getElementById('filtru-protocol').value.trim();
    const greutate    = document.getElementById('filtru-greutate').value.trim();
    const descriereEl = document.getElementById('filtru-descriere');
    const descriereRaw = descriereEl.value;

    // Text: protocolul nu poate fi format doar din cifre
    if (protocol && /^\d+$/.test(protocol)) {
        afiseazaEroare('Câmpul "Protocol conținut" nu poate fi format doar din cifre. Introduceți un protocol valid (ex: I2C, SPI).');
        return false;
    }

    // Datalist: greutatea trebuie să fie număr pozitiv dacă e completată
    if (greutate !== '') {
        const val = parseFloat(greutate);
        if (isNaN(val) || val < 0) {
            afiseazaEroare('Câmpul "Greutate maximă" trebuie să fie un număr pozitiv (în grame).');
            return false;
        }
    }

    // Textarea (floating label): nu poate conține doar spații albe
    if (descriereRaw.length > 0 && descriereRaw.trim().length === 0) {
        descriereEl.classList.add('is-invalid');
        afiseazaEroare('Câmpul "Cuvânt cheie în descriere" conține doar spații. Introduceți un cuvânt valid sau lăsați gol.');
        return false;
    }
    descriereEl.classList.remove('is-invalid');

    ascundeEroare();
    return true;
}

/* ── Filtrare ───────────────────────────────────────────────────── */
function filtrare() {
    if (!valideaza()) return;

    const protocol       = document.getElementById('filtru-protocol').value.trim().toLowerCase();
    const pretMax        = parseFloat(document.getElementById('filtru-pret').value);
    const greutateMax    = document.getElementById('filtru-greutate').value.trim();
    const inStocVal      = document.querySelector('input[name="in_stoc"]:checked').value;
    const subcategoriiCb = [...document.querySelectorAll('.cb-subcategorie:checked')].map(cb => cb.value);
    const descriereKw    = document.getElementById('filtru-descriere').value.trim().toLowerCase();
    const compatVal      = document.getElementById('filtru-compat').value;
    const protoExcluse   = [...document.getElementById('filtru-proto-exclude').selectedOptions].map(o => o.value);

    articole.forEach(art => {
        let vizibil = true;

        // 1. Text — protocol conține subșirul
        if (protocol) {
            const protoArt = art.dataset.protocoale.toLowerCase();
            if (!protoArt.includes(protocol)) vizibil = false;
        }

        // 2. Range — preț ≤ pretMax
        if (parseFloat(art.dataset.pret) > pretMax) vizibil = false;

        // 3. Datalist — greutate ≤ greutateMax
        if (greutateMax !== '') {
            if (parseInt(art.dataset.greutate) > parseFloat(greutateMax)) vizibil = false;
        }

        // 4. Radio — în stoc
        if (inStocVal === 'da' && art.dataset.inStoc !== 'da') vizibil = false;
        if (inStocVal === 'nu' && art.dataset.inStoc !== 'nu') vizibil = false;

        // 5. Checkbox — subcategorie: produsul trebuie să aibă subcategoria în lista bifată
        if (!subcategoriiCb.includes(art.dataset.subcategorie)) vizibil = false;

        // 6. Textarea — cuvânt cheie în descriere
        if (descriereKw && !art.dataset.descriere.includes(descriereKw)) vizibil = false;

        // 7. Select simplu — compatibilitate exactă
        if (compatVal && art.dataset.compatibilitate !== compatVal) vizibil = false;

        // 8. Select multiplu — exclude produse care au oricare din protocoalele selectate
        if (protoExcluse.length > 0) {
            const protoArtArr = art.dataset.protocoale.split(',').map(p => p.trim()).filter(Boolean);
            if (protoExcluse.some(ep => protoArtArr.includes(ep))) vizibil = false;
        }

        art.style.display = vizibil ? '' : 'none';
    });
}

/* ── Sortare ────────────────────────────────────────────────────── */
function sortare(directie) {
    if (!valideaza()) return;

    const copie = [...articole];
    copie.sort((a, b) => {
        const scA = a.dataset.subcategorie;
        const scB = b.dataset.subcategorie;
        if (scA !== scB) {
            const cmp = scA.localeCompare(scB, 'ro');
            return directie === 'asc' ? cmp : -cmp;
        }
        const pA = parseFloat(a.dataset.pret);
        const pB = parseFloat(b.dataset.pret);
        return directie === 'asc' ? pA - pB : pB - pA;
    });

    copie.forEach(art => gridProduse.appendChild(art));
}

/* ── Calculare ──────────────────────────────────────────────────── */
function calculeaza() {
    if (!valideaza()) return;

    const vizibile = articole.filter(a => a.style.display !== 'none');

    if (vizibile.length === 0) {
        afiseazaEroare('Nu există produse vizibile pentru a efectua calculul!');
        return;
    }

    const preturi = vizibile.map(a => parseFloat(a.dataset.pret));
    const suma    = preturi.reduce((acc, p) => acc + p, 0);
    const medie   = suma / preturi.length;
    const minim   = Math.min(...preturi);
    const maxim   = Math.max(...preturi);

    // Creează div flotant, îl afișează 2 secunde și îl șterge
    const div = document.createElement('div');
    div.className = 'div-calcul-fix';
    div.innerHTML = `
        <strong>Calcul prețuri (${vizibile.length} produse):</strong><br>
        Sumă: <strong>${suma.toFixed(2)} RON</strong><br>
        Medie: <strong>${medie.toFixed(2)} RON</strong><br>
        Min: ${minim.toFixed(2)} RON &nbsp;|&nbsp; Max: ${maxim.toFixed(2)} RON
    `;
    document.body.appendChild(div);

    setTimeout(() => {
        if (div.parentNode) div.parentNode.removeChild(div);
    }, 2000);
}

/* ── Resetare ───────────────────────────────────────────────────── */
function resetare() {
    if (!confirm('Sigur doriți să resetați toate filtrele și sortarea?')) return;

    // Resetare inputuri
    document.getElementById('filtru-protocol').value = '';

    const rangeEl = document.getElementById('filtru-pret');
    rangeEl.value = rangeEl.max;
    document.getElementById('pret-valoare-curenta').textContent = `(${rangeEl.max} RON)`;


    document.getElementById('filtru-greutate').value = '';
    document.getElementById('stoc-oricare').checked = true;

    document.querySelectorAll('.cb-subcategorie').forEach(cb => { cb.checked = true; });

    const descriereElReset = document.getElementById('filtru-descriere');
    descriereElReset.value = '';
    descriereElReset.classList.remove('is-invalid');
    document.getElementById('filtru-compat').value = '';

    const selectExclus = document.getElementById('filtru-proto-exclude');
    [...selectExclus.options].forEach(o => { o.selected = false; });

    // Restabilire vizibilitate
    articole.forEach(art => { art.style.display = ''; });

    // Restabilire ordine originală (după id numeric)
    [...articole]
        .sort((a, b) => parseInt(a.dataset.id) - parseInt(b.dataset.id))
        .forEach(art => gridProduse.appendChild(art));

    ascundeEroare();
}

/* ── Event listeners ────────────────────────────────────────────── */
document.getElementById('btn-filtreaza').addEventListener('click', filtrare);
document.getElementById('btn-sort-asc').addEventListener('click', () => sortare('asc'));
document.getElementById('btn-sort-desc').addEventListener('click', () => sortare('desc'));
document.getElementById('btn-calcul').addEventListener('click', calculeaza);
document.getElementById('btn-reset').addEventListener('click', resetare);

/* ── Inițializare la încărcare ──────────────────────────────────── */
initRange();
initDatalistGreutate();
initTextareaValidare();
