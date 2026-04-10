const express = require("express");
const path = require("path");
const fs = require("fs");
const sass = require("sass");

const app = express();

const obGlobal = {
    obErori: null,
    folderCss: path.join(__dirname, "resurse/css"),
    folderBackup: path.join(__dirname, "backup"),
    foldereScss: [
        path.join(__dirname, "resurse/scss"),
        path.join(__dirname, "resurse/css")
    ]
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

app.get(["/resurse", "/resurse/"], (req, res) => {
    afisareEroare(res, 403);
});

app.use("/resurse", express.static(path.join(__dirname, "resurse")));
app.use(express.static(__dirname));

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
        const numeFisExt = path.basename(caleScss);
        const numeFis = numeFisExt.split(".")[0];
        caleCss = `${numeFis}.css`;
    }

    if (!path.isAbsolute(caleScss)) {
        caleScss = path.resolve(caleScss);
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
        fs.copyFileSync(caleCss, path.join(caleBackup, numeFisCss));
    }

    const rez = sass.compile(caleScss, { sourceMap: true });
    fs.writeFileSync(caleCss, rez.css);
}

function compileazaToateScss() {
    for (const folderScss of obGlobal.foldereScss) {
        if (!fs.existsSync(folderScss)) {
            continue;
        }
        const vFisiere = fs.readdirSync(folderScss);
        for (const numeFis of vFisiere) {
            if (path.extname(numeFis) === ".scss") {
                const caleScss = path.join(folderScss, numeFis);
                compileazaScss(caleScss);
            }
        }

        fs.watch(folderScss, (eveniment, numeFis) => {
            if (!numeFis || (eveniment !== "change" && eveniment !== "rename")) {
                return;
            }
            const caleCompleta = path.join(folderScss, numeFis);
            if (fs.existsSync(caleCompleta) && path.extname(caleCompleta) === ".scss") {
                compileazaScss(caleCompleta);
            }
        });
    }
}

initErori();
compileazaToateScss();

app.get(["/", "/index", "/home"], (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
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