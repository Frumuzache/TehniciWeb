const express   = require("express");
const path      = require("path");
const fs        = require("fs");
const sass      = require("sass");
const ejs       = require("ejs");
const sharp     = require("sharp");
const pg        = require("pg");
const session   = require("express-session");
const formidable = require("formidable");

const AccesBD        = require("./module_proprii/accesbd");
const { Utilizator } = require("./module_proprii/utilizator");
const Drepturi       = require("./module_proprii/drepturi");

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const obGlobal = {
    obErori: null,
    categorii: [],          // valori enum categ_piesa, incarcate la pornire din DB
    folderScss: path.join(__dirname, "resurse/scss"),
    folderCss: path.join(__dirname, "resurse/css"),
    folderBackup: path.join(__dirname, "backup")
};

const vectFoldere = ["temp", "backup", "logs", "fisiere_uploadate", "poze_uploadate"];
for (const folder of vectFoldere) {
    const caleFolder = path.join(__dirname, folder);
    if (!fs.existsSync(caleFolder)) {
        fs.mkdirSync(caleFolder, { recursive: true });
    }
}

// ─── Conexiune PostgreSQL ─────────────────────────────────────────────────────
const client = new pg.Client({
    database: "cti_2026",
    user: "frumu",
    password: "frumu",
    host: "localhost",
    port: 5432
});

