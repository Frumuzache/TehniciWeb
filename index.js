const express = require("express");
const path = require("path");
const fs = require("fs");
const sass = require("sass");
const ejs = require("ejs");
const sharp = require("sharp");
const pg = require("pg");

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

const vectFoldere = ["temp", "backup", "logs", "fisiere_uploadate"];
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

// ─── Helper URL ───────────────────────────────────────────────────────────────
function caleWeb(...segmente) {
    return segmente.join("/").replace(/\\/g, "/").replace(/\/+/g, "/");
}

// ─── Helper formatare data in romana ─────────────────────────────────────────
const LUNI_RO = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie',
                 'Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
const ZILE_RO = ['Duminică','Luni','Marți','Miercuri','Joi','Vineri','Sâmbătă'];

function formatDataRo(data) {
    const d = new Date(data);
    return `${d.getDate()}-${LUNI_RO[d.getMonth()]}-${d.getFullYear()} [${ZILE_RO[d.getDay()]}]`;
}

// ─── Middleware: injecteaza in locals categorii, ip si helper date ────────────
app.use((req, res, next) => {
    res.locals.categorii = obGlobal.categorii;
    res.locals.ip = req.ip;
    res.locals.formatDataRo = formatDataRo;
    next();
});

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
app.use(express.static(__dirname, { index: false }));

// ─── Erori ───────────────────────────────────────────────────────────────────
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
        const rez = await client.query("SELECT * FROM piese WHERE id = $1", [id]);
        if (rez.rowCount === 0) {
            afisareEroare(res, 404, "Produs inexistent", `Nu există niciun produs cu id-ul ${id}.`);
            return;
        }
        res.render("pagini/produs", { produs: rez.rows[0], ip: req.ip });
    } catch (err) {
        console.error("Eroare la /produs/:id:", err.message);
        afisareEroare(res, 500, "Eroare baza de date", "Nu s-au putut încărca datele produsului.");
    }
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

function pornesteServer() {
    app.listen(PORT_BAZA, () => {
        console.log("Folder index.js (__dirname)", __dirname);
        console.log("Fisier index.js (__filename)", __filename);
        console.log("Folder curent de lucru (process.cwd())", process.cwd());
        console.log(`Serverul a pornit pe portul ${PORT_BAZA}!`);
    });
}

async function initDB() {
    await client.connect();
    const rez = await client.query(
        "SELECT unnest FROM unnest(enum_range(null::categ_piesa)) AS unnest"
    );
    obGlobal.categorii = rez.rows.map(r => r.unnest);
    console.log("Categorii încărcate din DB:", obGlobal.categorii);
}

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
