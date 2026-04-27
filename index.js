const express = require("express");
const path = require("path");
const fs = require("fs");
const sass = require("sass");
const ejs = require("ejs");
const sharp = require("sharp");

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const obGlobal = {
    obErori: null,
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

function caleWeb(...segmente) {
    return segmente.join("/").replace(/\\/g, "/").replace(/\/+/g, "/");
}

// Middleware pentru redimensionare automată a imaginilor galeriei
app.get('/resurse/imagini/galerie/:fisier_imagine', async (req, res) => {
    const { fisier_imagine } = req.params;
    const latime = req.query.w ? parseInt(req.query.w) : null;
    
    const caleOriginal = path.join(__dirname, 'resurse/imagini/galerie', fisier_imagine);
    
    if (!fs.existsSync(caleOriginal)) {
        return res.status(404).send('Imagine not found');
    }
    
    if (!latime) {
        // Servire imagine originală
        return res.sendFile(caleOriginal);
    }
    
    // Generare și servire imagine redimensionată
    const ext = path.extname(fisier_imagine);
    const numeFisare = path.basename(fisier_imagine, ext);
    const caleRedimensionata = path.join(__dirname, 'resurse/imagini/galerie', `${numeFisare}_${latime}w${ext}`);
    
    try {
        // Dacă imaginea redimensionată nu există, o generez
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

app.get(["/resurse", "/resurse/"], (req, res) => {
    afisareEroare(res, 403);
});

app.use("/resurse", express.static(path.join(__dirname, "resurse")));
app.use(express.static(__dirname, { index: false }));

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
    const imagineFinala = imagine || eroare?.imagine || errDefault.imagine;
    res.status(statusCode).send(`
        <!doctype html>
        <html lang="ro">
        <head><meta charset="utf-8"><title>${titlu || eroare?.titlu || errDefault.titlu}</title></head>
        <body style="font-family: Arial, sans-serif; margin: 2rem;">
            <h1>${titlu || eroare?.titlu || errDefault.titlu}</h1>
            <p>${text || eroare?.text || errDefault.text}</p>
            ${imagineFinala ? `<img src="${imagineFinala}" alt="Imagine eroare" style="max-width: 360px; width: 100%; height: auto; border-radius: 8px; border: 1px solid #ddd;">` : ""}
        </body>
        </html>
    `);
}

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
    if (!fs.existsSync(obGlobal.folderScss)) {
        return;
    }

    const vFisiere = fs.readdirSync(obGlobal.folderScss);
    for (const numeFis of vFisiere) {
        if (path.extname(numeFis) === ".scss") {
            const caleScss = path.join(obGlobal.folderScss, numeFis);
            compileazaScss(caleScss);
        }
    }

    fs.watch(obGlobal.folderScss, (eveniment, numeFis) => {
        if (!numeFis || (eveniment !== "change" && eveniment !== "rename")) {
            return;
        }
        const caleCompleta = path.join(obGlobal.folderScss, numeFis);
        if (fs.existsSync(caleCompleta) && path.extname(caleCompleta) === ".scss") {
            compileazaScss(caleCompleta);
        }
    });
}

initErori();
verificaGalerie();
compileazaToateScss();

// Funcție pentru a citi și parsea JSON cu produsele
function incarcaProduse() {
    try {
        const caleFisier = path.join(__dirname, "resurse/json/produse.json");
        if (fs.existsSync(caleFisier)) {
            const continut = fs.readFileSync(caleFisier, "utf-8");
            const dateParsate = JSON.parse(continut);
            return dateParsate.produse || [];
        }
    } catch (err) {
        console.error("Eroare la încărcarea produselor:", err.message);
    }
    return [];
}

// Funcție pentru a citi și parsea JSON cu galeria
function incarcaGalerie() {
    try {
        const caleFisier = path.join(__dirname, "resurse/json/galerie.json");
        if (fs.existsSync(caleFisier)) {
            const continut = fs.readFileSync(caleFisier, "utf-8");
            return JSON.parse(continut);
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
        const continut = fs.readFileSync(caleFisier, "utf-8");
        dateGalerie = JSON.parse(continut);
    } catch (err) {
        console.error("[Galerie] Eroare la parsarea galerie.json:", err.message);
        return;
    }

    const caleGalerie = dateGalerie?.cale_galerie;
    const caleGalerieAbs = caleGalerie
        ? path.join(__dirname, caleGalerie)
        : null;

    if (!caleGalerieAbs || !fs.existsSync(caleGalerieAbs)) {
        console.error(
            "[Galerie] Folderul din 'cale_galerie' nu există:",
            caleGalerieAbs || "(cale_galerie lipsă)"
        );
    }

    const imagini = Array.isArray(dateGalerie?.imagini) ? dateGalerie.imagini : [];
    for (const imagine of imagini) {
        const numeFisier = imagine?.fisier_imagine;
        if (!numeFisier) {
            console.error("[Galerie] Intrare imagine fără 'fisier_imagine':", imagine);
            continue;
        }
        const caleImagineAbs = caleGalerieAbs
            ? path.join(caleGalerieAbs, numeFisier)
            : null;

        if (!caleImagineAbs || !fs.existsSync(caleImagineAbs)) {
            console.error(
                `[Galerie] Fișierul de imagine nu există: ${numeFisier} (cale: ${caleImagineAbs || "(necunoscută)"})`
            );
        }
    }
}

// Mapare zile săptămânii
const zileLaSaptamana = {
    0: "duminică",
    1: "luni",
    2: "marți",
    3: "miercuri",
    4: "joi",
    5: "vineri",
    6: "sâmbată"
};

const indexZile = {
    "duminică": 0,
    "luni": 1,
    "marți": 2,
    "miercuri": 3,
    "joi": 4,
    "vineri": 5,
    "sâmbată": 6
};

// Funcție pentru a verifica dacă o imagine trebuie afișată astazi
function esteImagineAstazi(imagini, dataTest = null) {
    const data = dataTest || new Date();
    const zilaCurenta = zileLaSaptamana[data.getDay()];
    const indexZilaCurenta = data.getDay();

    return imagini.filter(img => {
        return img.intervale_zile.some(interval => {
            const indexStart = indexZile[interval[0].toLowerCase()];
            const indexEnd = indexZile[interval[1].toLowerCase()];
            
            if (indexStart <= indexEnd) {
                // Interval normal (ex: luni-miercuri)
                return indexZilaCurenta >= indexStart && indexZilaCurenta <= indexEnd;
            } else {
                // Interval care trece peste weekend (ex: vineri-luni)
                return indexZilaCurenta >= indexStart || indexZilaCurenta <= indexEnd;
            }
        });
    });
}

// Funcție pentru a genera imagini redimensionate
async function genereazaImageniRedimensionate(caleImagine, latime) {
    const dir = path.dirname(caleImagine);
    const ext = path.extname(caleImagine);
    const numeFisSanzDeExt = path.basename(caleImagine, ext);
    
    const caleImageneRedimensionata = path.join(dir, `${numeFisSanzDeExt}_${latime}w${ext}`);
    
    if (!fs.existsSync(caleImageneRedimensionata)) {
        try {
            await sharp(caleImagine)
                .resize(latime, Math.round(latime * 1.25), { fit: 'cover' })
                .toFile(caleImageneRedimensionata);
        } catch (err) {
            console.error(`Eroare la redimensionarea ${caleImagine}:`, err.message);
        }
    }
    
    return caleImageneRedimensionata;
}

app.get(["/", "/index", "/home"], (req, res) => {
    const produse = incarcaProduse();
    const dataTest = req.query.data ? new Date(req.query.data) : null;
    const dataDeTestare = dataTest || new Date();
    
    const galerie = incarcaGalerie();
    let imaginiAstazi = esteImagineAstazi(galerie.imagini, dataDeTestare);
    
    // Trunchiere la număr par pentru a menține forma zig-zag
    if (imaginiAstazi.length % 2 !== 0) {
        imaginiAstazi = imaginiAstazi.slice(0, imaginiAstazi.length - 1);
    }
    
    res.render("index", { 
        produse,
        galerie: {
            cale_galerie: galerie.cale_galerie,
            imagini: imaginiAstazi
        },
        dataAstazi: dataDeTestare,
        ip: req.ip
    });
});

app.get(["/galerie"], (req, res) => {
    const dataTest = req.query.data ? new Date(req.query.data) : null;
    const dataDeTestare = dataTest || new Date();
    
    const galerie = incarcaGalerie();
    let imaginiAstazi = esteImagineAstazi(galerie.imagini, dataDeTestare);
    
    // Trunchiere la număr par pentru a menține forma zig-zag
    if (imaginiAstazi.length % 2 !== 0) {
        imaginiAstazi = imaginiAstazi.slice(0, imaginiAstazi.length - 1);
    }
    
    res.render("pagini/galerie", { 
        galerie: {
            cale_galerie: galerie.cale_galerie,
            imagini: imaginiAstazi
        },
        dataAstazi: dataDeTestare,
        ip: req.ip
    });
});

app.get("/eroare", (req, res) => {
    afisareEroare(res, 404, "Eroare 404", "Pagina nu a fost găsită");
});

app.get("/favicon.ico", (req, res) => {
    res.sendFile(path.join(__dirname, "resurse/ico/favicon.ico"));
});

app.use((req, res) => {
    if (req.url.startsWith("/resurse") && path.extname(req.url) === "") {
        afisareEroare(res, 403);
        return;
    }

    if (req.url.endsWith(".ejs")) {
        afisareEroare(res, 400);
        return;
    }

    afisareEroare(res, 404);
});

const PORT_BAZA = Number(process.env.PORT) || 5000;
const MAX_INCERCARI_PORT = 20;

function pornesteServer(portCurent, incercare = 0) {
    const server = app.listen(portCurent, () => {
        console.log("Folder index.js", __dirname);
        console.log("Folder curent (de lucru)", process.cwd());
        console.log("Cale fisier", __filename);
        console.log(`Serverul a pornit pe portul ${portCurent}!`);
    });

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE" && incercare < MAX_INCERCARI_PORT) {
            const portUrmator = portCurent + 1;
            console.warn(`Portul ${portCurent} este ocupat. Încerc pe ${portUrmator}...`);
            setTimeout(() => pornesteServer(portUrmator, incercare + 1), 100);
            return;
        }

        if (err.code === "EADDRINUSE") {
            console.error(`Nu am găsit port liber în intervalul ${PORT_BAZA}-${PORT_BAZA + MAX_INCERCARI_PORT}.`);
            process.exit(1);
        }

        throw err;
    });
}

pornesteServer(PORT_BAZA);

// Test comentariu commit pls work