// ─── Session middleware ───────────────────────────────────────────────────────
app.use(session({
    secret: process.env.SESSION_SECRET || 'robotica-tw-secret',
    resave: true,
    saveUninitialized: false
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ─── Helper URL ───────────────────────────────────────────────────────────────
/**
 * Construiește o cale URL din segmente, normalizând separatorii și slash-urile duble.
 * @param   {...string} segmente
 * @returns {string}
 */
function caleWeb(...segmente) {
    return segmente.join("/").replace(/\\/g, "/").replace(/\/+/g, "/");
}

/**
 * Extrage IP-ul real al clientului din request (suportă proxy).
 * @param   {import('express').Request} req
 * @returns {string|null}
 */
function getIp(req) {
    let ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
          || req.ip
          || req.socket?.remoteAddress;
    if (ip === '::1') ip = '127.0.0.1';
    return ip || null;
}

// ─── Helper formatare data in romana ─────────────────────────────────────────
const LUNI_RO = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie',
                 'Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
const ZILE_RO = ['Duminică','Luni','Marți','Miercuri','Joi','Vineri','Sâmbătă'];

/**
 * Formatează un obiect Date sau un șir de dată în format românesc.
 * @param   {Date|string} data
 * @returns {string} Ex: "15-Ianuarie-2026 [Joi]"
 */
function formatDataRo(data) {
    const d = new Date(data);
    return `${d.getDate()}-${LUNI_RO[d.getMonth()]}-${d.getFullYear()} [${ZILE_RO[d.getDay()]}]`;
}

// ─── Middleware global: categorii, ip, helper date, utilizator din sesiune ───
app.use((req, res, next) => {
    res.locals.categorii = obGlobal.categorii;
    res.locals.ip = req.ip;
    res.locals.formatDataRo = formatDataRo;
    res.locals.Drepturi = Drepturi;

    if (req.session && req.session.utilizator) {
        req.utilizator = res.locals.utilizator = new Utilizator(req.session.utilizator);
        res.locals.mesajLogin = req.session.mesajLogin;
        delete req.session.mesajLogin;
    }
    next();
});

// ─── Middleware: înregistrare accesări pagini ─────────────────────────────────
app.use((req, res, next) => {
    const ip = getIp(req);
    if (ip) {
        try {
            const campuri = { ip, pagina: req.url };
            if (req.session?.utilizator?.id) campuri.user_id = req.session.utilizator.id;
            AccesBD.getInstanta().insert({ tabel: 'accesari', campuri }, (err) => {
                if (err) console.error('[accesari] Eroare insert:', err.message);
            });
        } catch (_e) { /* AccesBD neinitialized yet */ }
    }
    next();
});

/**
 * Șterge din tabela `accesari` toate înregistrările mai vechi de 10 minute.
 * Apelată automat la fiecare 10 minute prin `setInterval`.
 * @returns {void}
 */
function stergeAccesariVechi() {
    try {
        AccesBD.getInstanta().delete(
            { tabel: 'accesari', conditiiAnd: ["now() - data_accesare >= interval '10 minutes'"] },
            (err) => { if (err) console.error('[accesari] Eroare ștergere vechi:', err.message); }
        );
    } catch (_e) { /* AccesBD neinitialized yet */ }
}
setInterval(stergeAccesariVechi, 10 * 60 * 1000);

// ─── Bonus 13: Ștergere fișiere backup vechi ─────────────────────────────────
const BACKUP_MAX_AGE_MIN = 30;

function stergeBackupVechi() {
    const caleBackup = path.join(obGlobal.folderBackup, 'resurse', 'css');
    if (!fs.existsSync(caleBackup)) return;
    const acum = Date.now();
    try {
        for (const fisier of fs.readdirSync(caleBackup)) {
            const cale = path.join(caleBackup, fisier);
            try {
                if (acum - fs.statSync(cale).mtimeMs > BACKUP_MAX_AGE_MIN * 60 * 1000) {
                    fs.unlinkSync(cale);
                    console.log(`[backup] Șters fișier vechi: ${fisier}`);
                }
            } catch (_e) {}
        }
    } catch (err) {
        console.error('[backup] Eroare la ștergerea fișierelor vechi:', err.message);
    }
}
setInterval(stergeBackupVechi, 5 * 60 * 1000);

// ─── Rute statice ────────────────────────────────────────────────────────────
app.get('/resurse/imagini/galerie/:fisier_imagine', async (req, res) => {
    const { fisier_imagine } = req.params;
    const latime = req.query.w ? parseInt(req.query.w) : null;

    const caleOriginal = path.join(__dirname, 'resurse/imagini/galerie', fisier_imagine);

    if (!fs.existsSync(caleOriginal)) {
        return res.status(404).send('Imagine not found');
    }

    if (!latime) {
        return res.sendFile(caleOriginal);
    }

    const ext = path.extname(fisier_imagine);
    const numeFisSanzDeExt = path.basename(fisier_imagine, ext);
    const caleRedimensionata = path.join(__dirname, 'resurse/imagini/galerie', `${numeFisSanzDeExt}_${latime}w${ext}`);

    try {
        if (!fs.existsSync(caleRedimensionata)) {
            const inaltime = Math.round(latime * 1.25);
            await sharp(caleOriginal)
                .resize(latime, inaltime, { fit: 'cover' })
                .toFile(caleRedimensionata);
        }
        res.sendFile(caleRedimensionata);
    } catch (err) {
        console.error('Eroare la redimensionare:', err.message);
        res.sendFile(caleOriginal);
    }
});

app.get(["/resurse", "/resurse/"], (_req, res) => {
    afisareEroare(res, 403);
});

app.use("/resurse", express.static(path.join(__dirname, "resurse")));
app.use("/dist", express.static(path.join(__dirname, "node_modules/bootstrap/dist")));
app.use("/poze_uploadate", express.static(path.join(__dirname, "poze_uploadate")));
app.use(express.static(__dirname, { index: false }));

// ─── Erori ───────────────────────────────────────────────────────────────────

/**
 * Parsează un șir JSON raw și detectează proprietăți duplicate în același obiect.
 * Folosit în {@link verificaErori} pentru validarea integrității erori.json.
 * @param   {string}   jsonString - Conținutul JSON ca șir brut
 * @returns {string[]} Lista mesajelor de avertisment pentru duplicate găsite
 */
function verificaCheiDuplicate(jsonString) {
    const probleme = [];
    const stackChei = [];
    let i = 0;

    function citesteSir() {
        let s = '';
        i++;
        while (i < jsonString.length) {
            if (jsonString[i] === '\\') { s += jsonString[i] + jsonString[i + 1]; i += 2; }
            else if (jsonString[i] === '"') { i++; break; }
            else s += jsonString[i++];
        }
        return s;
    }

    while (i < jsonString.length) {
        const ch = jsonString[i];
        if (ch === '{') { stackChei.push(new Map()); i++; }
        else if (ch === '}') { stackChei.pop(); i++; }
        else if (ch === '[' || ch === ']') { i++; }
        else if (ch === '"') {
            const cheie = citesteSir();
            let j = i;
            while (j < jsonString.length && ' \t\n\r'.includes(jsonString[j])) j++;
            if (j < jsonString.length && jsonString[j] === ':' && stackChei.length > 0) {
                const map = stackChei[stackChei.length - 1];
                const count = (map.get(cheie) || 0) + 1;
                map.set(cheie, count);
                if (count > 1)
                    probleme.push(`Proprietatea "${cheie}" apare de ${count} ori în același obiect JSON.`);
            }
        } else { i++; }
    }
    return probleme;
}

/**
 * Validează fișierul erori.json la pornirea serverului.
 * Afișează mesaje de eroare clare pentru orice problemă detectată
 * (fișier lipsă, proprietăți obligatorii absente, imagini inexistente pe disc,
 * chei duplicate, identificatori duplicați). Oprește procesul dacă fișierul lipsește
 * sau nu poate fi parsat.
 * @returns {void}
 */
function verificaErori() {
    const caleJson = path.join(__dirname, "resurse/json/erori.json");

    // A: fișierul nu există → exit
    if (!fs.existsSync(caleJson)) {
        console.error("[verificaErori] CRITIC: Fișierul erori.json nu există la calea:", caleJson);
        console.error("[verificaErori] Aplicația nu poate porni fără fișierul de erori. Se închide.");
        process.exit(1);
    }

    let continut, erori;
    try {
        continut = fs.readFileSync(caleJson, "utf-8");
        erori = JSON.parse(continut);
    } catch (err) {
        console.error("[verificaErori] CRITIC: erori.json nu poate fi parsat:", err.message);
        process.exit(1);
    }

    // B: lipsesc proprietăți obligatorii de nivel top
    for (const prop of ["cale_baza", "eroare_default", "info_erori"]) {
        if (erori[prop] === undefined)
            console.error(`[verificaErori] Proprietatea obligatorie "${prop}" lipsește din erori.json.`);
    }

    // C: eroare_default fără titlu, text sau imagine
    if (erori.eroare_default) {
        for (const prop of ["titlu", "text", "imagine"]) {
            if (!erori.eroare_default[prop])
                console.error(`[verificaErori] Proprietatea "${prop}" lipsește din eroare_default.`);
        }
    }

    // D: folderul cale_baza nu există pe disc
    if (erori.cale_baza) {
        const caleBazaAbs = path.join(__dirname, erori.cale_baza);
        if (!fs.existsSync(caleBazaAbs))
            console.error(`[verificaErori] Folderul din "cale_baza" nu există pe disc: ${caleBazaAbs}`);
    }

    // E: fișierele imagine nu există pe disc
    if (erori.cale_baza) {
        const caleBazaAbs = path.join(__dirname, erori.cale_baza);

        if (erori.eroare_default?.imagine) {
            const cale = path.join(caleBazaAbs, erori.eroare_default.imagine);
            if (!fs.existsSync(cale))
                console.error(`[verificaErori] Imaginea din eroare_default nu există pe disc: ${cale}`);
        }

        if (Array.isArray(erori.info_erori)) {
            for (const eroare of erori.info_erori) {
                if (eroare.imagine) {
                    const cale = path.join(caleBazaAbs, eroare.imagine);
                    if (!fs.existsSync(cale))
                        console.error(`[verificaErori] Imaginea pentru eroarea ${eroare.identificator} nu există pe disc: ${cale}`);
                }
            }
        }
    }

    // F: proprietăți duplicate în raw JSON string
    for (const msg of verificaCheiDuplicate(continut))
        console.error(`[verificaErori] Proprietate duplicată în JSON: ${msg}`);

    // G: mai multe erori cu același identificator
    if (Array.isArray(erori.info_erori)) {
        const contor = new Map();
        for (const eroare of erori.info_erori) {
            const id = eroare.identificator;
            if (!contor.has(id)) contor.set(id, []);
            contor.get(id).push(eroare);
        }
        for (const [id, lista] of contor) {
            if (lista.length > 1) {
                const detalii = lista.map(({ identificator, ...rest }) => JSON.stringify(rest)).join(" | ");
                console.error(`[verificaErori] Există ${lista.length} erori cu identificatorul ${id}: ${detalii}`);
            }
        }
    }
}

/**
 * Încarcă configurația erorilor din erori.json în {@link obGlobal.obErori}.
 * Construiește căile absolute ale imaginilor pentru fiecare eroare, concatenând
 * `cale_baza` cu `imagine`. Trebuie apelat o singură dată, după {@link verificaErori}.
 * @returns {void}
 */
function initErori() {
    const continut = fs.readFileSync(path.join(__dirname, "resurse/json/erori.json"), "utf-8");
    const erori = JSON.parse(continut);
    obGlobal.obErori = erori;

    const errDefault = erori.eroare_default;
    errDefault.imagine = caleWeb(erori.cale_baza, errDefault.imagine);

    for (const eroare of erori.info_erori) {
        eroare.imagine = caleWeb(erori.cale_baza, eroare.imagine);
    }
}

/**
 * Randează pagina de eroare folosind template-ul `pagini/eroare`.
 * Dacă parametrii opționali lipsesc, preia valorile din {@link obGlobal.obErori}.
 * Fallback la HTML simplu dacă EJS eșuează.
 * @param {import('express').Response} res          - Obiectul Response Express
 * @param {number}                     identificator - Codul erorii (ex: 404, 403, 500)
 * @param {string}                     [titlu]       - Titlu custom (suprascrie JSON)
 * @param {string}                     [text]        - Text custom (suprascrie JSON)
 * @param {string}                     [imagine]     - Cale imagine custom (suprascrie JSON)
 * @returns {void}
 */
function afisareEroare(res, identificator, titlu, text, imagine) {
    const eroare = obGlobal.obErori?.info_erori?.find((elem) => elem.identificator === identificator);
    const errDefault = obGlobal.obErori?.eroare_default || {
        identificator: 500,
        titlu: "Eroare",
        text: "A apărut o eroare.",
        imagine: ""
    };

    const statusCode = eroare?.identificator || errDefault.identificator || 500;
    // status: false în erori.json → răspuns cu HTTP 200 (nu se schimbă codul)
    const httpStatus = (eroare?.status === false) ? 200 : statusCode;
    const params = {
        imagine: imagine || eroare?.imagine || errDefault.imagine,
        titlu: titlu || eroare?.titlu || errDefault.titlu,
        text: text || eroare?.text || errDefault.text,
    };

    res.status(httpStatus).render("pagini/eroare", params, (err, html) => {
        if (err) {
            res.send(`<!doctype html><html lang="ro"><head><meta charset="utf-8">
                <title>${params.titlu}</title></head><body>
                <h1>${params.titlu}</h1><p>${params.text}</p></body></html>`);
        } else {
            res.send(html);
        }
    });
}

// ─── SCSS ────────────────────────────────────────────────────────────────────
/**
 * Compilează un fișier SCSS în CSS folosind pachetul `sass`.
 * Înainte de suprascriere, salvează o copie de backup a CSS-ului existent
 * în `backup/resurse/css/` cu timestamp în nume.
 * Căile relative sunt rezolvate față de `obGlobal.folderScss` / `obGlobal.folderCss`.
 * @param {string}  caleScss - Calea fișierului SCSS (absolută sau relativă la folderScss)
 * @param {string}  [caleCss]- Calea fișierului CSS de ieșire (implicit: același nume, extensie .css)
 * @returns {void}
 */
function compileazaScss(caleScss, caleCss) {
    if (!caleCss) {
        const numeFis = path.basename(caleScss, ".scss");
        caleCss = `${numeFis}.css`;
    }

    if (!path.isAbsolute(caleScss)) {
        caleScss = path.join(obGlobal.folderScss, caleScss);
    }
    if (!path.isAbsolute(caleCss)) {
        caleCss = path.join(obGlobal.folderCss, caleCss);
    }

    const caleBackup = path.join(obGlobal.folderBackup, "resurse/css");
    if (!fs.existsSync(caleBackup)) {
        fs.mkdirSync(caleBackup, { recursive: true });
    }

    const numeFisCss = path.basename(caleCss);
    if (fs.existsSync(caleCss)) {
        const timestamp = Date.now();
        const numeFisBaza = path.basename(caleCss, ".css");
        const numeBackup = `${numeFisBaza}_${timestamp}.css`;
        try {
            fs.copyFileSync(caleCss, path.join(caleBackup, numeBackup));
        } catch (err) {
            console.error(`Eroare la copierea backup pentru ${numeFisCss}:`, err.message);
        }
    }

    const rez = sass.compile(caleScss, {
        sourceMap: true,
        quietDeps: true,
        silenceDeprecations: ["import", "global-builtin", "color-functions", "if-function"]
    });
    fs.writeFileSync(caleCss, rez.css);
}

/**
 * Compilează toate fișierele SCSS din `obGlobal.folderScss` la pornirea serverului,
 * apoi activează un watcher `fs.watch` care recompilează automat la orice modificare.
 * @returns {void}
 */
function compileazaToateScss() {
    if (!fs.existsSync(obGlobal.folderScss)) return;

    const vFisiere = fs.readdirSync(obGlobal.folderScss);
    for (const numeFis of vFisiere) {
        if (path.extname(numeFis) === ".scss") {
            compileazaScss(path.join(obGlobal.folderScss, numeFis));
        }
    }

    fs.watch(obGlobal.folderScss, (eveniment, numeFis) => {
        if (!numeFis || (eveniment !== "change" && eveniment !== "rename")) return;
        const caleCompleta = path.join(obGlobal.folderScss, numeFis);
        if (fs.existsSync(caleCompleta) && path.extname(caleCompleta) === ".scss") {
            compileazaScss(caleCompleta);
        }
    });
}

// ─── Galerie ─────────────────────────────────────────────────────────────────
/**
 * Citește și returnează datele galeriei din `resurse/json/galerie.json`.
 * @returns {{ cale_galerie: string, imagini: object[] }} Obiectul galerie sau valori implicite goale la eroare
 */
function incarcaGalerie() {
    try {
        const caleFisier = path.join(__dirname, "resurse/json/galerie.json");
        if (fs.existsSync(caleFisier)) {
            return JSON.parse(fs.readFileSync(caleFisier, "utf-8"));
        }
    } catch (err) {
        console.error("Eroare la încărcarea galeriei:", err.message);
    }
    return { cale_galerie: "", imagini: [] };
}

/**
 * Validează galerie.json la pornire: verifică existența fișierului, a folderului
 * `cale_galerie` și a fiecărui fișier de imagine declarat. Afișează erori la consolă.
 * @returns {void}
 */
function verificaGalerie() {
    const caleFisier = path.join(__dirname, "resurse/json/galerie.json");
    if (!fs.existsSync(caleFisier)) {
        console.error("[Galerie] Fișierul galerie.json nu există la calea:", caleFisier);
        return;
    }
    let dateGalerie = null;
    try {
        dateGalerie = JSON.parse(fs.readFileSync(caleFisier, "utf-8"));
    } catch (err) {
        console.error("[Galerie] Eroare la parsarea galerie.json:", err.message);
        return;
    }
    const caleGalerieAbs = dateGalerie?.cale_galerie
        ? path.join(__dirname, dateGalerie.cale_galerie) : null;

    if (!caleGalerieAbs || !fs.existsSync(caleGalerieAbs)) {
        console.error("[Galerie] Folderul din 'cale_galerie' nu există:", caleGalerieAbs || "(lipsă)");
    }
    const imagini = Array.isArray(dateGalerie?.imagini) ? dateGalerie.imagini : [];
    for (const imagine of imagini) {
        const numeFisier = imagine?.fisier_imagine;
        if (!numeFisier) continue;
        const caleImagineAbs = caleGalerieAbs ? path.join(caleGalerieAbs, numeFisier) : null;
        if (!caleImagineAbs || !fs.existsSync(caleImagineAbs)) {
            console.error(`[Galerie] Fișierul de imagine nu există: ${numeFisier}`);
        }
    }
}

const indexZile = { "duminică":0,"luni":1,"marți":2,"miercuri":3,"joi":4,"vineri":5,"sâmbată":6 };

/**
 * Filtrează lista de imagini din galerie, returnând doar cele valabile în ziua specificată.
 * Fiecare imagine are un câmp `intervale_zile` — vector de perechi `[ziStart, ziSfârșit]`
 * cu denumiri în română (ex: `["luni", "vineri"]`). Suportă intervale ce trec peste
 * weekend (ex: `["sâmbătă", "luni"]`).
 * @param   {object[]}  imagini          - Lista completă de imagini din galerie.json
 * @param   {Date|null} [dataTest=null]  - Dată de test; dacă null, folosește ziua curentă
 * @returns {object[]} Imaginile valabile pentru ziua dată
 */
function esteImagineAstazi(imagini, dataTest = null) {
    const data = dataTest || new Date();
    const indexZilaCurenta = data.getDay();
    return imagini.filter(img => img.intervale_zile.some(interval => {
        const indexStart = indexZile[interval[0].toLowerCase()];
        const indexEnd = indexZile[interval[1].toLowerCase()];
        if (indexStart <= indexEnd) return indexZilaCurenta >= indexStart && indexZilaCurenta <= indexEnd;
        return indexZilaCurenta >= indexStart || indexZilaCurenta <= indexEnd;
    }));
}

/**
 * Citește și returnează lista produselor din `resurse/json/produse.json`.
 * @returns {object[]} Vectorul de produse sau un vector gol dacă fișierul lipsește/este invalid
 */
function incarcaProduse() {
    try {
        const caleFisier = path.join(__dirname, "resurse/json/produse.json");
        if (fs.existsSync(caleFisier)) {
            return JSON.parse(fs.readFileSync(caleFisier, "utf-8")).produse || [];
        }
    } catch (err) {
        console.error("Eroare la încărcarea produselor:", err.message);
    }
    return [];
}

// ─── Rute pagini EJS ──────────────────────────────────────────────────────────
app.get(["/", "/index", "/home"], (req, res) => {
    const produse = incarcaProduse();
    const dataTest = req.query.data ? new Date(req.query.data) : null;
    const dataDeTestare = dataTest || new Date();

    const galerie = incarcaGalerie();
    let imaginiAstazi = esteImagineAstazi(galerie.imagini, dataDeTestare);
    if (imaginiAstazi.length % 2 !== 0) imaginiAstazi = imaginiAstazi.slice(0, -1);

    res.render("index", {
        produse,
        galerie: { cale_galerie: galerie.cale_galerie, imagini: imaginiAstazi },
        dataAstazi: dataDeTestare,
        ip: req.ip
    });
});

app.get("/about", (req, res) => {
    res.render("pagini/about", { ip: req.ip });
});

app.get("/galerie", (req, res) => {
    const dataTest = req.query.data ? new Date(req.query.data) : null;
    const dataDeTestare = dataTest || new Date();

    const galerie = incarcaGalerie();
    let imaginiAstazi = esteImagineAstazi(galerie.imagini, dataDeTestare);
    if (imaginiAstazi.length % 2 !== 0) imaginiAstazi = imaginiAstazi.slice(0, -1);

    res.render("pagini/galerie", {
        galerie: { cale_galerie: galerie.cale_galerie, imagini: imaginiAstazi },
        dataAstazi: dataDeTestare,
        ip: req.ip
    });
});

// ─── Rute produse (DB) ────────────────────────────────────────────────────────
app.get("/produse", async (req, res) => {
    try {
        const categorieFilter = req.query.categorie;
        let clauzaWhere = "";
        let params = [];
        if (categorieFilter) {
            clauzaWhere = "WHERE categorie = $1";
            params = [categorieFilter];
        }

        const [rezProduse, rezSubcategorii, rezCompatibilitati] = await Promise.all([
            client.query(`SELECT * FROM piese ${clauzaWhere} ORDER BY id`, params),
            client.query("SELECT unnest FROM unnest(enum_range(null::subcateg_piesa)) AS unnest"),
            client.query("SELECT unnest FROM unnest(enum_range(null::compat_piesa)) AS unnest")
        ]);

        res.render("pagini/produse", {
            produse: rezProduse.rows,
            subcategorii: rezSubcategorii.rows.map(r => r.unnest),
            compatibilitati: rezCompatibilitati.rows.map(r => r.unnest),
            categorieSelectata: categorieFilter || null,
            ip: req.ip
        });
    } catch (err) {
        console.error("Eroare la /produse:", err.message);
        afisareEroare(res, 500, "Eroare baza de date", "Nu s-au putut încărca produsele.");
    }
});

app.get("/produs/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        afisareEroare(res, 404, "Produs inexistent", "ID-ul furnizat nu este valid.");
        return;
    }
    try {
        const [rezProdus, rezSimilare, rezSeturi] = await Promise.all([
            client.query("SELECT * FROM piese WHERE id = $1", [id]),
            // Bonus 16: produse similare (aceeași categorie, random, max 4)
            client.query(
                "SELECT id, nume, pret, imagine FROM piese WHERE id != $1 ORDER BY RANDOM() LIMIT 4",
                [id]
            ).catch(() => ({ rows: [] })),
            // Bonus 17d: seturi care conțin acest produs
            client.query(
                `SELECT s.id, s.nume_set FROM seturi s
                 JOIN asociere_set a ON a.id_set = s.id
                 WHERE a.id_produs = $1`,
                [id]
            ).catch(() => ({ rows: [] }))
        ]);

        if (rezProdus.rowCount === 0) {
            afisareEroare(res, 404, "Produs inexistent", `Nu există niciun produs cu id-ul ${id}.`);
            return;
        }

        // Refiltrare similare dupa categorie (query simplu fara categorie disponibila inainte)
        const catProdus = rezProdus.rows[0].categorie;
        const rezSimilareFiltrate = await client.query(
            "SELECT id, nume, pret, imagine FROM piese WHERE categorie = $1 AND id != $2 ORDER BY RANDOM() LIMIT 4",
            [catProdus, id]
        ).catch(() => ({ rows: [] }));

        res.render("pagini/produs", {
            produs: rezProdus.rows[0],
            produseSimilare: rezSimilareFiltrate.rows,
            seturiProdus: rezSeturi.rows,
            ip: req.ip
        });
    } catch (err) {
        console.error("Eroare la /produs/:id:", err.message);
        afisareEroare(res, 500, "Eroare baza de date", "Nu s-au putut încărca datele produsului.");
    }
});

// ─── API carousel produse ────────────────────────────────────────────────────
app.get("/api/produse-carousel", async (req, res) => {
    try {
        const rez = await client.query(
            "SELECT id, nume, categorie, pret, descriere, imagine FROM piese ORDER BY RANDOM() LIMIT 5"
        );
        res.json(rez.rows);
    } catch (err) {
        console.error("Eroare la /api/produse-carousel:", err.message);
        res.json([]);
    }
});

// ─── Bonus 10: API filtrare produse server-side ──────────────────────────────
app.post("/api/filtrare-produse", async (req, res) => {
    try {
        const { protocoale, pretMax, greutateMax, inStoc, subcategorii, descriere, compat, protoExcluse } = req.body;

        const conditii = [];
        const params   = [];

        if (protocoale) {
            params.push(`%${protocoale}%`);
            conditii.push(`protocoale::text ILIKE $${params.length}`);
        }

        if (pretMax !== undefined && pretMax !== null && !isNaN(pretMax)) {
            params.push(pretMax);
            conditii.push(`pret <= $${params.length}`);
        }

        if (greutateMax) {
            params.push(parseFloat(greutateMax));
            conditii.push(`greutate <= $${params.length}`);
        }

        if (inStoc === 'da') conditii.push('in_stoc = true');
        if (inStoc === 'nu') conditii.push('in_stoc = false');

        if (subcategorii && subcategorii.length > 0) {
            params.push(subcategorii);
            conditii.push(`subcategorie = ANY($${params.length}::subcateg_piesa[])`);
        }

        if (descriere) {
            params.push(`%${descriere}%`);
            conditii.push(`descriere ILIKE $${params.length}`);
        }

        if (compat) {
            params.push(compat);
            conditii.push(`compatibilitate = $${params.length}`);
        }

        if (protoExcluse && protoExcluse.length > 0) {
            for (const proto of protoExcluse) {
                params.push(proto);
                conditii.push(`NOT ($${params.length} = ANY(protocoale))`);
            }
        }

        const where = conditii.length > 0 ? `WHERE ${conditii.join(' AND ')}` : '';
        const rez   = await client.query(`SELECT * FROM piese ${where} ORDER BY id`, params);
        res.json({ produse: rez.rows });
    } catch (err) {
        console.error("Eroare la /api/filtrare-produse:", err.message);
        res.status(500).json({ produse: [], eroare: err.message });
    }
});

// ─── Bonus 12: Oferte automate ───────────────────────────────────────────────
const T_OFERTA_SEC  = 60;
const T_CLEANUP_MIN = 5;
const CALE_OFERTE   = path.join(__dirname, 'resurse/json/oferte.json');

function citesteOferte() {
    try {
        return JSON.parse(fs.readFileSync(CALE_OFERTE, 'utf-8'));
    } catch (_) { return []; }
}

function scrieOferte(oferte) {
    try {
        fs.writeFileSync(CALE_OFERTE, JSON.stringify(oferte, null, 2));
    } catch (err) {
        console.error('[oferte] Eroare scriere:', err.message);
    }
}

let ultimaCategOferta = null;

function genereazaOferta() {
    const categorii = obGlobal.categorii;
    if (!categorii || categorii.length === 0) return;

    let categ;
    const altele = categorii.filter(c => c !== ultimaCategOferta);
    categ = altele[Math.floor(Math.random() * altele.length)] || categorii[0];
    ultimaCategOferta = categ;

    const reducere   = Math.floor(Math.random() * 31) + 10; // 10-40
    const acum       = new Date();
    const finalizare = new Date(acum.getTime() + T_OFERTA_SEC * 1000);

    const oferta = {
        categorie:       categ,
        data_incepere:   acum.toISOString(),
        data_finalizare: finalizare.toISOString(),
        reducere
    };

    const oferte = citesteOferte();
    oferte.unshift(oferta);
    scrieOferte(oferte);
    console.log(`[oferte] Ofertă nouă: ${categ} -${reducere}%`);
}

function stergeOfertaVechi() {
    const oferte = citesteOferte();
    const limita = new Date(Date.now() - T_CLEANUP_MIN * 60 * 1000);
    const filtrate = oferte.filter(o => new Date(o.data_finalizare) > limita);
    if (filtrate.length !== oferte.length) {
        scrieOferte(filtrate);
        console.log(`[oferte] Șterse ${oferte.length - filtrate.length} oferte vechi`);
    }
}

app.get("/api/oferta-curenta", (req, res) => {
    const oferte = citesteOferte();
    res.json(oferte[0] || {});
});

// ─── Bonus 17b: Ruta /seturi ─────────────────────────────────────────────────
app.get("/seturi", async (req, res) => {
    try {
        const rezSeturi = await client.query("SELECT * FROM seturi ORDER BY id");
        const seturi = [];
        for (const set of rezSeturi.rows) {
            const rezProduse = await client.query(
                `SELECT p.id, p.nume, p.pret FROM piese p
                 JOIN asociere_set a ON a.id_produs = p.id
                 WHERE a.id_set = $1`,
                [set.id]
            );
            seturi.push({ ...set, produse: rezProduse.rows });
        }
        res.render("pagini/seturi", { seturi, ip: req.ip });
    } catch (err) {
        console.error("Eroare la /seturi:", err.message);
        afisareEroare(res, 500, "Eroare baza de date", "Nu s-au putut încărca seturile.");
    }
});

// ─── Rute utilizatori ────────────────────────────────────────────────────────

app.get('/inregistrare', (req, res) => {
    if (req.session?.utilizator) return res.redirect('/');
    res.render('pagini/inregistrare', { eroare: null, succes: null });
});

app.post('/inregistrare', (req, res) => {
    if (req.session?.utilizator) return res.redirect('/');
    const { username, nume, prenume, email, parola, culoare_chat } = req.body;
    if (!Utilizator.verificaUsername(username))
        return res.render('pagini/inregistrare', { eroare: 'Username invalid — 3-30 caractere alfanumerice sau underscore.', succes: null });
    if (!Utilizator.verificaNume(nume))
        return res.render('pagini/inregistrare', { eroare: 'Numele trebuie să conțină doar litere, spații sau cratime (min. 2 car.).', succes: null });
    if (!Utilizator.verificaNume(prenume))
        return res.render('pagini/inregistrare', { eroare: 'Prenumele trebuie să conțină doar litere, spații sau cratime (min. 2 car.).', succes: null });
    if (!Utilizator.verificaEmail(email))
        return res.render('pagini/inregistrare', { eroare: 'Adresa de email nu este validă.', succes: null });
    if (!parola || parola.length < 6)
        return res.render('pagini/inregistrare', { eroare: 'Parola trebuie să aibă cel puțin 6 caractere.', succes: null });

    Utilizator.getUtilizDupaUsername(username, {}, (utilizatorExistent) => {
        if (utilizatorExistent)
            return res.render('pagini/inregistrare', { eroare: 'Acest username este deja folosit.', succes: null });
        const u = new Utilizator({ username, nume, prenume, email, parola, culoare_chat: culoare_chat || '#1d3557' });
        u.salvareUtilizator();
        res.render('pagini/inregistrare', {
            eroare: null,
            succes: `Cont creat! Verificați emailul ${email} pentru a confirma contul.`
        });
    });
});

app.post('/login', (req, res) => {
    if (req.session?.utilizator) return res.redirect('/');
    const { username, parola } = req.body;
    Utilizator.getUtilizDupaUsername(username, {}, (utilizator, _ob, eroare) => {
        if (eroare || !utilizator || utilizator.parola !== Utilizator.criptareParola(parola)) {
            req.session.mesajLogin = 'Username sau parolă incorectă.';
            return res.redirect('/');
        }
        if (!utilizator.confirmat_mail) {
            req.session.mesajLogin = 'Contul nu a fost confirmat. Verificați emailul.';
            return res.redirect('/');
        }
        req.session.utilizator = utilizator;
        res.redirect('/');
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

app.get('/cod/:username/:token', (req, res) => {
    const { username, token } = req.params;
    Utilizator.getUtilizDupaUsername(username, {}, (utilizator, _ob, eroare) => {
        if (eroare || !utilizator)
            return res.render('pagini/confirmare', { mesaj: 'Utilizatorul nu a fost găsit.' });
        if (utilizator.confirmat_mail)
            return res.render('pagini/confirmare', { mesaj: 'Contul este deja confirmat. Puteți să vă autentificați.' });
        if (utilizator.cod !== token)
            return res.render('pagini/confirmare', { mesaj: 'Token de confirmare invalid.' });
        AccesBD.getInstanta().update({
            tabel: 'utilizatori',
            campuri: { confirmat_mail: true, cod: null },
            conditiiAnd: [`id=${utilizator.id}`]
        }, (err) => {
            res.render('pagini/confirmare', {
                mesaj: err
                    ? 'Eroare la confirmarea contului. Încercați din nou.'
                    : 'Contul a fost confirmat cu succes! Vă puteți autentifica.'
            });
        });
    });
});

app.get('/profil', (req, res) => {
    if (!req.utilizator) return res.redirect('/');
    res.render('pagini/profil', { eroare: null, succes: null });
});

app.post('/profil', (req, res) => {
    if (!req.utilizator) return res.redirect('/');
    const form = new formidable.IncomingForm({
        uploadDir: path.join(__dirname, 'poze_uploadate'),
        keepExtensions: true,
        maxFileSize: 5 * 1024 * 1024
    });
    form.parse(req, (err, fields, files) => {
        if (err) return res.render('pagini/profil', { eroare: 'Eroare la procesarea formularului.', succes: null });
        const u = req.utilizator;
        const get = (f) => (Array.isArray(fields[f]) ? fields[f][0] : fields[f]) || '';
        try {
            if (get('nume'))         u.setareNume    = get('nume');
            if (get('prenume'))      u.prenume       = get('prenume');
            if (get('email'))        u.email         = get('email');
            if (get('culoare_chat')) u.culoare_chat  = get('culoare_chat');
        } catch (e) {
            return res.render('pagini/profil', { eroare: e.message, succes: null });
        }
        const pozaFile = Array.isArray(files.poza) ? files.poza[0] : files.poza;
        if (pozaFile && pozaFile.size > 0)
            u.poza = path.basename(pozaFile.filepath || pozaFile.path || '');
        u.modifica();
        req.session.utilizator = u;
        res.render('pagini/profil', { eroare: null, succes: 'Profil actualizat cu succes!' });
    });
});

app.get('/useri', (req, res) => {
    if (!req.utilizator || !req.utilizator.areDreptul(Drepturi.vizualizareUtilizatori))
        return afisareEroare(res, 403);
    AccesBD.getInstanta().select({ tabel: 'utilizatori', orderBy: 'id' }, (err, rez) => {
        const utilizatori = (err || !rez) ? [] : rez.rows.map(r => new Utilizator(r));
        res.render('pagini/useri', { utilizatori });
    });
});

app.post('/sterge_utiliz', (req, res) => {
    if (!req.utilizator || !req.utilizator.areDreptul(Drepturi.stergereUtilizatori))
        return afisareEroare(res, 403);
    const id = parseInt(req.body.id);
    if (!isNaN(id) && id !== req.utilizator.id) {
        const u = new Utilizator({ id });
        u.sterge();
    }
    res.redirect('/useri');
});

// ─── Ruta generica + 404 ─────────────────────────────────────────────────────
app.get("/eroare", (req, res) => {
    afisareEroare(res, 404, "Eroare 404", "Pagina nu a fost găsită");
});

app.get("/favicon.ico", (req, res) => {
    res.sendFile(path.join(__dirname, "resurse/ico/favicon.ico"));
});

app.use((req, res, next) => {
    if (req.url.endsWith(".ejs")) {
        afisareEroare(res, 400);
        return;
    }
    next();
});

app.get("/:pagina", (req, res) => {
    const pagina = req.params.pagina;
    res.render(`pagini/${pagina}`, {}, (err, html) => {
        if (err) {
            if (err.message && err.message.startsWith("Failed to lookup view")) {
                afisareEroare(res, 404);
            } else {
                afisareEroare(res, 500);
            }
        } else {
            res.send(html);
        }
    });
});

app.use((req, res) => {
    if (req.url.startsWith("/resurse") && path.extname(req.url) === "") {
        afisareEroare(res, 403);
        return;
    }
    afisareEroare(res, 404);
});

// ─── Pornire server ───────────────────────────────────────────────────────────
const PORT_BAZA = 8080;

/**
 * Pornește serverul Express pe {@link PORT_BAZA} și afișează la consolă
 * informații despre directoarele de lucru.
 * @returns {void}
 */
function pornesteServer() {
    app.listen(PORT_BAZA, () => {
        console.log("Folder index.js (__dirname)", __dirname);
        console.log("Fisier index.js (__filename)", __filename);
        console.log("Folder curent de lucru (process.cwd())", process.cwd());
        console.log(`Serverul a pornit pe portul ${PORT_BAZA}!`);
    });
}

/**
 * Inițializează conexiunile la baza de date: instanțiază {@link AccesBD} Singleton
 * și conectează clientul `pg` principal. Încarcă în {@link obGlobal.categorii}
 * valorile enum `categ_piesa` din PostgreSQL.
 * @async
 * @returns {Promise<void>}
 * @throws {Error} Dacă conexiunea la BD eșuează
 */
async function initDB() {
    AccesBD.getInstanta({ database: 'cti_2026', user: 'frumu', password: 'frumu', host: 'localhost', port: 5432 });
    await client.connect();
    const rez = await client.query(
        "SELECT unnest FROM unnest(enum_range(null::categ_piesa)) AS unnest"
    );
    obGlobal.categorii = rez.rows.map(r => r.unnest);
    console.log("Categorii încărcate din DB:", obGlobal.categorii);

    // Bonus 12: Pornire oferte automate
    genereazaOferta();
    setInterval(genereazaOferta, T_OFERTA_SEC * 1000);
    setInterval(stergeOfertaVechi, T_CLEANUP_MIN * 60 * 1000);
}

verificaErori();
initErori();
verificaGalerie();
compileazaToateScss();

initDB()
    .then(() => pornesteServer())
    .catch(err => {
        console.error("Eroare la conectarea la baza de date:", err.message);
        console.warn("Serverul porneste fara conexiune la BD - rutele /produse nu vor functiona.");
        pornesteServer();
    });
