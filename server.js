const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// === MIDDLEWARE ===
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname))); // Sert les fichiers HTML, CSS, JS

// === Redirection vers la page d’inscription par défaut ===
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "inscription.html"));
});

// === BASE DE DONNÉES ===
const db = new sqlite3.Database('users.db');
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        email TEXT UNIQUE,
        password TEXT
    )
`);

// === ROUTE D'INSCRIPTION ===
app.post('/register', (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: "Champs manquants" });
    }

    db.run(
        `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
        [username, email, password],
        function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: "Erreur lors de l'inscription." });
            }

            return res.json({ success: true, message: "Inscription réussie." });
        }
    );
});

// === ROUTE DE CONNEXION ===
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Champs manquants" });
    }

    db.get(
        `SELECT * FROM users WHERE email = ? AND password = ?`,
        [email, password],
        (err, row) => {
            if (err) {
                return res.status(500).json({ success: false, message: "Erreur serveur." });
            }

            if (row) {
                return res.json({ success: true, message: "Connexion réussie." });
            } else {
                return res.status(401).json({ success: false, message: "Identifiants incorrects." });
            }
        }
    );
});

// === DÉMARRAGE DU SERVEUR ===
app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});
