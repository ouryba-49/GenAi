// server.js
// Backend Showroom AI — Express + SQLite + Sécurité + OpenAI
// Dépendances à installer :
// npm i express sqlite3 bcrypt helmet express-rate-limit cors cookie-parser dotenv axios nodemailer
console.log(">>> SERVER.JS CHARGÉ :", __filename);
require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const axios = require("axios");
const nodemailer = require("nodemailer");
const sgMail = require('@sendgrid/mail');
const Stripe = require("stripe");
const FormData = require("form-data");
const multer = require("multer");

// ---------- Config de base ----------
const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const STABILITY_API_KEY = process.env.STABILITY_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || null;
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const upload = multer({
  dest: path.join(__dirname, "uploads"),
});

const SUBSCRIPTION_PLANS = {
  basic_monthly: {
    price: 990,
    currency: "EUR",
    interval: "month",
    name: "Showroom AI Basic",
  },
  pro_monthly: {
    price: 1990,
    currency: "EUR",
    interval: "month",
    name: "Showroom AI Pro",
  },
};

if (!STRIPE_SECRET_KEY) {
  console.warn(">>> ATTENTION: STRIPE_SECRET_KEY manquant. Les routes d'abonnement seront indisponibles.");
}

function formatPlanDisplay(planKey) {
  const plan = SUBSCRIPTION_PLANS[planKey];
  if (!plan) return planKey || "Plan Showroom AI";
  const price = (plan.price / 100).toFixed(2).replace(".", ",");
  const interval = plan.interval === "month" ? "mois" : plan.interval;
  return `${plan.name} - ${price} ${plan.currency.toUpperCase()}/${interval}`;
}

// ---------- Config email Nodemailer ----------
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASSWORD,
  },
});

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'ibrahbalde41926@gmail.com';
if (SENDGRID_API_KEY) sgMail.setApiKey(SENDGRID_API_KEY);

function sendEmail({ to, subject, html }) {
  const canUseSendGrid = Boolean(SENDGRID_API_KEY);
  const canUseSmtpFallback = Boolean(EMAIL_USER && EMAIL_PASSWORD);

  if (!canUseSendGrid && !canUseSmtpFallback) {
    const err = "Aucune configuration email valide (SendGrid ou SMTP).";
    console.error(err);
    return Promise.reject(new Error(err));
  }

  if (canUseSendGrid) {
    return sgMail
      .send({
        to,
        from: SENDGRID_FROM_EMAIL,
        subject,
        html,
      })
      .then((result) => {
        const response = Array.isArray(result) ? result[0] : result;
        const statusCode = response?.statusCode || null;
        const messageId = response?.headers?.["x-message-id"] || null;
        console.log("SENDGRID OK:", { to, statusCode, messageId });
        return result;
      })
      .catch((err) => {
        const status = err?.code || err?.response?.statusCode;
        const body = err?.response?.body;
        console.error("SENDGRID ERROR:", { status, body, message: err?.message });

        // Fallback SMTP si SendGrid echoue (ex: sender non verifie, cle invalide)
        if (canUseSmtpFallback) {
          console.warn("Fallback SMTP active via Nodemailer.");
          return transporter.sendMail({
            from: EMAIL_USER,
            to,
            subject,
            html,
          });
        }
        throw err;
      });
  }

  return transporter.sendMail({
    from: EMAIL_USER,
    to,
    subject,
    html,
  });
}

// ---------- Middlewares de sécurité ----------
app.use(helmet({
  contentSecurityPolicy: false, // désactivé si HTML/CSS/JS statiques sans nonce
}));
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());

// ---------- Parsers ----------
// Ce code configure Express pour parser le JSON partout sauf sur la route /webhook/stripe,
// afin de laisser Stripe recevoir le corps brut nécessaire à la vérification de signature,
// puis active aussi le parsing des données envoyées par formulaires HTML.

const jsonParser = express.json({ limit: "10mb" });

app.use((req, res, next) => {
  if (req.originalUrl && req.originalUrl.startsWith("/webhook/stripe")) {
    return next();
  }
  return jsonParser(req, res, next);
});

