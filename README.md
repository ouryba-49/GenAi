# Showroom AI

Application web Node.js + Express pour generer des visuels de showroom avec l'IA, gerer les comptes utilisateurs, l'historique et l'abonnement Stripe.

## Stack

- Backend: Node.js, Express, SQLite
- Frontend: HTML/CSS/JS (fichiers statiques dans `public/`)
- IA: OpenAI (reformulation prompt + generation image)
- Paiement: Stripe
- Email: SendGrid (et support Nodemailer present)

## Prerequis

- Node.js 18+
- npm

## Installation

```bash
npm install
```

## Configuration `.env`

Creer/mettre a jour le fichier `.env` a la racine:

```env
OPENAI_API_KEY=your_openai_key
PORT=3000
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=you@example.com
STRIPE_SECRET_KEY=your_stripe_secret_key
```

Ne jamais commit `.env` dans Git.

## Lancement

```bash
node server.js
```

Serveur disponible sur:

`http://localhost:3000` (ou la valeur de `PORT`).

## Parcours applicatif

1. `GET /` affiche la page d'accueil (`public/home.html`)
2. Inscription via `inscription.html`
3. Connexion via `index.html`
4. Generation d'image depuis prompt (et image de reference optionnelle)
5. Consultation de l'historique avec apercu image
6. Gestion d'abonnement (souscription + resiliation) depuis l'interface

## Endpoints principaux

- `POST /register` : creation de compte
- `POST /login` : connexion
- `POST /gpt-generate` : reformulation du prompt
- `POST /image-edit` : generation image (avec ou sans image importee)
- `GET /user/profile` : recuperation profil
- `PUT /user/profile` : mise a jour profil
- `GET /user/prompts` : historique prompts/images
- `POST /subscriptions/checkout` : creation session Stripe
- `POST /subscriptions/confirm` : confirmation abonnement Stripe
- `POST /subscriptions/cancel` : resiliation abonnement Stripe

## Structure rapide

```text
.
├─ server.js
├─ users.db
├─ public/
│  ├─ home.html
│  ├─ index.html
│  ├─ inscription.html
│  ├─ profile.html
│  ├─ edit-profile.html
│  ├─ style.css
│  └─ js/
└─ uploads/
```

## Notes

- Le projet utilise SQLite (`users.db`) en local.
- Si tu modifies les routes d'abonnement, verifie aussi les webhooks Stripe.
- Certaines fonctionnalites frontend utilisent des URL absolues (`localhost:3001`) dans des scripts; aligne-les avec le `PORT` serveur si necessaire.
