# Les Jeudis Rafa — plan de test externe avant publication

**État : développement sur `feature/jeudis-rafa-precommandes-v1`, sans publication sur `main`.**
Le démonstrateur courant utilise `localStorage`. Il n'est **pas** synchronisé entre appareils. Il ne faut donc pas l'utiliser pour simuler un vrai client externe tant que le branchement Supabase n'est pas activé et validé.

## Changements apportés sur la branche

- Administration / **Commandes** : annuler une réservation, afficher les archives et supprimer définitivement une réservation.
- **Annuler** : statut `cancelled`, conserve la trace; libère aussitôt les capacités du moteur et retire ces pizzas du total, du bilan et de la liste d'épicerie.
- **Rétablir** : seulement si le calendrier peut reprendre la réservation sans dépassement de capacité. Ne jamais restaurer aveuglément.
- **Supprimer définitivement** : demande de saisir le numéro exact de commande; efface la ligne de démo et libère sa capacité. Ne pas utiliser si on a besoin de conserver une trace comptable ou d'un remboursement.
- Une commande remise reste dans les statistiques et dans l'historique; ne doit pas rouvrir de places pour ce même jeudi.
- Commande marquée payée : l'interface avertit que l'annulation/suppression **ne rembourse pas automatiquement** le client.
- Mode service : bouton **« Annuler cette réservation »** accessible sur la commande en cours et passage à la commande suivante.
- Date du prochain jeudi et échéance du mercredi midi explicitées sur la commande et sa confirmation.

## Préparation technique pour Supabase

- `supabase/migrations/20261115_rafa_jeudis.sql` : **migration proposée et non exécutée**. Crée des tables séparées `rafa_jeudis_*`, une lecture de disponibilités sans coordonnées clients, une réservation atomique protégée par un verrou sur la date et une fonction de gestion administrateur.
- `assets/jeudis-supabase-api.js` : adaptateur préparé pour demander les disponibilités et enregistrer une réservation avec une clé idempotente; il inclut des opérations administrateur d'annulation et suppression. **Il n'est pas activé dans les pages de démo.**
- Les anciens tableaux du site et les réservations événementielles ne sont pas modifiés.
- Le même administrateur Supabase que le back-office actuel est prévu; les commandes clients ne sont pas lisibles publiquement.
- La sélection initiale de **4 pizzas** dans la migration est provisoire (Margherita, New York, Mortadella, Speck); elle doit être approuvée et rendue modifiable.
- Les contraintes de capacité initiales (`3 pizzas/20 min`, `2 voitures/20 min`, `30 pizzas/jeudi`, `4,5 min de travail/pizza`) sont des hypothèses. Il faudra mesurer le service réel avant publication.
- Les grosses commandes de plus de 3 pizzas sont encore divisées en retraits successifs : **pas conforme à l'objectif final d'une heure de remise unique si possible**. Ne pas mettre en vente sans validation de ce parcours.
- Aucun courriel automatique, aucun virement Interac automatique, aucun remboursement automatique et aucune adresse exacte installée dans le prototype.

## Test externe à réaliser **après** connexion et validation de la base

1. Appliquer la migration dans **un projet ou une branche Supabase de test**, puis vérifier les fonctions SQL et les politiques d'accès.
2. Activer l'interface client et le back-office sur une **URL de prévisualisation distincte de rafapizza.ca**.
3. Ouvrir le parcours client sur le téléphone A; choisir 2 pizzas pour une heure libre, utiliser un nom, courriel et numéro fictifs, confirmer et noter l'identifiant de commande.
4. Ouvrir le back-office sur le téléphone ou ordinateur B; la commande doit apparaître sans être recopiée à la main.
5. Cliquer **Annuler la commande**; vérifier qu'elle disparaît de la file de service, que les 2 places redeviennent libres sur le téléphone A après actualisation et que l'épicerie recalcule les quantités.
6. Faire une nouvelle commande sur le créneau libéré; essayer de **rétablir** l'ancienne. Le serveur doit bloquer le rétablissement s'il dépasserait la capacité.
7. Sur une nouvelle fausse réservation, cliquer **Supprimer définitivement** et confirmer en saisissant son identifiant. Vérifier qu'elle disparaît de la base, de l'épicerie et du bilan.
8. Simuler deux clients confirmant **le dernier créneau disponible au même moment**. Un seul doit être accepté.
9. Vérifier le refus côté serveur après le **mercredi à 12 h (America/Toronto)**, ainsi que la bascule sur le jeudi suivant.
10. Vérifier qu'une commande marquée **Remise** ne libère pas à tort de capacité.
11. Vérifier les quatre recettes offertes, le prix, le traitement des paiements, le courriel de confirmation et l'adresse communiquée après confirmation.
12. Supprimer toutes les commandes fictives et recontrôler les statistiques.

**Critère de mise en production :** aucune commande perdue/doublée, aucun créneau dépassé, bon accès administrateur, vue client claire, annulation et suppression fonctionnelles, et test concret de cadence pour les grosses commandes.

## Tests automatisés inclus

`tests/jeudis-core.test.js` vérifie 14 cas : calcul du jeudi, fermeture mercredi midi, nombre de pizzas, capacité voitures, plafond du jeudi, annulation, suppression, restauration, créneaux fermés, répartition des recettes et détection de surcapacité.

## Point de blocage actuel

L'intégration Supabase est **préparée dans le dépôt**, mais elle n'a pas été appliquée au projet distant : accès/connexion Supabase et validation de la migration nécessaires. Les pages `jeudis.html` et `jeudis-admin.html` restent des démonstrateurs locaux tant que l'activation réelle n'est pas faite.

**Ne pas fusionner cette branche sur `main` pour ouvrir les commandes réelles avant les tests ci-dessus.**