app.use(express.urlencoded({ extended: true }));








// ---------- Fichiers statiques (frontend) ----------
// Tout ce qui est dans mon dossier public sera accessible direment sur le serveur
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR, { index: false }));

// ---------- Page par défaut ----------
// Pour atterrir sur la page d’inscription par défaut :
app.get("/", (req, res) => {
  const homePath = path.join(PUBLIC_DIR, "home.html");
  const fallbackSignup = path.join(PUBLIC_DIR, "inscription.html");
  res.sendFile(homePath, (err) => {
    if (err) res.sendFile(fallbackSignup);
  });
});

// ---------- Base de données ----------
const db = new sqlite3.Database(path.join(__dirname, "users.db"));

function ensurePromptHistoryTable() {
  return new Promise((resolve, reject) => {
    db.run(
      `
        CREATE TABLE IF NOT EXISTS prompt_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          prompt TEXT NOT NULL,
          response TEXT,
          image_url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `,
      (err) => {
        if (err) {
          console.error("PROMPT HISTORY TABLE ERROR:", err);
          return reject(err);
        }
        resolve();
      }
    );
  });
}

function ensurePromptHistoryColumns() {
  return new Promise((resolve, reject) => {
    db.all("PRAGMA table_info(prompt_history);", (err, rows) => {
      if (err) return reject(err);
      const columnNames = (rows || []).map((row) => row.name);
      if (columnNames.includes("image_url")) {
        return resolve();
      }
      db.run(`ALTER TABLE prompt_history ADD COLUMN image_url TEXT`, (alterErr) => {
        if (alterErr) return reject(alterErr);
        resolve();
      });
    });
  });
}

