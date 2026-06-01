"use strict";

/* ══════════════════════════════════════════════════════════════════
   produse.js — filtrare, sortare, paginare și calcul /produse
   ══════════════════════════════════════════════════════════════════ */

const articole    = Array.from(document.querySelectorAll('#grid-produse .produs'));
const gridProduse = document.getElementById('grid-produse');
const mesajValidare  = document.getElementById('mesaj-validare');
const mesajFiltruGol = document.getElementById('mesaj-filtru-gol');  // Bonus 3

/* ── Bonus 7: normalizare diacritice ────────────────────────────── */
function normaliz(str) {
    return (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/* ── Bonus 6: stări pentru salvare/ștergere ─────────────────────── */
const salvate    = new Set();
const sterseTemp = new Set();

function getSterseSession() {
    try {
        return new Set(JSON.parse(sessionStorage.getItem('piese-sterse-sesiune') || '[]'));
    } catch (_) { return new Set(); }
}

function addStersSession(id) {
    const s = getSterseSession();
    s.add(String(id));
    sessionStorage.setItem('piese-sterse-sesiune', JSON.stringify([...s]));
}

/* ── Inițializare range preț ────────────────────────────────────── */
function initRange() {
    const preturi = articole.map(a => parseFloat(a.dataset.pret));
    const pretMin = Math.floor(Math.min(...preturi));
    const pretMax = Math.ceil(Math.max(...preturi));

    const rangeEl = document.getElementById('filtru-pret');
    rangeEl.min   = pretMin;
    rangeEl.max   = pretMax;
    rangeEl.value = pretMax;

    document.getElementById('pret-min-label').textContent = pretMin;
    document.getElementById('pret-max-label').textContent = pretMax;
    document.getElementById('pret-valoare-curenta').textContent = `(${pretMax} RON)`;

    rangeEl.addEventListener('input', function () {
        document.getElementById('pret-valoare-curenta').textContent = `(${this.value} RON)`;
        filtrare(); // Bonus 4
    });
}

/* ── is-invalid auto-remove pe textarea ────────────────────────── */
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

/* ── Bonus 18: marcare produse NOI (adăugate în ultimele 30 de zile) */
const ZILE_NOU = 30;
function initProduseNoi() {
    const acum = new Date();
    articole.forEach(art => {
        const dataAdaugare = art.dataset.dataAdaugare;
        if (!dataAdaugare) return;
        const diffZile = (acum - new Date(dataAdaugare)) / (1000 * 60 * 60 * 24);
        if (diffZile <= ZILE_NOU) {
            const badge = document.createElement('span');
            badge.className = 'badge-nou';
            badge.textContent = 'NOU';
            const titlu = art.querySelector('h3');
            if (titlu) titlu.insertBefore(badge, titlu.firstChild);
        }
    });
}

/* ── Bonus 15: actualizare contor produse afișate ───────────────── */
function actualizeazaContor() {
    const count  = articole.filter(a => a.style.display !== 'none').length;
    const contor = document.getElementById('nr-produse-afisate');
    if (contor) contor.textContent = count;
}

/* ── Bonus 14: marcare cel mai ieftin produs per subcategorie ───── */
function marcheazaCelMaiIeftin() {
    articole.forEach(a => {
        a.classList.remove('cel-mai-ieftin');
        const b = a.querySelector('.badge-ieftin');
        if (b) b.remove();
    });

    const vizibile = articole.filter(a => a.style.display !== 'none');
    const bySubcat = {};
    vizibile.forEach(a => {
        const sc  = a.dataset.subcategorie;
        const prt = parseFloat(a.dataset.pret);
        if (!bySubcat[sc] || prt < parseFloat(bySubcat[sc].dataset.pret)) {
            bySubcat[sc] = a;
        }
    });

    Object.values(bySubcat).forEach(a => {
        a.classList.add('cel-mai-ieftin');
        const badge = document.createElement('span');
        badge.className = 'badge-ieftin';
        badge.innerHTML = '<i class="bi bi-tag-fill"></i> Cel mai ieftin';
        const colDreapta = a.querySelector('.col-dreapta');
        if (colDreapta) colDreapta.prepend(badge);
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

    if (protocol && /^\d+$/.test(protocol)) {
        afiseazaEroare('Câmpul "Protocol conținut" nu poate fi format doar din cifre. Introduceți un protocol valid (ex: I2C, SPI).');
        return false;
    }

    if (greutate !== '') {
        const val = parseFloat(greutate);
        if (isNaN(val) || val < 0) {
            afiseazaEroare('Câmpul "Greutate maximă" trebuie să fie un număr pozitiv (în grame).');
            return false;
        }
    }

    if (descriereRaw.length > 0 && descriereRaw.trim().length === 0) {
        descriereEl.classList.add('is-invalid');
        afiseazaEroare('Câmpul "Cuvânt cheie în descriere" conține doar spații. Introduceți un cuvânt valid sau lăsați gol.');
        return false;
    }
    descriereEl.classList.remove('is-invalid');

    ascundeEroare();
    return true;
}

/* ── Bonus 5: paginare ──────────────────────────────────────────── */
let paginaCurenta = 1;

function getK() {
    const val = document.getElementById('select-k')?.value;
    if (val === 'all') return Infinity;
    return parseInt(val) || 10;
}

function actualizeazaPaginare() {
    const k = getK();
    const sesSterse = getSterseSession();
    const vizibile = articole.filter(a => {
        const id = String(a.dataset.id);
        if (sesSterse.has(id) || sterseTemp.has(id)) return false;
        if (salvate.has(id)) return true;
        return a.dataset.filtratOk === 'true';
    });

    const nrPagini = k === Infinity ? 1 : Math.ceil(vizibile.length / k);
    if (paginaCurenta > nrPagini) paginaCurenta = Math.max(1, nrPagini);

    const butoane = document.getElementById('butoane-pagini');
    if (!butoane) return;
    butoane.innerHTML = '';

    if (nrPagini <= 1) return;

    for (let i = 1; i <= nrPagini; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn-pagina' + (i === paginaCurenta ? ' activa' : '');
        btn.textContent = i;
        btn.dataset.pagina = i;
        btn.addEventListener('click', function() {
            paginaCurenta = parseInt(this.dataset.pagina);
            aplicaPaginare();
        });
        butoane.appendChild(btn);
    }
}

function aplicaPaginare() {
    const k = getK();
    const sesSterse = getSterseSession();

    // Toate articolele vizibile dupa filtrare (dar nu sterse)
    const vizibile = [];
    articole.forEach(a => {
        const id = String(a.dataset.id);
        if (sesSterse.has(id) || sterseTemp.has(id)) {
            a.style.display = 'none';
            return;
        }
        if (salvate.has(id)) {
            // salvate = mereu vizibile dupa filtrare
            vizibile.push(a);
            return;
        }
        if (a.dataset.filtratOk === 'true') {
            vizibile.push(a);
        } else {
            a.style.display = 'none';
        }
    });

    if (k === Infinity) {
        vizibile.forEach(a => { a.style.display = ''; });
        actualizeazaPaginare();
        actualizeazaContor();
        marcheazaCelMaiIeftin();
        return;
    }

    const start = (paginaCurenta - 1) * k;
    const end   = start + k;
    vizibile.forEach((a, i) => {
        a.style.display = (i >= start && i < end) ? '' : 'none';
    });

    actualizeazaPaginare();
    actualizeazaContor();
    marcheazaCelMaiIeftin();
}

/* ── Filtrare ───────────────────────────────────────────────────── */
function filtrare() {
    if (!valideaza()) return;

    const protocol     = normaliz(document.getElementById('filtru-protocol').value.trim());
    const pretMax      = parseFloat(document.getElementById('filtru-pret').value);
    const greutateMax  = document.getElementById('filtru-greutate').value.trim();
    const inStocVal    = document.querySelector('input[name="in_stoc"]:checked').value;
    const subcategorii = [...document.querySelectorAll('.cb-subcategorie:checked')].map(cb => cb.value);
    const descriereKw  = normaliz(document.getElementById('filtru-descriere').value.trim());
    const compatVal    = document.getElementById('filtru-compat').value;
    const protoExcluse = [...document.getElementById('filtru-proto-exclude').selectedOptions].map(o => o.value);
    const sesSterse    = getSterseSession();

    articole.forEach(art => {
        const id = String(art.dataset.id);

        // Produse sterse din sesiune sau temp: mereu ascunse
        if (sesSterse.has(id) || sterseTemp.has(id)) {
            art.dataset.filtratOk = 'false';
            art.style.display = 'none';
            return;
        }

        let vizibil = true;

        // Bonus 6: produsele salvate trec de filtru
        if (!salvate.has(id)) {
            // 1. Text — protocol (cu normalizare diacritice)
            if (protocol && !normaliz(art.dataset.protocoale).includes(protocol)) vizibil = false;
            // 2. Range — preț ≤ pretMax
            if (parseFloat(art.dataset.pret) > pretMax) vizibil = false;
            // 3. Datalist — greutate ≤ greutateMax
            if (greutateMax !== '' && parseInt(art.dataset.greutate) > parseFloat(greutateMax)) vizibil = false;
            // 4. Radio — în stoc
            if (inStocVal === 'da' && art.dataset.inStoc !== 'da') vizibil = false;
            if (inStocVal === 'nu' && art.dataset.inStoc !== 'nu') vizibil = false;
            // 5. Checkbox — subcategorie
            if (!subcategorii.includes(art.dataset.subcategorie)) vizibil = false;
            // 6. Textarea — cuvânt cheie în descriere (cu normalizare)
            if (descriereKw && !normaliz(art.dataset.descriere).includes(descriereKw)) vizibil = false;
            // 7. Select simplu — compatibilitate exactă
            if (compatVal && art.dataset.compatibilitate !== compatVal) vizibil = false;
            // 8. Select multiplu — exclude protocoale
            if (protoExcluse.length > 0) {
                const protoArr = art.dataset.protocoale.split(',').map(p => p.trim()).filter(Boolean);
                if (protoExcluse.some(ep => protoArr.includes(ep))) vizibil = false;
            }
        }

        art.dataset.filtratOk = vizibil ? 'true' : 'false';
    });

    paginaCurenta = 1;
    aplicaPaginare();

    // Bonus 3: mesaj când filtrarea nu găsește produse
    const nrVizibile = articole.filter(a => a.style.display !== 'none').length;
    if (mesajFiltruGol) mesajFiltruGol.hidden = nrVizibile > 0;

    salveazaFiltrare();       // Bonus 3 Etapa 7
}

/* ── Sortare simplă (subcategorie + preț) ───────────────────────── */
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
    filtrare();
}

/* ── Bonus 8: sortare avansată pe chei multiple ─────────────────── */
const CAMPURI_SORTARE = {
    pret:            a => parseFloat(a.dataset.pret),
    greutate:        a => parseInt(a.dataset.greutate),
    subcategorie:    a => a.dataset.subcategorie,
    compatibilitate: a => a.dataset.compatibilitate,
    data_adaugare:   a => new Date(a.dataset.dataAdaugare || 0).getTime(),
    nume:            a => (a.dataset.nume || '').toLowerCase()
};

function sortareMultiple() {
    if (!valideaza()) return;

    const chei = [...document.querySelectorAll('.rand-sortare')]
        .map(rand => ({
            camp: rand.querySelector('.select-sort-camp').value,
            dir:  rand.querySelector('.select-sort-dir').value
        }))
        .filter(k => k.camp !== '');

    if (chei.length === 0) {
        afiseazaEroare('Selectați cel puțin un câmp de sortare.');
        return;
    }

    const copie = [...articole];
    copie.sort((a, b) => {
        for (const { camp, dir } of chei) {
            const getFn = CAMPURI_SORTARE[camp];
            if (!getFn) continue;
            const vA = getFn(a);
            const vB = getFn(b);
            let cmp = typeof vA === 'string'
                ? vA.localeCompare(vB, 'ro')
                : (vA < vB ? -1 : vA > vB ? 1 : 0);
            if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
        }
        return 0;
    });

    copie.forEach(art => gridProduse.appendChild(art));
    filtrare();
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

    const div = document.createElement('div');
    div.className = 'div-calcul-fix';
    div.innerHTML = `
        <strong>Calcul prețuri (${vizibile.length} produse):</strong><br>
        Sumă: <strong>${suma.toFixed(2)} RON</strong><br>
        Medie: <strong>${medie.toFixed(2)} RON</strong><br>
        Min: ${minim.toFixed(2)} RON &nbsp;|&nbsp; Max: ${maxim.toFixed(2)} RON
    `;
    document.body.appendChild(div);
    setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 2000);
}

/* ── Resetare ───────────────────────────────────────────────────── */
function resetare() {
    if (!confirm('Sigur doriți să resetați toate filtrele și sortarea?')) return;

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
    [...document.getElementById('filtru-proto-exclude').options].forEach(o => { o.selected = false; });

    // Bonus 3 Etapa 7: dezactivează salvarea și șterge din localStorage
    const cbSalveaza = document.getElementById('cb-salveaza-filtrare');
    if (cbSalveaza) cbSalveaza.checked = false;
    localStorage.removeItem('filtre-produse');

    // Bonus 6: sterseTemp se goleste la resetare
    sterseTemp.clear();

    articole.forEach(art => {
        art.dataset.filtratOk = 'true';
        art.style.display = '';
    });
    [...articole]
        .sort((a, b) => parseInt(a.dataset.id) - parseInt(b.dataset.id))
        .forEach(art => gridProduse.appendChild(art));

    paginaCurenta = 1;

    if (mesajFiltruGol) mesajFiltruGol.hidden = true;
    ascundeEroare();
    actualizeazaContor();
    marcheazaCelMaiIeftin();
    actualizeazaPaginare();
}

/* ── Bonus 3 Etapa 7: filtre persistente (localStorage) ─────────── */
function salveazaFiltrare() {
    const cb = document.getElementById('cb-salveaza-filtrare');
    if (!cb || !cb.checked) return;

    const filtre = {
        protocol:     document.getElementById('filtru-protocol').value,
        pret:         document.getElementById('filtru-pret').value,
        greutate:     document.getElementById('filtru-greutate').value,
        inStoc:       document.querySelector('input[name="in_stoc"]:checked')?.value || 'oricare',
        subcategorii: [...document.querySelectorAll('.cb-subcategorie:checked')].map(cb => cb.value),
        descriere:    document.getElementById('filtru-descriere').value,
        compat:       document.getElementById('filtru-compat').value,
        protoExcluse: [...document.getElementById('filtru-proto-exclude').selectedOptions].map(o => o.value)
    };
    localStorage.setItem('filtre-produse', JSON.stringify(filtre));
}

function restaureazaFiltrare() {
    const salvatJson = localStorage.getItem('filtre-produse');
    if (!salvatJson) return;

    const cb = document.getElementById('cb-salveaza-filtrare');
    if (cb) cb.checked = true;

    try {
        const f = JSON.parse(salvatJson);
        if (f.protocol !== undefined) document.getElementById('filtru-protocol').value = f.protocol;
        if (f.pret !== undefined) {
            const r = document.getElementById('filtru-pret');
            r.value = f.pret;
            document.getElementById('pret-valoare-curenta').textContent = `(${f.pret} RON)`;
        }
        if (f.greutate !== undefined) document.getElementById('filtru-greutate').value = f.greutate;
        if (f.inStoc) {
            const radio = document.querySelector(`input[name="in_stoc"][value="${f.inStoc}"]`);
            if (radio) radio.checked = true;
        }
        if (f.subcategorii) {
            document.querySelectorAll('.cb-subcategorie').forEach(el => {
                el.checked = f.subcategorii.includes(el.value);
            });
        }
        if (f.descriere !== undefined) document.getElementById('filtru-descriere').value = f.descriere;
        if (f.compat !== undefined)    document.getElementById('filtru-compat').value    = f.compat;
        if (f.protoExcluse) {
            [...document.getElementById('filtru-proto-exclude').options].forEach(o => {
                o.selected = f.protoExcluse.includes(o.value);
            });
        }
        filtrare();
    } catch (_e) {
        localStorage.removeItem('filtre-produse');
    }
}

/* ── Bonus 11: modal detalii produs ─────────────────────────────── */
function initModal() {
    const modalEl = document.getElementById('modal-produs');
    if (!modalEl || typeof bootstrap === 'undefined') return;

    const bsModal = new bootstrap.Modal(modalEl);

    articole.forEach(art => {
        art.style.cursor = 'pointer';
        art.addEventListener('click', function (e) {
            if (e.target.tagName === 'A' || e.target.closest('a')) return;
            if (e.target.closest('.btn-actiune') || e.target.closest('.btn-compara')) return;

            const img = art.querySelector('.produs-imagine');
            document.getElementById('modal-produs-titlu-label').textContent = art.dataset.nume || '';
            document.getElementById('modal-produs-imagine').src  = img?.src  || '';
            document.getElementById('modal-produs-imagine').alt  = img?.alt  || '';
            document.getElementById('modal-produs-pret').textContent        = parseFloat(art.dataset.pret).toFixed(2) + ' RON';
            document.getElementById('modal-produs-compat').textContent      = art.dataset.compatibilitate || '—';
            document.getElementById('modal-produs-protocoale').textContent  = art.dataset.protocoale?.replace(/,/g, ', ') || '—';
            document.getElementById('modal-produs-stoc').textContent        = art.dataset.inStoc === 'da' ? '✓ Da' : '✗ Nu';
            document.getElementById('modal-produs-greutate').textContent    = art.dataset.greutate + ' g';
            document.getElementById('modal-produs-descriere').textContent   = art.querySelector('.produs-descriere')?.textContent || '';
            document.getElementById('modal-produs-link').href = `/produs/${art.dataset.id}`;

            bsModal.show();
        });
    });
}

/* ── Bonus 4: onchange → filtrare automată ──────────────────────── */
function initOnchange() {
    document.getElementById('filtru-protocol').addEventListener('input',  filtrare);
    document.getElementById('filtru-greutate').addEventListener('input',  filtrare);
    document.getElementById('filtru-greutate').addEventListener('change', filtrare);
    document.querySelectorAll('input[name="in_stoc"]').forEach(r  => r.addEventListener('change',  filtrare));
    document.querySelectorAll('.cb-subcategorie').forEach(cb       => cb.addEventListener('change', filtrare));
    document.getElementById('filtru-descriere').addEventListener('input',  filtrare);
    document.getElementById('filtru-compat').addEventListener('change',    filtrare);
    document.getElementById('filtru-proto-exclude').addEventListener('change', filtrare);
    document.getElementById('select-k')?.addEventListener('change', function() {
        paginaCurenta = 1;
        aplicaPaginare();
    });
}

/* ── Sortare avansată: adăugare/ștergere rânduri ────────────────── */
function initSortareUI() {
    const container = document.getElementById('randuri-sortare');
    if (!container) return;

    document.getElementById('btn-adauga-rand')?.addEventListener('click', () => {
        const nou = document.createElement('div');
        nou.className = 'rand-sortare d-flex align-items-center gap-2 mb-2 flex-wrap';
        nou.innerHTML = `
            <select class="form-select form-select-sm select-sort-camp" style="max-width:160px;">
                <option value="">— câmp —</option>
                <option value="pret">Preț</option>
                <option value="greutate">Greutate</option>
                <option value="subcategorie">Subcategorie</option>
                <option value="compatibilitate">Compatibilitate</option>
                <option value="data_adaugare">Dată adăugare</option>
                <option value="nume">Nume</option>
            </select>
            <select class="form-select form-select-sm select-sort-dir" style="max-width:140px;">
                <option value="asc">Crescător ↑</option>
                <option value="desc">Descrescător ↓</option>
            </select>
            <button type="button" class="btn btn-sm btn-outline-secondary btn-sterge-rand" title="Elimină rândul">
                <i class="bi bi-x-lg"></i>
            </button>`;
        container.appendChild(nou);
    });

    container.addEventListener('click', e => {
        const btn = e.target.closest('.btn-sterge-rand');
        if (!btn) return;
        const rand = btn.closest('.rand-sortare');
        if (rand && container.querySelectorAll('.rand-sortare').length > 1) rand.remove();
    });
}

/* ── Bonus 6: butoane acțiuni per produs ───────────────────────── */
function initButoaneProdus() {
    const sesSterse = getSterseSession();

    // Ascunde produse sterse din sesiune la incarcare
    articole.forEach(art => {
        if (sesSterse.has(String(art.dataset.id))) {
            art.style.display = 'none';
        }
    });

    gridProduse.addEventListener('click', function(e) {
        const art = e.target.closest('.produs');
        if (!art) return;
        const id = String(art.dataset.id);

        // Btn salveaza
        if (e.target.closest('.btn-salveaza')) {
            e.stopPropagation();
            const btn = art.querySelector('.btn-salveaza');
            if (salvate.has(id)) {
                salvate.delete(id);
                btn.classList.remove('activ');
            } else {
                salvate.add(id);
                btn.classList.add('activ');
                art.style.display = ''; // salvate mereu vizibile
            }
            return;
        }

        // Btn stergere temporara
        if (e.target.closest('.btn-sterge-temp')) {
            e.stopPropagation();
            sterseTemp.add(id);
            art.style.display = 'none';
            actualizeazaContor();
            marcheazaCelMaiIeftin();
            actualizeazaPaginare();
            return;
        }

        // Btn stergere sesiune
        if (e.target.closest('.btn-sterge-sesiune')) {
            e.stopPropagation();
            addStersSession(id);
            art.style.display = 'none';
            actualizeazaContor();
            marcheazaCelMaiIeftin();
            actualizeazaPaginare();
            return;
        }
    });
}

/* ── Bonus 10: filtrare server ──────────────────────────────────── */
async function filtreazaServer() {
    const btn = document.getElementById('btn-filtreaza-server');
    if (btn) { btn.disabled = true; btn.textContent = 'Se încarcă...'; }

    const body = {
        protocoale: document.getElementById('filtru-protocol').value.trim() || null,
        pretMax:    parseFloat(document.getElementById('filtru-pret').value),
        greutateMax: document.getElementById('filtru-greutate').value.trim() || null,
        inStoc:     document.querySelector('input[name="in_stoc"]:checked')?.value || 'oricare',
        subcategorii: [...document.querySelectorAll('.cb-subcategorie:checked')].map(cb => cb.value),
        descriere:  document.getElementById('filtru-descriere').value.trim() || null,
        compat:     document.getElementById('filtru-compat').value || null,
        protoExcluse: [...document.getElementById('filtru-proto-exclude').selectedOptions].map(o => o.value)
    };

    try {
        const resp = await fetch('/api/filtrare-produse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const date = await resp.json();
        const idsRetur = new Set(date.produse.map(p => String(p.id)));

        articole.forEach(art => {
            const id = String(art.dataset.id);
            art.dataset.filtratOk = idsRetur.has(id) ? 'true' : 'false';
        });

        // Reordonare: produsele returnate, în ordinea serverului
        date.produse.forEach(prod => {
            const art = document.getElementById('ar_ent_' + prod.id);
            if (art) gridProduse.appendChild(art);
        });

        paginaCurenta = 1;
        aplicaPaginare();

        const nrViz = articole.filter(a => a.style.display !== 'none').length;
        if (mesajFiltruGol) mesajFiltruGol.hidden = nrViz > 0;

    } catch (err) {
        console.error('Eroare filtrare server:', err);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-cloud-arrow-down-fill"></i> <span class="d-none d-sm-inline">Filtrare server</span>';
        }
    }
}

/* ── Event listeners ────────────────────────────────────────────── */
document.getElementById('btn-filtreaza').addEventListener('click', filtrare);
document.getElementById('btn-sort-asc').addEventListener('click', () => sortare('asc'));
document.getElementById('btn-sort-desc').addEventListener('click', () => sortare('desc'));
document.getElementById('btn-calcul').addEventListener('click', calculeaza);
document.getElementById('btn-reset').addEventListener('click', resetare);
document.getElementById('btn-sort-multiple')?.addEventListener('click', sortareMultiple);
document.getElementById('btn-filtreaza-server')?.addEventListener('click', filtreazaServer);

/* ── Inițializare la încărcare ──────────────────────────────────── */
initRange();
initDatalistGreutate();
initTextareaValidare();
initProduseNoi();     // Bonus 18
initOnchange();       // Bonus 4
initSortareUI();      // Bonus 8
initModal();          // Bonus 11
initButoaneProdus();  // Bonus 6

// Initializare stare filtrat
articole.forEach(art => { art.dataset.filtratOk = 'true'; });

actualizeazaContor(); // Bonus 15
marcheazaCelMaiIeftin(); // Bonus 14
aplicaPaginare();        // Bonus 5 — aplică paginarea inițială (apelează și actualizeazaPaginare intern)
restaureazaFiltrare();   // Bonus 3 Etapa 7
