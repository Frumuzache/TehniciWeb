"use strict";
/* ══════════════════════════════════════════════════════════════════
   comparare.js — Bonus 20: comparare produse (max 2)
   ══════════════════════════════════════════════════════════════════ */

const LS_CHEIE_COMP = 'produse-comparare';
var autoHideTimeout  = null;

function getComparare() {
    try {
        return JSON.parse(localStorage.getItem(LS_CHEIE_COMP) || '[]');
    } catch (_) {
        return [];
    }
}

function saveComparare(lista) {
    localStorage.setItem(LS_CHEIE_COMP, JSON.stringify(lista));
}

function actualizareComparare() {
    var container = document.getElementById('container-comparare');
    if (!container) return;

    // Arata containerul doar pe paginile produse/produs
    var tipPagina = document.body.dataset.tipPagina;
    if (tipPagina !== 'produse' && tipPagina !== 'produs') {
        container.style.display = 'none';
        return;
    }

    var lista = getComparare();

    var slot1 = container.querySelector('.comparare-slot-1');
    var slot2 = container.querySelector('.comparare-slot-2');
    var btnAf  = document.getElementById('btn-comparare-afiseaza');

    if (slot1) slot1.textContent = lista[0] ? lista[0].nume : '—';
    if (slot2) slot2.textContent = lista[1] ? lista[1].nume : '—';

    if (btnAf) {
        btnAf.style.display = (lista.length === 2) ? '' : 'none';
    }

    container.style.display = lista.length > 0 ? '' : 'none';

    // Actualizare stare butoane .btn-compara
    document.querySelectorAll('.btn-compara').forEach(function(btn) {
        var id = String(btn.dataset.id);
        var inLista = lista.some(function(p) { return String(p.id) === id; });
        btn.classList.toggle('btn-compara--activ', inLista);
        btn.classList.toggle('btn-compara--dezactivat', !inLista && lista.length >= 2);
    });
}

// Delegare click pe .btn-compara
document.addEventListener('click', function(e) {
    // Buton comparare produs
    var btnComp = e.target.closest('.btn-compara');
    if (btnComp) {
        e.stopPropagation();
        var id    = String(btnComp.dataset.id);
        var lista = getComparare();
        var idx   = lista.findIndex(function(p) { return String(p.id) === id; });

        if (idx !== -1) {
            // Eliminare din lista
            lista.splice(idx, 1);
        } else if (lista.length < 2) {
            // Adaugare
            lista.push({
                id:              id,
                nume:            btnComp.dataset.nume || '',
                pret:            btnComp.dataset.pret || '',
                compatibilitate: btnComp.dataset.compatibilitate || '',
                protocoale:      btnComp.dataset.protocoale || '',
                inStoc:          btnComp.dataset.inStoc || '',
                greutate:        btnComp.dataset.greutate || '',
                imagine:         btnComp.dataset.imagine || ''
            });
        }
        saveComparare(lista);
        actualizareComparare();

        // Auto-ascundere daca < 2 produse dupa 500ms
        if (autoHideTimeout) clearTimeout(autoHideTimeout);
        if (lista.length < 2) {
            autoHideTimeout = setTimeout(function() {
                if (getComparare().length < 2) {
                    var c = document.getElementById('container-comparare');
                    if (c && getComparare().length === 0) c.style.display = 'none';
                }
            }, 500);
        }
        return;
    }

    // Buton stergere slot 0
    if (e.target.closest('#btn-comparare-sterge-0')) {
        var lst = getComparare();
        lst.splice(0, 1);
        saveComparare(lst);
        actualizareComparare();
        return;
    }

    // Buton stergere slot 1
    if (e.target.closest('#btn-comparare-sterge-1')) {
        var lst2 = getComparare();
        lst2.splice(1, 1);
        saveComparare(lst2);
        actualizareComparare();
        return;
    }

    // Buton afisare comparare
    if (e.target.closest('#btn-comparare-afiseaza')) {
        var listaAf = getComparare();
        if (listaAf.length < 2) return;
        var p1 = listaAf[0];
        var p2 = listaAf[1];

        var html = '<!DOCTYPE html><html lang="ro"><head>' +
            '<meta charset="UTF-8">' +
            '<title>Comparare produse</title>' +
            '<style>' +
            'body{font-family:Arial,sans-serif;padding:2rem;background:#f5f9ff;color:#0f172a;}' +
            'h1{color:#1d3557;border-bottom:3px solid #d4a017;padding-bottom:.5rem;}' +
            'table{width:100%;border-collapse:collapse;margin-top:1.5rem;background:#fff;}' +
            'th,td{padding:.65rem 1rem;border:1px solid #c7d9ec;text-align:left;}' +
            'thead th{background:#1d3557;color:#fff;font-weight:700;}' +
            'tbody tr:nth-child(even){background:#f5f9ff;}' +
            'img{max-width:120px;max-height:90px;object-fit:cover;border-radius:6px;}' +
            '</style></head><body>' +
            '<h1>&#9878; Comparare produse</h1>' +
            '<table>' +
            '<thead><tr><th>Caracteristică</th><th>' + p1.nume + '</th><th>' + p2.nume + '</th></tr></thead>' +
            '<tbody>' +
            '<tr><th>Imagine</th>' +
            '<td><img src="/resurse/imagini/produse/' + p1.imagine + '" alt="' + p1.nume + '" onerror="this.src=\'/resurse/imagini/produse/placeholder.svg\'"></td>' +
            '<td><img src="/resurse/imagini/produse/' + p2.imagine + '" alt="' + p2.nume + '" onerror="this.src=\'/resurse/imagini/produse/placeholder.svg\'"></td>' +
            '</tr>' +
            '<tr><th>Preț</th><td>' + parseFloat(p1.pret).toFixed(2) + ' RON</td><td>' + parseFloat(p2.pret).toFixed(2) + ' RON</td></tr>' +
            '<tr><th>Compatibilitate</th><td>' + (p1.compatibilitate || '—') + '</td><td>' + (p2.compatibilitate || '—') + '</td></tr>' +
            '<tr><th>Protocoale</th><td>' + (p1.protocoale ? p1.protocoale.replace(/,/g, ', ') : '—') + '</td><td>' + (p2.protocoale ? p2.protocoale.replace(/,/g, ', ') : '—') + '</td></tr>' +
            '<tr><th>În stoc</th><td>' + (p1.inStoc === 'da' ? '✓ Da' : '✗ Nu') + '</td><td>' + (p2.inStoc === 'da' ? '✓ Da' : '✗ Nu') + '</td></tr>' +
            '<tr><th>Greutate</th><td>' + (p1.greutate || '—') + ' g</td><td>' + (p2.greutate || '—') + ' g</td></tr>' +
            '</tbody></table>' +
            '</body></html>';

        var win = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
        if (win) {
            win.document.write(html);
            win.document.close();
        }
        return;
    }
});

// Initializare la incarcare
actualizareComparare();
