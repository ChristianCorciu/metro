# Metro API
Metro API est une application Node.js conçue pour fournir des informations sur les prochains passages et le dernier métro pour une station donnée à Paris. L'application utilise Express comme serveur web, PostgreSQL pour gérer les données des stations et horaires, et peut être déployée facilement avec Docker et Docker Compose. Elle fournit des endpoints JSON simples et rapides pour récupérer les horaires en temps réel et vérifier l'état du service.

## Fonctionnalités
- Obtenir le prochain métro pour une station précise
- Vérifier le dernier départ du métro pour planifier ses déplacements
- Gestion complète des horaires selon le fuseau horaire Europe/Paris
- Base de données PostgreSQL pour stocker les stations et leurs horaires
- Endpoints JSON clairs et documentés pour intégration facile dans d'autres applications
- Logger minimal pour suivre les requêtes et la performance des endpoints

## Installation et démarrage
1. Cloner le dépôt : `git clone https://github.com/ChristianCorciu/metro.git` puis `cd metro`
2. Lancer Docker Compose pour construire et démarrer les services : `docker compose up --build`
3. L'API sera accessible sur `http://localhost:5000`
4. Les logs des containers permettent de suivre les requêtes et l'état de la base

## Endpoints
- `GET /health` : Vérifie que l'API est opérationnelle. Retourne `{ "status": "ok" }`.
- `GET /next-metro?station=<nom_de_la_station>` : Retourne le prochain métro pour la station demandée avec : station, ligne, intervalle entre métros (headwayMin), prochain passage (nextArrival), indication si c'est le dernier métro (isLast), fuseau horaire.
- `GET /last-metro?station=<nom_de_la_station>` : Retourne le dernier métro de la station avec : station, ligne, dernier départ (lastDeparture), fuseau horaire.

## Base de données
La base PostgreSQL contient une table `stations` avec les colonnes suivantes : `station` (nom de la station), `line` (ligne du métro), `headway_min` (intervalle en minutes entre les passages), `service_start` (début du service), `service_end` (fin du service), `last_window_start` (début de la dernière fenêtre de service). Un script `init.sql` est inclus pour initialiser la base avec des données de test et vérifier le fonctionnement de l'API.

## Déploiement
- Le projet est conçu pour être exécuté avec Docker et Docker Compose, ce qui simplifie la mise en production et le développement local.
- L'image Node.js inclut toutes les dépendances, et PostgreSQL est configuré automatiquement avec un volume persistant pour les données.
- Swagger UI est également déployé via un container pour visualiser et tester facilement les endpoints.

## Contribution
- Fork le projet
- Crée une branche pour tes modifications
- Push tes changements et crée un Pull Request
- Toute amélioration ou correction de bug est bienvenue

