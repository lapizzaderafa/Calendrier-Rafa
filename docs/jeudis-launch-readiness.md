# Jeudis Rafa — état de lancement (2026-11-16, branche test)

## Validé sur le projet de test
- Carte de cinq permanentes : Margherita, New York, Mortadella, Speck et Fungus.
- Une pizza de la semaine **par date de jeudi** : Quattro le 19 novembre 2026 seulement; le 26 n'a aucune sélection tant que l'admin n'en choisit pas une.
- Étiquette typographique ultra-discrète « PIZZA DE LA SEMAINE » au-dessus de la recette, sans carte colorée.
- Sélecteur de pizza hebdomadaire dans « Réglages » du back-office test, choix parmi les recettes Rafa.
- Le serveur de test n'accepte une pizza hebdomadaire inactive que pour sa date assignée.
- Réservation d'essai de la Quattro par rôle anonyme réussie dans une transaction annulée; aucune commande de test conservée.
- Plafond de 25 pizzas/jeudi, choix des heures et contrôles de réservation existants préservés.
- L'accueil garde la photo des boîtes, la page commande garde la photo Mortadella authentique.
- Code JavaScript syntaxiquement valide, identifiants HTML sans doublons, nouveau tableau hebdomadaire avec RLS, liste publique via RPC sans accès direct à la table.
- Client Supabase JS épinglé à 2.57.4, cohérent avec l'administration de test.

## À valider IMPÉRATIVEMENT avant d'encaisser de vraies commandes
1. **Légalité du lieu** : autorisation municipale de cuisine/commerce et retrait au domicile, permis MAPAQ adéquat, salubrité, plafond applicable aux préparations en cuisine domestique. Vérifier la situation précise auprès des autorités.
2. **Infrastructure de production** : ne pas fusionner la config Supabase de TEST dans main. Déployer une base et des fonctions adaptées à la production, protéger les données et vérifier les autorisations.
3. **Heures réelles de cueillette** : pour plus de 3 pizzas, l'horaire choisi peut correspondre au début du travail et non à une remise prête; revoir le planning serveur + interface AVANT lancement.
4. **Confirmation client** : message durable avec numéro, adresse réelle uniquement après réservation, heure réelle et instructions; aucun courriel/SMS automatique aujourd'hui.
5. **Paiements** : clarifier Interac et comptant, moment de paiement, annulations/remboursements; pas de paiement intégré.
6. **Tests utilisateurs** : vraie navigation sur iPhone et ordinateur, connexion admin, réservation sur deux appareils en concurrence, annulation, retour du créneau, heure limite du mercredi et bascule sur le jeudi suivant.
7. **Commercial** : confirmer 27 $/pizza et taxes applicables, vérifier liste des allergènes et composition des fromages avant tout label « végétarien » (attention à la présure animale), fiches recettes/quantités pour épicerie, valider la mise en page de la photo.

**Ne pas activer la cueillette publique par simple fusion GitHub tant que ces points ne sont pas approuvés.** La branche `main` et la base Supabase actuelle du site officiel restent intactes.
