# GenAi

MODE D'EMPLOIE


1-Installation des dépendances
Assurez-vous d’avoir Node.js installé sur votre machine. Ensuite, dans le dossier du projet, exécutez :

npm install

Cela installe les modules nécessaires : express, sqlite3, body-parser.

2-⚙️ Lancement du serveur
Lancez le serveur avec la commande suivante :


node server.js
✅ Une fois lancé, vous verrez dans le terminal :

✅ Serveur démarré sur http://localhost:3000

  DEUXIEME FACON 
  Accès manuel
Ouvrez votre navigateur, et allez manuellement à l’adresse suivante pour créer un compte :

http://localhost:3000/register.html


3-Création d’un compte utilisateur

Remplissez le formulaire d’inscription (register.html)

Cliquez sur S’inscrire

Vous verrez un message de confirmation

Vous serez redirigé vers la page de connexion (index.html)


4-Connexion
Accédez à la page de connexion :

http://localhost:3000/index.html

Entrez l’adresse email et le mot de passe utilisés à l’inscription

Cliquez sur Se connecter

Vous accéderez à l’interface immersive générée automatiquement

5-Fonctionnement du backend

Une base de données SQLite locale est utilisée : users.db

Le serveur expose deux routes :

POST /register → pour enregistrer un nouvel utilisateur

POST /login → pour authentifier un utilisateur existant


6- Important
N’ouvrez jamais directement les fichiers .html dans le navigateur sans avoir lancé le serveur (file:// ne fonctionnera pas avec fetch).

Les identifiants créés sont enregistrés localement dans users.db. Ils persistent tant que ce fichier n’est pas supprimé.

Si une erreur de "connexion au serveur" apparaît, vérifiez que le serveur est bien en cours d’exécution (node server.js).