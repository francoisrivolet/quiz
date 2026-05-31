# Quiz App

Application web de quiz construite avec Next.js, TypeScript, Tailwind CSS et PostgreSQL.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS 4**
- **PostgreSQL** via Docker
- **Prisma 7** (ORM)
- **NextAuth v5** (authentification email/password)

## Prérequis

- [Node.js](https://nodejs.org) 18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop)

## Installation

```bash
npm install
```

Copie les variables d'environnement :

```bash
# .env
DATABASE_URL="postgresql://quiz:quiz@localhost:5433/quiz?schema=public"
AUTH_SECRET="<génère avec : openssl rand -base64 32>"
AUTH_URL="http://localhost:3000"
```

## Base de données

```bash
# Démarrer PostgreSQL
docker compose up -d

# Créer les tables (première fois)
npx prisma migrate dev --name init

# Arrêter PostgreSQL
docker compose stop

# Supprimer les données
docker compose down -v
```

> Le container tourne sur le port **5433** (le port 5432 peut être occupé par un PostgreSQL local).

## Développement

```bash
npm run dev        # Démarre le serveur sur http://localhost:3000
npm run build      # Build de production
npm run lint       # Linter ESLint
```

## Prisma

```bash
npx prisma generate                    # Régénère le client après un changement de schéma
npx prisma migrate dev --name <nom>    # Crée et applique une migration
npx prisma studio                      # Interface visuelle de la base de données
```

## URLs

### Authentification
- **Connexion** : `http://localhost:3000/auth/signin`

> Les comptes utilisateurs se créent directement en base de données (via Prisma Studio ou un script).

### Espace admin (accès protégé)
- **Liste des quiz** : `http://localhost:3000/admin`
- **Éditeur de quiz** : `http://localhost:3000/admin/quizzes/[quizId]`
- **Salle d'attente admin** : `http://localhost:3000/admin/session/[sessionId]`
- **Contrôle du quiz** : `http://localhost:3000/admin/session/[sessionId]/quiz`
- **Résultats finaux admin** : `http://localhost:3000/admin/session/[sessionId]/results`

### Espace joueur
- **Rejoindre un quiz** : `http://localhost:3000/join`
- **Salle d'attente joueur** : `http://localhost:3000/session/[sessionId]/waiting`
- **Page de jeu** : `http://localhost:3000/session/[sessionId]/play`
- **Résultats finaux joueur** : `http://localhost:3000/session/[sessionId]/results`
