# Environnement de test gratuit Rafa Jeudis — ACTIF

**Projet Supabase isolé** : `Rafa Jeudis – Tests` (`bkvosdrtexbkrkmwalbg`), région Canada. Tarif de création confirmé `0 $ US/mois`, dans les limites du forfait gratuit. La base du site officiel reste inchangée.

**Test client** : `https://raw.githack.com/lapizzaderafa/Calendrier-Rafa/jeudis-rafa-test/jeudis-externe.html`
**Test admin** : `https://raw.githack.com/lapizzaderafa/Calendrier-Rafa/jeudis-rafa-test/jeudis-admin-externe.html`

Ces liens utilisent un hébergement de prévisualisation externe gratuit (raw.githack.com) qui peut afficher une page de confirmation de navigation. Ne jamais utiliser un mot de passe existant sur ce service; créer un mot de passe **uniquement pour le projet de test**. Ne jamais utiliser de vraies coordonnées client durant les essais.

**Première utilisation de l'admin** : ouvrir la page admin ci-dessus, saisir un nouveau mot de passe (au moins 8 caractères), cliquer « Créer mon accès de test ». Un courriel de vérification peut être nécessaire (Supabase Auth). Après confirmation, se reconnecter sur la page admin avec ce nouveau mot de passe. L'identité autorisée par la base de test est `raphael.frenette@gmail.com`.

**Test client** : sélectionner les pizzas et une heure du jeudi, remplir de faux renseignements (ex. Jean Test, jean.test@example.com, 555-0100), confirmer. L'adresse affichée est fictive et indique **de ne pas se déplacer**.

**Annulation** : admin > « Commandes » > « Annuler ». La réservation passe dans l'historique et le calendrier libère immédiatement son espace. « Supprimer définitivement » demande de recopier l'identifiant; cela retire toute trace de la base de test. Si une commande est marquée payée, le système affiche un avertissement de remboursement manuel.

**Limitations** : Aucun paiement automatique, aucun courriel automatique de confirmation client, aucun SMS, aucune adresse réelle. 1 à 6 pizzas par commande avec une seule heure de cueillette. Jusqu'à 30 pizzas par jeudi, 2 voitures maximum et une production hypothétique de 3 pizzas par 20 minutes, à confirmer avec les fours. Le nouveau code n'est pas encore fusionné sur la branche `main` du site.

**Vérifications serveur déjà réussies** : migration SQL appliquée, 3 tables avec RLS, fonction de réservation atomique, faux client capable de réserver sous rôle `anon`, annulation libérant la capacité, suppression de commande et droits d'administration non publics. 18 tests JS du moteur ont réussi avant la création du projet. Le parcours complet dans un vrai navigateur, l'inscription du compte admin et une simulation de deux clients simultanés restent à essayer.

---

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
- Le moteur de développement et la migration proposée sont maintenant alignés sur **une seule heure de remise pour 1 à 6 pizzas**, avec production dans les 40 minutes qui précèdent. Il faut toujours confirmer les cadences réelles avant publication.
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

`tests/jeudis-core.test.js` vérifie 18 cas : calcul du jeudi, fermeture mercredi midi, nombre de pizzas, capacité voitures, plafond du jeudi, annulation, suppression, restauration, créneaux fermés, répartition des recettes et détection de surcapacité.

## Point de blocage actuel

L'intégration Supabase est **préparée dans le dépôt**, mais elle n'a pas été appliquée au projet distant : accès/connexion Supabase et validation de la migration nécessaires. Les pages `jeudis.html` et `jeudis-admin.html` restent des démonstrateurs locaux. Deux pages de test externes distinctes (`jeudis-externe.html` et `jeudis-admin-externe.html`) sont maintenant préparées : elles attendent une base Supabase de test, la migration et l'activation explicite de `assets/jeudis-test-config.js`.

**Ne pas fusionner cette branche sur `main` pour ouvrir les commandes réelles avant les tests ci-dessus.**

## Photographie à choisir avant la publication
- La rubrique **Les Jeudis Rafa** doit conserver l'esthétique **album architectural** du vrai accueil, avec **une seule vraie photo Rafa** et aucune image créée artificiellement.
- Le choix de la photo doit se faire **avec Rafa avant publication**; ne pas substituer automatiquement une image de banque.
- Photos déjà dans le dépôt public susceptibles de convenir : `assets/03-mortadella-pistache-dessus.jpeg`, `assets/05-mortadella-ambiance.jpeg`, `assets/06-decoupe-pizza.jpeg`, `assets/editorial-rafa-pizza.jpeg`.
- Variante éventuelle à photographier : pizza sortie du four, dans sa boîte ouverte, mains de Rafa au premier plan. Photo naturelle avec texture de croûte bien visible, pas d'apparence IA.
- Conserver la composition épurée: une photographie et quelques lignes de texte avec l'interface de commande à proximité. Aucune multiplication de blocs décoratifs.


## Tests externes : état de la préparation technique

- `jeudis-externe.html` : page de réservation avec un menu restreint aux pizzas actives, capacité calculée par RPC, une heure de cueillette, formulaire nom/téléphone/courriel, paiement manuel et confirmation.
- `jeudis-admin-externe.html` : interface de préparation et service, annulation qui libère les créneaux, rétablissement sous validation, suppression irréversible après confirmation, suivi des paiements et réglages de cueillette.
- Le serveur de test pourra calculer exactement la quantité restante pour chaque heure grâce à la fonction SQL `rafa_jeudis_capacity_candidate`. Toute réservation sera quand même revalidée sous verrou atomique.
- La confirmation de réservation possède une clé opaque générée sur le navigateur et affiche l'adresse de cueillette après enregistrement, si celle-ci est saisie dans l'interface admin.
- Le fichier `assets/jeudis-test-config.js` contient `enabled:false`. **Le test externe n'est donc pas encore activé.**
- La branche de développement Supabase serait facturée **0,01344 $ US par heure** selon le devis reçu. Sa création attend l'accord explicite du propriétaire. Le projet Supabase de production `jetogsbyptglaihktdel` demeure inchangé.
- La migration SQL n'a pas encore été exécutée sur une base de test : ses fonctions doivent être vérifiées en situation réelle avant d'être considérées comme prêtes.
- Aucun changement sur la branche `main` du site GitHub.
