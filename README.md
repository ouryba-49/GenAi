# Showroom AI

Application web Node.js + Express pour generer des visuels de showroom avec IA, gerer les comptes utilisateurs, l'historique et l'abonnement Stripe.

## Architecture IA (hybride)

- Reformulation texte: OpenAI
- Generation/modification image: Stability AI

Concretement:

- `POST /reformulate` -> OpenAI (`gpt-4o-mini`)
- `POST /generate-image` -> Stability SD3

Des aliases existent pour compatibilite ancienne version:

- `POST /gpt-generate` (alias reformulation)
- `POST /image-edit` (alias generation image)

## Stack

- Backend: Node.js, Express, SQLite
- Frontend: HTML/CSS/JS (`public/`)
- IA texte: OpenAI Chat Completions
- IA image: Stability AI SD3
- Paiement: Stripe
- Email: SendGrid (fallback SMTP Nodemailer)

## Prerequis

- Node.js 18+
- npm

## Installation

```bash
npm install
```

## Configuration `.env`

Creer/mettre a jour `.env` a la racine:

```env
PORT=3001
OPENAI_API_KEY=your_openai_key
STABILITY_API_KEY=your_stability_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=optional_webhook_secret
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=you@example.com
EMAIL_USER=optional_smtp_user
EMAIL_PASSWORD=optional_smtp_password
```

Important:

- Ne jamais commit `.env`.
- Regenerer toute clé exposée accidentellement.
- Stability necessite des credits actifs pour generer des images.

## Lancement

```bash
node server.js
```

Serveur disponible sur `http://localhost:<PORT>`.

## Flux principal

1. L'utilisateur saisit un prompt.
2. Le frontend appelle `/reformulate` (OpenAI) pour une reformulation stricte.
3. L'utilisateur confirme.
4. Le frontend appelle `/generate-image` avec `FormData`:
   - `prompt`
   - `image` (optionnel)
   - `strength` (par defaut `0.65` en image-to-image)
5. Le backend envoie a Stability:
   - mode `image-to-image` si image uploadee
   - mode `text-to-image` sinon
6. Le backend renvoie l'image en Data URL base64:
   - `{ image: "data:image/png;base64,..." }`

## Endpoints principaux

### Auth / profil

- `POST /register` : creation de compte
- `POST /login` : connexion
- `GET /user/profile` : recuperation profil
- `PUT /user/profile` : mise a jour profil
- `DELETE /user/delete` : suppression utilisateur

### IA

- `POST /reformulate` : reformulation stricte (OpenAI)
- `POST /generate-image` : generation/modification image (Stability)
- `GET /user/prompts` : historique prompts + image generee

### Abonnement

- `POST /subscriptions/checkout` : creation session Stripe
- `POST /subscriptions/confirm` : confirmation abonnement
- `POST /subscriptions/cancel` : resiliation abonnement
- `POST /webhook/stripe` : webhook Stripe

### Email

- `POST /email/test` : test envoi email (diagnostic SendGrid/SMTP)

## Notes techniques

- Les appels Stability sont en `multipart/form-data` (pas JSON).
- En image-to-image, `aspect_ratio` n'est pas envoye (contrainte API Stability).
- Les fichiers image uploades sont stockés temporairement dans `uploads/`, puis supprimes.
- L'historique (`prompt_history`) stocke aussi `image_url` (Data URL base64).
