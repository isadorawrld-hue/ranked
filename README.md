# RANKED v2

Ligue compétitive entre potes : rangs, LP, duels, vannes, heures de boulot comptées automatiquement.

## Ce que ça fait
- **Rangs** : Rouille, Cuivre, Chrome, Néon, Plasma, Quantum, Singularité (3 divisions chacun), puis Apex.
- **Points du jour** (0 à 100) : 50 % progression argent (7 derniers jours vs moyenne des 4 semaines d'avant), 30 % heures de boulot (8 h max comptées), 20 % régularité (série).
- **LP** : `(points - 40) x 0,9`, entre -20 et +54 par jour. Le jour en cours ne fait jamais perdre de LP.
- **Saisons** de 28 jours, on garde 60 % des LP à la saison suivante. Palmarès conservé.
- **Duels** 1v1 (heures, points, argent, anti-scroll) sur 1, 3 ou 7 jours, avec mise. +15 LP au gagnant, -5 au perdant.
- **Feed** : vannes automatiques (dépassements, promos, séries cassées, records, inactifs, duels) + vannes manuelles.
- **Palier du mois** (repris de la v1 de Rafael) : Cuivre à Légende selon le total mensuel. Privé, partage au choix.
- **Confidentialité** : personne ne voit les montants des autres, seulement le %. Un montant contesté par la moitié de la ligue est annulé.

## Agent Windows
Fichier `.cmd` téléchargé depuis l'onglet Moi. Il lit la fenêtre active toutes les 5 s, classe le temps localement
(Claude, Infloww / CRM, trading, boulot, scroll, autre) et envoie seulement des minutes. Pause si clavier et souris
immobiles 5 min (15 min en trading). Rien n'est compté pendant la veille. Démarre avec Windows.

## Direct + mur de la honte
L'agent envoie toutes les 60 s (15 s si ça change) ce que le joueur fait : catégorie + un nom court tiré
d'une liste fixe (Valorant, Netflix, Claude…) ou du dossier d'install du jeu (Steam, Epic, Riot, Xbox…).
Jamais le titre brut d'une fenêtre. Jeu lancé = annonce dans le feed (1 fois / 3 h par jeu). Vidéo plus
d'1 h = annonce. Option « mode fantôme » dans Réglages, visible par tous.

## Scroll iPhone
Apple bloque toute app qui lirait le Temps d'écran. On passe par l'app Raccourcis : 2 automatisations
(app réseau social « Est ouverte » / « Est fermée ») appellent `/api/p/<clé>/open|close`, plus un ping
chaque soir (`/ping`). Une session compte 60 min max (écran verrouillé dans l'app). Aucun signal pendant
26 h = 📵 visible par la ligue et défaite d'office en duel anti-scroll. La clé se change depuis l'onglet Moi.

## Technique
- `public/` : front (HTML + JS sans framework), `core.js` partagé front/serveur.
- `netlify/functions/api.mjs` : API, stockage Netlify Blobs (écritures protégées par ETag).
- `agent/*.ps1` : sources de l'agent. Après modif : `node build.mjs` (régénère `_agent.mjs`).
- Tests : `npm test` (moteur, API, agent PowerShell simulé, parse de l'installeur).
- Démo sans serveur : `/?demo`.