db.serialize(() => {
  // Créer la table si elle n'existe pas
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      profile_picture_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error("Erreur création table:", err);
  });
  ensurePromptHistoryTable()
    .then(() => ensurePromptHistoryColumns())
    .catch(() => { });

  // Migration : ajouter les colonnes si elles n'existent pas (pour les tables existantes)
  setTimeout(() => {
    db.all("PRAGMA table_info(users);", (err, rows) => {
      if (err) {
        console.error("Erreur vérification schéma:", err);
        return;
      }

      if (!rows) {
        console.log("⚠️ Table users introuvable");
        return;
      }

      const columnNames = rows.map(row => row.name);
      const columnsToAdd = [
        { name: "phone", type: "TEXT" },
        { name: "address", type: "TEXT" },
        { name: "profile_picture_url", type: "TEXT" },
        { name: "subscription_status", type: "TEXT DEFAULT 'inactive'" },
        { name: "subscription_plan", type: "TEXT" },
        { name: "subscription_started_at", type: "DATETIME" },
        { name: "subscription_renews_at", type: "DATETIME" },
        { name: "subscription_canceled_at", type: "DATETIME" },
        { name: "subscription_provider", type: "TEXT" },
        { name: "subscription_provider_id", type: "TEXT" }
      ];

      columnsToAdd.forEach(col => {
        if (!columnNames.includes(col.name)) {
          db.run(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`, (err) => {
            if (err) {
              console.error(`Erreur ajout colonne ${col.name}:`, err);
            } else {
              console.log(`✅ Colonne '${col.name}' ajoutée`);
            }
          });
        }
      });
    });
  }, 500);
});

// ---------- Rate limits (anti-bruteforce basique) ----------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

const gptLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------- Helpers ----------
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").toLowerCase());
}

function getUserById(userId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function updateUserSubscription(userId, fields = {}) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (!entries.length) {
    return Promise.resolve(false);
  }
  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([, value]) => value);
  values.push(userId);
  return new Promise((resolve, reject) => {
    db.run(`UPDATE users SET ${assignments} WHERE id = ?`, values, function (err) {
      if (err) return reject(err);
      resolve(this.changes > 0);
    });
  });
}

function epochToISOString(epochSeconds) {
  if (!epochSeconds) return null;
  return new Date(epochSeconds * 1000).toISOString();
}

function getPlanConfig(planKey) {
  if (!planKey) return null;
  return SUBSCRIPTION_PLANS[planKey] || null;
}

function decodeBase64Image(dataUrl) {
  if (!dataUrl) return null;
  const matches = String(dataUrl).match(/^data:(.*);base64,(.+)$/);
  const base64Data = matches ? matches[2] : dataUrl;
  try {
    return Buffer.from(base64Data, "base64");
  } catch (err) {
    return null;
  }
}

async function persistStripeSubscription({ userId, planKey, subscription }) {
  if (!userId || !subscription) return;
  const resolvedPlan = planKey || subscription.metadata?.plan || null;
  const status = subscription.status || "active";
  await updateUserSubscription(userId, {
    subscription_status: status,
    subscription_plan: resolvedPlan,
    subscription_started_at: epochToISOString(subscription.start_date),
    subscription_renews_at: epochToISOString(subscription.current_period_end),
    subscription_canceled_at: epochToISOString(subscription.canceled_at),
    subscription_provider: "stripe",
    subscription_provider_id: subscription.id,
  });
}

function normalizeUserId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractSubscriptionFromRow(row = {}) {
  return {
    status: row.subscription_status || "inactive",
    plan: row.subscription_plan || null,
    started_at: row.subscription_started_at || null,
    renews_at: row.subscription_renews_at || null,
    canceled_at: row.subscription_canceled_at || null,
    provider: row.subscription_provider || null,
    provider_id: row.subscription_provider_id || null,
  };
}

async function handleStripeCheckoutSession(session) {
  if (!stripe || !session || session.mode !== "subscription") return;
  const userId = normalizeUserId(session.metadata?.userId);
  if (!userId) return;
  const planKey = session.metadata?.plan || null;
  let subscription = session.subscription;
  if (!subscription) return;
  if (typeof subscription === "string") {
    subscription = await stripe.subscriptions.retrieve(subscription);
  }
  await persistStripeSubscription({ userId, planKey, subscription });
}

async function handleStripeSubscriptionEvent(subscriptionObj) {
  if (!subscriptionObj) return;
  const userId = normalizeUserId(subscriptionObj.metadata?.userId);
  if (!userId) return;
  const planKey = subscriptionObj.metadata?.plan || null;
  await persistStripeSubscription({ userId, planKey, subscription: subscriptionObj });
}

async function dispatchStripeEvent(event) {
  if (!event) return;
  switch (event.type) {
    case "checkout.session.completed":
      await handleStripeCheckoutSession(event.data?.object);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleStripeSubscriptionEvent(event.data?.object);
      break;
    default:
      break;
  }
}

// ---------- Routes d’auth ----------

// Inscription
app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "Champs manquants." });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Adresse e-mail invalide." });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Mot de passe trop court (min. 6 caractères)." });
    }

    const password_hash = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
      [username.trim(), email.trim().toLowerCase(), password_hash],
      function (err) {
        if (err) {
          const msg = /UNIQUE/i.test(String(err)) ? "Email déjà utilisé." : "Erreur lors de l'inscription.";
          return res.status(400).json({ success: false, message: msg });
        }
        // Envoi email de bienvenue (asynchrone, non bloquant)
        sendEmail({
          to: email.trim().toLowerCase(),
          subject: "Bienvenue sur Showroom AI !",
          html: `<h2>Bienvenue, ${username} !</h2><p>Votre profil a bien été créé sur <b>Showroom AI</b>.<br>Vous pouvez maintenant vous connecter et profiter de nos services.<br><br>À bientôt !<br>L'équipe Showroom AI</p>`
        }).catch(e => console.error("Erreur envoi email:", e));
        return res.json({ success: true, message: "Inscription réussie." });
      }
    );
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    return res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// Test d'envoi email (diagnostic SendGrid/SMTP)
app.post("/email/test", async (req, res) => {
  try {
    const { to } = req.body || {};
    if (!to || !isValidEmail(to)) {
      return res.status(400).json({ success: false, message: "Adresse email de destination invalide." });
    }

    await sendEmail({
      to,
      subject: "Test email Showroom AI",
      html: `<p>Test d'envoi email depuis Showroom AI.</p><p>Si vous recevez ce message, la configuration email fonctionne.</p>`,
    });

    return res.json({ success: true, message: "Email de test envoye." });
  } catch (err) {
    const detail = err?.response?.body || err?.message || err;
    console.error("EMAIL TEST ERROR:", detail);
    return res.status(502).json({
      success: false,
      message: "Echec d'envoi de l'email de test.",
      detail,
    });
  }
});

// Connexion
app.post("/login", loginLimiter, (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Champs manquants." });
    }

    db.get(
      `SELECT id, username, email, password_hash,
              subscription_status, subscription_plan, subscription_started_at,
              subscription_renews_at, subscription_canceled_at,
              subscription_provider, subscription_provider_id
       FROM users WHERE email = ?`,
      [email.trim().toLowerCase()],
      async (err, row) => {
        if (err) {
          console.error("LOGIN DB ERROR:", err);
          return res.status(500).json({ success: false, message: "Erreur serveur." });
        }
        if (!row) {
          return res.status(401).json({ success: false, message: "Identifiants incorrects." });
        }

        const ok = await bcrypt.compare(password, row.password_hash);
        if (!ok) {
          return res.status(401).json({ success: false, message: "Identifiants incorrects." });
        }

        // Ici, on  émet un cookie de session/JWT si besoin.
        return res.json({
          success: true,
          message: "Connexion réussie.",
          user: {
            id: row.id,
            username: row.username,
            email: row.email,
            subscription: extractSubscriptionFromRow(row),
          },
        });
      }
    );
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// ---------- Route GPT (validation / reformulation) ----------
app.post(["/reformulate", "/gpt-generate"], gptLimiter, async (req, res) => {
  try {
    const { prompt, userId: bodyUserId } = req.body || {};
    const userId = bodyUserId || req.query.userId || req.headers["x-user-id"];

    if (!prompt) {
      return res.status(400).json({ success: false, message: "Prompt manquant." });
    }
    if (!userId) {
      return res.status(400).json({ success: false, message: "ID utilisateur manquant." });
    }
    const normalizedUserId = Number.parseInt(userId, 10);
    if (!Number.isFinite(normalizedUserId)) {
      return res.status(400).json({ success: false, message: "ID utilisateur invalide." });
    }
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ success: false, message: "Clé OpenAI manquante côté serveur." });
    }

    try {
      await ensurePromptHistoryTable();
    } catch (tableErr) {
      console.error("PROMPT HISTORY INIT ERROR:", tableErr);
    }

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        // Choisis un modèle récent dispo pour ton compte
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Tu es un assistant de reformulation stricte. Reformule uniquement la demande de l'utilisateur de facon claire et fidele, sans ajouter d'informations, sans suggestions, sans enrichissement, sans elements visuels supplementaires, et sans questions ouvertes. Utilise seulement le contenu fourni. Termine toujours par : Est-ce bien cela ?" },
          { role: "user", content: String(prompt) }
        ],
        temperature: 0,
        max_tokens: 250
      },
      {
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        timeout: 15000
      }
    );

    const message = response?.data?.choices?.[0]?.message?.content?.trim();
    if (!message) {
      return res.status(502).json({ success: false, message: "Réponse vide du moteur." });
    }

    const historyId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO prompt_history (user_id, prompt, response) VALUES (?, ?, ?)`,
        [normalizedUserId, String(prompt), message],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID || null);
        }
      );
    });

    return res.json({ success: true, message, historyId });
  } catch (err) {
    // Log utile côté serveur
    const apiErr = err?.response?.data || err.message || err;
    console.error("OPENAI ERROR:", apiErr);
    return res.status(502).json({ success: false, message: "Erreur de communication avec le moteur." });
  }
});

// ---------- Route Stability Image (generation/modification via Stability) ----------
app.post(["/generate-image", "/image-edit"], upload.single("image"), async (req, res) => {
  try {
    const { prompt, userId, historyId, strength } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ success: false, message: "Prompt manquant." });
    }
    if (!STABILITY_API_KEY) {
      return res.status(500).json({ success: false, message: "Cle Stability manquante cote serveur." });
    }

    // Nettoyer la phrase de confirmation issue de la reformulation
    // pour ne garder que l'intention visuelle utile a la generation.
    const cleanedPrompt = String(prompt)
      .replace(/\s*Est-ce bien cela\s*\?\s*$/i, "")
      .trim();

    let stabilityPrompt = cleanedPrompt || String(prompt);
    if (OPENAI_API_KEY) {
      try {
        const translateResp = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          {
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "Translate the user prompt to natural, production-ready English for image generation. " +
                  "Keep meaning faithful, do not add ideas, return only the translated prompt.",
              },
              { role: "user", content: stabilityPrompt },
            ],
            temperature: 0,
            max_tokens: 300,
          },
          {
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
            timeout: 15000,
          }
        );
        const translated = translateResp?.data?.choices?.[0]?.message?.content?.trim();
        if (translated) stabilityPrompt = translated;
      } catch (translateErr) {
        console.error(
          "PROMPT TRANSLATION ERROR:",
          translateErr?.response?.data || translateErr?.message || translateErr
        );
      }
    }

    const form = new FormData();
    form.append("prompt", stabilityPrompt);
    form.append("output_format", "png");
    if (req.file?.path) {
      console.log("STABILITY MODE:", "image-to-image", {
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
      form.append("mode", "image-to-image");
      // Valeur par defaut plus expressive pour que le prompt influence vraiment le rendu.
      const normalizedStrength = Math.min(1, Math.max(0, Number.parseFloat(strength ?? 0.65) || 0.65));
      form.append("strength", String(normalizedStrength));
      form.append("image", fs.createReadStream(req.file.path), {
        filename: req.file.originalname || "source.png",
        contentType: req.file.mimetype || "image/png",
      });
    } else {
      console.log("STABILITY MODE:", "text-to-image");
      form.append("mode", "text-to-image");
      form.append("aspect_ratio", "9:16");
    }

    const response = await axios.post(
      "https://api.stability.ai/v2beta/stable-image/generate/sd3",
      form,
      {
        headers: {
          Authorization: `Bearer ${STABILITY_API_KEY}`,
          Accept: "image/*",
          ...form.getHeaders(),
        },
        responseType: "arraybuffer",
        timeout: 120000,
      }
    );
    console.log("STABILITY PROMPT USED:", stabilityPrompt);

    const imageBase64 = Buffer.from(response.data, "binary").toString("base64");
    const imageDataUrl = `data:image/png;base64,${imageBase64}`;

    const parsedHistoryId = Number.parseInt(historyId, 10);
    const parsedUserId = Number.parseInt(userId, 10);
    if (Number.isFinite(parsedHistoryId)) {
      db.run(
        `UPDATE prompt_history SET image_url = ? WHERE id = ? AND (? IS NULL OR user_id = ?)`,
        [imageDataUrl, parsedHistoryId, Number.isFinite(parsedUserId) ? parsedUserId : null, Number.isFinite(parsedUserId) ? parsedUserId : null],
        (err) => {
          if (err) console.error("PROMPT HISTORY IMAGE UPDATE ERROR:", err);
        }
      );
    }

    return res.json({ success: true, image: imageDataUrl, imageUrl: imageDataUrl });
  } catch (err) {
    const detail = err?.response?.data
      ? Buffer.from(err.response.data).toString("utf8")
      : err?.message || err;
    console.error("STABILITY IMAGE ERROR:", detail);
    return res.status(502).json({
      success: false,
      message: "Erreur lors de la generation de l'image.",
      detail,
    });
  } finally {
    if (req.file?.path) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error("UPLOAD TEMP CLEANUP ERROR:", unlinkErr);
      });
    }
  }
});
// ---------- Routes Abonnement (Stripe) ----------
app.post("/subscriptions/checkout", async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ success: false, message: "Stripe n'est pas configuré sur le serveur." });
  }
  try {
    const { userId, plan, successUrl, cancelUrl } = req.body || {};
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) {
      return res.status(400).json({ success: false, message: "ID utilisateur invalide." });
    }
    const planKey = plan || "basic_monthly";
    const planConfig = getPlanConfig(planKey);
    if (!planConfig) {
      return res.status(400).json({ success: false, message: "Plan d'abonnement inconnu." });
    }

    const user = await getUserById(normalizedUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Utilisateur introuvable." });
    }

    const origin = `${req.protocol}://${req.get("host")}`;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      payment_method_types: ["card"],
      allow_promotion_codes: true,
      metadata: {
        userId: String(normalizedUserId),
        plan: planKey,
      },
      subscription_data: {
        metadata: {
          userId: String(normalizedUserId),
          plan: planKey,
        },
      },
      line_items: [
        {
          price_data: {
            currency: planConfig.currency.toLowerCase(),
            unit_amount: planConfig.price,
            product_data: { name: planConfig.name },
            recurring: { interval: planConfig.interval },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl || `${origin}/profile.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${origin}/profile.html?subscription=cancelled`,
    });

    await updateUserSubscription(normalizedUserId, {
      subscription_status: "pending",
      subscription_plan: planKey,
      subscription_provider: "stripe",
    });

    return res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (err) {
    const stripeError = err?.raw?.message || err?.message || "Impossible de creer la session Stripe.";
    console.error("STRIPE CHECKOUT ERROR:", err);
    return res.status(500).json({ success: false, message: stripeError });
  }
});

app.post("/subscriptions/confirm", async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ success: false, message: "Stripe n'est pas configuré sur le serveur." });
  }
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId manquant." });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
    if (!session || session.mode !== "subscription") {
      return res.status(404).json({ success: false, message: "Session introuvable ou invalide." });
    }
    if (session.payment_status !== "paid") {
      return res.status(400).json({ success: false, message: "Paiement non confirmé." });
    }

    const normalizedUserId = normalizeUserId(session.metadata?.userId);
    if (!normalizedUserId) {
      return res.status(400).json({ success: false, message: "Utilisateur introuvable dans la session." });
    }
    const user = await getUserById(normalizedUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Utilisateur introuvable." });
    }
    let subscription = session.subscription;
    if (!subscription) {
      return res.status(400).json({ success: false, message: "Subscription Stripe absente." });
    }
    if (typeof subscription === "string") {
      subscription = await stripe.subscriptions.retrieve(subscription);
    }

    await persistStripeSubscription({
      userId: normalizedUserId,
      planKey: session.metadata?.plan || null,
      subscription,
    });

    if (user.email) {
      const planLabel = formatPlanDisplay(session.metadata?.plan || null);
      sendEmail({
        to: user.email,
        subject: "Confirmation abonnement Showroom AI",
        html: `<h2>Bonjour ${user.username || ""},</h2>
               <p>Merci d'avoir souscrit au plan <strong>${planLabel}</strong> sur <b>Showroom AI</b>.</p>
               <p>Votre abonnement est maintenant actif. Vous pourrez retrouver toutes vos informations dans votre espace client.</p>
               <p>À très vite,<br>L'équipe Showroom AI</p>`,
      }).catch((emailErr) => console.error("SUBSCRIPTION EMAIL ERROR:", emailErr));
    }

    return res.json({
      success: true,
      subscription: {
        status: subscription.status,
        plan: session.metadata?.plan || null,
        renews_at: epochToISOString(subscription.current_period_end),
        provider_id: subscription.id,
      },
    });
  } catch (err) {
    console.error("STRIPE CONFIRM ERROR:", err);
    return res.status(500).json({ success: false, message: "Impossible de confirmer la session." });
  }
});

