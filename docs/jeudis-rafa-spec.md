# Les Jeudis Rafa — prototype de développement

## Paramètres approuvés
- Équipe : Rafa seul avec Ooni Volt 2, Gozney Tread et Gozney Arc 12.
- Prix initial : 27 $ par pizza.
- Capacité de départ, à mesurer en service : 3 pizzas par 20 minutes et 30 pizzas maximum par jeudi.
- Retraits : chaque jeudi de 17 h à 21 h, derniers départs de créneau à 20 h 40.
- Modes de paiement à prévoir : Interac à validation manuelle ou comptant.

## Date unique, mercredi midi
- Seul le prochain jeudi admissible est proposé (pas de réservations plusieurs semaines à l'avance).
- Jusqu'au mercredi 11 h 59 (America/Toronto), commande possible pour le jeudi du lendemain.
- Mercredi à 12 h, les commandes de demain ferment et restent fermées jusqu'au début du jeudi.
- Dès jeudi 00 h 00, le jeudi suivant devient la seule date proposée.
- Exemple : dimanche 15 novembre 2026, date proposée = jeudi 19 novembre; mercredi 18 novembre 12 h = fermeture; jeudi 19 novembre 00 h = jeudi 26 novembre proposé.

## Parcours quantité d'abord
1. Choisir le nombre de pizzas désiré AVANT les recettes.
2. Afficher immédiatement les créneaux compatibles avec ce nombre et les commandes déjà réservées.
3. Choisir exactement autant de pizzas différentes ou identiques que la quantité annoncée.
4. Mettre à jour les disponibilités en cas de changement de quantité; confirmer seulement si le nombre de recettes choisies correspond.
5. Sélectionner une heure possible et saisir les coordonnées.
6. Sur la version commerciale, réserver atomiquement côté serveur et envoyer la confirmation.

## Règles de disponibilité
- Pour 1 à 3 pizzas, la totalité doit pouvoir être retirée à une seule heure.
- Pour plus de 3 pizzas, possibilité de plusieurs retraits sur des créneaux successifs, quantité indiquée à chaque créneau.
- Exemple : si 17 h a déjà 2 pizzas, il reste 1 place. Une commande de 1 pizza peut viser 17 h, une commande de 2 pizzas ne peut pas viser 17 h; elle peut viser 17 h 20 si au moins 2 places sont libres.
- Si une commande de 4 pizzas arrive pour 17 h avec 1 place libre à 17 h et 3 à 17 h 20, on peut proposer 1 pizza à 17 h puis 3 pizzas à 17 h 20.
- Plafond total de 30 pizzas par jeudi. Le système final devra prendre en compte la capacité physique réelle et les temps de montage, cuisson, finition, emballage et remise.

## Contenu de la branche de test
- jeudis.html, assets/jeudis.js et assets/jeudis.css : page de commande client fictive.
- assets/jeudis-core.js : calcul des dates, échéances et allocations par quantité.
- jeudis-admin.html et assets/jeudis-admin.js : commandes fictives, service, épicerie de base, bilan et états de paiement.
- Liens de navigation ajoutés uniquement sur la branche aux pages index.html, carte.html et admin-original.html.

## Sécurité et limites
- PROTOTYPE, non destiné à accepter des commandes commerciales.
- Supabase de production inchangé, aucun paiement ni courriel envoyé, aucune publication sur la branche main.
- Les commandes sont simulées en localStorage, sans synchronisation entre appareils et sans garanties de concurrence.
- L'écran de gestion n'utilise pas encore l'authentification Supabase; il est réservé aux simulations fictives.
- L'épicerie liste les ingrédients de recettes sans grammages validés.
- Ne pas entrer de vraies données personnelles de clients dans la démo.

## Travaux à approuver séparément avant lancement
- Schéma Supabase, contrôle d'accès RLS et fonctions transactionnelles côté serveur.
- Synchronisation multi-appareils et véritable protection contre les doubles réservations.
- Paiements, courriels, annulations, confirmations et validation admin.
- Association des pizzas individuelles à chaque créneau pour les grandes commandes.
- Recettes détaillées avec grammages, stock et liste d'épicerie.
- Tests de cadence, sécurité, réglementation, migration puis fusion sur main avec accord explicite.


## Concept et expérience de cueillette
- Nom de l'expérience : **Service au volant**, sous la bannière **Les Jeudis Rafa**; slogan : « Les meilleures pizz, directement dans ton auto. ».
- Le client ne reçoit **aucune adresse de rue** avant d'avoir terminé la commande et d'avoir reçu une confirmation valide.
- La page avant commande affiche uniquement « Cap-Rouge, Québec », sans numéro civique, point GPS, lien de carte ni photo qui révèle une propriété.
- Formulaire **obligatoire** : nom complet, téléphone, adresse courriel, plus choix du mode de paiement et consentement au suivi de commande. En production, valider les coordonnées (p. ex. confirmation de téléphone/courriel selon le mode de paiement, quotas anti-spam); une simple saisie ne prouve pas l'identité.
- Après confirmation, le client voit l'adresse exacte et les consignes : se présenter à l'arrière, utiliser l'espace de stationnement prévu, rester dans son véhicule et attendre la remise en main propre des pizzas chaudes en boîtes.
- Dans la version commerciale, **l'adresse exacte est configurée côté serveur seulement**. Il ne faut pas la placer dans HTML, JS, CSS, JSON public, source maps, dépôts GitHub ou attributs cachés : masquer visuellement une adresse ne protège pas sa confidentialité.
- La page de confirmation doit demander les instructions privées au serveur après vérification d'un accès lié à une commande réelle; ne jamais les inclure dans la réponse publique de vérification des créneaux. Les liens de confirmation devraient être non devinables et limités au besoin.
- Dans le back-office : coordonnées du client, étapes de préparation, statut arrivée au stationnement et remise dans l'auto, ainsi que suivi des paiements. Sécuriser accès admin et conserver les données clients selon les obligations applicables.
- Attention : l'expression « service au volant » décrit ici une **remise à la voiture sur rendez-vous**, pas une file de voitures ou un commerce sans réservation. Vérifier l'autorisation municipale et MAPAQ avant lancement.

## Comportement actuel du prototype
- Affichage « Service au volant » et consignes générales sans révéler une adresse.
- Coordonnées obligatoires, cases de consentement et écran de confirmation fictive avec instructions de stationnement et emplacement de l'adresse future.
- L'adresse réelle n'est ni connue ni présente dans le code du prototype.
- Suivi du nom, du téléphone, du courriel et de l'arrivée dans l'écran de gestion fictif.
- Ne pas tester avec de vraies données personnelles : la démo enregistre ses informations dans le navigateur de test uniquement.