app.post("/subscriptions/cancel", async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ success: false, message: "Stripe n'est pas configuré sur le serveur." });
  }
  try {
    const { userId } = req.body || {};
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) {
      return res.status(400).json({ success: false, message: "ID utilisateur invalide." });
    }

    const user = await getUserById(normalizedUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Utilisateur introuvable." });
    }

    const provider = String(user.subscription_provider || "").toLowerCase();
    const providerId = user.subscription_provider_id;
    if (provider !== "stripe" || !providerId) {
      return res.status(400).json({ success: false, message: "Aucun abonnement Stripe actif à résilier." });
    }

    let canceledSubscription = null;
    try {
      canceledSubscription = await stripe.subscriptions.cancel(providerId);
    } catch (stripeErr) {
      const isMissingSubscription =
        stripeErr?.code === "resource_missing" ||
        stripeErr?.raw?.code === "resource_missing" ||
        String(stripeErr?.raw?.message || stripeErr?.message || "").toLowerCase().includes("no such subscription");

      // Cas fréquent: ID enregistré mais abonnement déjà supprimé sur Stripe
      // ou clé API Stripe pointant vers un autre compte.
      if (isMissingSubscription) {
        const canceledAt = new Date().toISOString();
        await updateUserSubscription(normalizedUserId, {
          subscription_status: "canceled",
          subscription_canceled_at: canceledAt,
          subscription_renews_at: null,
          subscription_provider: "stripe",
          subscription_provider_id: null,
        });

        return res.json({
          success: true,
          message: "Abonnement introuvable sur Stripe. Etat local passe en resilie.",
          subscription: {
            status: "canceled",
            plan: user.subscription_plan || null,
            renews_at: null,
            canceled_at: canceledAt,
            provider: "stripe",
            provider_id: null,
          },
        });
      }

      const stripeError = stripeErr?.raw?.message || stripeErr?.message || "Erreur Stripe.";
      console.error("STRIPE CANCEL ERROR:", stripeErr);
      return res.status(502).json({ success: false, message: stripeError });
    }

    await persistStripeSubscription({
      userId: normalizedUserId,
      planKey: user.subscription_plan || null,
      subscription: canceledSubscription,
    });

    return res.json({
      success: true,
      subscription: {
        status: canceledSubscription?.status || "canceled",
        plan: user.subscription_plan || null,
        renews_at: epochToISOString(canceledSubscription?.current_period_end) || null,
        canceled_at: epochToISOString(canceledSubscription?.canceled_at) || new Date().toISOString(),
        provider: "stripe",
        provider_id: canceledSubscription?.id || providerId,
      },
    });
  } catch (err) {
    console.error("SUBSCRIPTION CANCEL ERROR:", err);
    return res.status(500).json({ success: false, message: "Impossible de résilier l'abonnement." });
  }
});

app.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe) {
    return res.status(503).send("Stripe non configuré.");
  }
  let event;
  try {
    if (STRIPE_WEBHOOK_SECRET) {
      const signature = req.headers["stripe-signature"];
      event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(req.body.toString("utf8"));
    }
  } catch (err) {
    console.error("STRIPE WEBHOOK SIGNATURE ERROR:", err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await dispatchStripeEvent(event);
    return res.json({ received: true });
  } catch (err) {
    console.error("STRIPE WEBHOOK HANDLER ERROR:", err);
    return res.status(500).send("Erreur interne webhook.");
  }
});

// ---------- Route Profil utilisateur (GET) ----------
app.get("/user/profile", (req, res) => {
  try {
    // Récupérer l'ID utilisateur depuis la requête (headers ou query)
    // Pour une véritable authentification, utiliser un middleware JWT/session
    const userId = req.query.userId || req.headers["x-user-id"];

    if (!userId) {
      return res.status(400).json({ success: false, message: "ID utilisateur manquant." });
    }

    db.get(
      `SELECT id, username, email, phone, address, profile_picture_url, created_at,
              subscription_status, subscription_plan, subscription_started_at,
              subscription_renews_at, subscription_canceled_at,
              subscription_provider, subscription_provider_id
       FROM users WHERE id = ?`,
      [userId],
      (err, row) => {
        if (err) {
          console.error("PROFILE GET ERROR:", err);
          return res.status(500).json({ success: false, message: "Erreur serveur." });
        }
        if (!row) {
          return res.status(404).json({ success: false, message: "Utilisateur non trouvé." });
        }
        const userPayload = {
          id: row.id,
          username: row.username,
          email: row.email,
          phone: row.phone,
          address: row.address,
          profile_picture_url: row.profile_picture_url,
          created_at: row.created_at,
          subscription: extractSubscriptionFromRow(row),
        };
        return res.json({ success: true, user: userPayload });
      }
    );
  } catch (e) {
    console.error("PROFILE GET ERROR:", e);
    return res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// ---------- Route Profil utilisateur (PUT - mise à jour) ----------
app.put("/user/profile", (req, res) => {
  try {
    const userId = req.query.userId || req.headers["x-user-id"] || req.body.userId;
    const { phone, address, profile_picture_url } = req.body || {};

    if (!userId) {
      return res.status(400).json({ success: false, message: "ID utilisateur manquant." });
    }

    // Validation basique
    if (phone && String(phone).length > 15) {
      return res.status(400).json({ success: false, message: "Numéro de téléphone trop long." });
    }
    if (address && String(address).length > 60) {
      return res.status(400).json({ success: false, message: "Adresse trop longue." });
    }

    db.run(
      `UPDATE users SET phone = ?, address = ?, profile_picture_url = ? WHERE id = ?`,
      [phone || null, address || null, profile_picture_url || null, userId],
      function (err) {
        if (err) {
          console.error("PROFILE UPDATE ERROR:", err);
          return res.status(500).json({ success: false, message: "Erreur lors de la mise à jour." });
        }
        if (this.changes === 0) {
          return res.status(404).json({ success: false, message: "Utilisateur non trouvé." });
        }
        return res.json({ success: true, message: "Profil mis à jour avec succès." });
      }
    );

    // Récupérer l'email de l'utilisateur pour l'envoi du mail
    db.get(`SELECT email, username FROM users WHERE id = ?`, [userId], (err2, row) => {
      if (!err2 && row && row.email) {
        sendEmail({
          to: row.email,
          subject: "Profil mis à jour - Showroom AI",
          html: `<h2>Bonjour ${row.username},</h2><p>Votre profil a bien été mis à jour sur <b>Showroom AI</b>.<br>Si ce n'est pas vous, contactez-nous immédiatement.<br><br>Merci de votre confiance !<br>L'équipe Showroom AI</p>`
        }).catch(e => console.error("Erreur envoi email:", e));
      }
    });
  } catch (e) {
    console.error("PROFILE UPDATE ERROR:", e);
    return res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// Supprimer un utilisateur (DELETE)
app.delete("/user/delete", (req, res) => {
  const userId = req.body.userId || req.query.userId;
  if (!userId) {
    return res.status(400).json({ success: false, message: "ID utilisateur manquant." });
  }
  db.run("DELETE FROM users WHERE id = ?", [userId], function (err) {
    if (err) {
      console.error("DELETE USER ERROR:", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: "Utilisateur non trouvé." });
    }
    return res.json({ success: true, message: "Utilisateur supprimé avec succès." });
  });
});

// Historique des prompts d'un utilisateur
console.log(">>> ROUTE /user/prompts ENREGISTRÉE");

app.get("/user/prompts", (req, res) => {
  console.log(">>> /user/prompts REÇU AVEC", req.query);

  try {
    const userId = req.query.userId || req.headers["x-user-id"];
    const limitParam = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 100)) : 50;

    if (!userId) {
      return res.status(400).json({ success: false, message: "ID utilisateur manquant." });
    }

    db.all(
      `SELECT id, prompt, response, image_url, created_at FROM prompt_history WHERE user_id = ? ORDER BY datetime(created_at) DESC LIMIT ?`,
      [userId, limit],
      (err, rows) => {
        if (err) {
          console.error("PROMPT HISTORY GET ERROR:", err);
          return res.status(500).json({ success: false, message: "Erreur serveur." });
        }
        return res.json({ success: true, history: rows || [] });
      }
    );
  } catch (e) {
    console.error("PROMPT HISTORY GET ERROR:", e);
    return res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// ---------- 404 pour les autres API ----------
app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, message: "Route introuvable." });
});

// ---------- Démarrage ----------
const server = app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});

// Augmenter les timeouts pour les requêtes longues (génération d'images)
server.setTimeout(120000); // 120 secondes pour les connexions socket
server.keepAliveTimeout = 65000;



