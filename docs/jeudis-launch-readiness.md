## Offre de lancement actuellement en maquette (2026-11-16)
- La précédente proposition **4 pizzas pour 99 $** a été **remplacée** dans le site et la base Supabase de test. Elle n'est plus active, même si son ancien essai est conservé plus bas comme historique.
- Nouvelle offre expérimentale : **3 pizzas achetées, la 4e offerte** pour le jeudi **19 novembre 2026 seulement**, sans lien avec le jour où le site sera finalement publié.
- Tarif : 27 $ par pizza, **81 $ pour 4**, réduction de 27 $ (25 %); **une seule gratuité par commande**, même si 8 pizzas sont commandées (8 = 189 $).
- Offre valable pour n'importe quel mélange de recettes de la carte de ce jeudi, sous réserve des disponibilités.
- Le menu affiche une courte accroche typographique dès l'ouverture (« Offre de lancement · 19 novembre seulement ») sans encadré. Un indicateur discret à quatre points n'apparaît qu'après le premier ajout et uniquement si quatre pizzas peuvent être réservées ensemble.
- Dates suivantes : le visuel promotionnel disparaît et le serveur facture le prix normal de 27 $/pizza.
- Prix calculé côté serveur dans la fonction de réservation atomique (`total_cents=v_qty*2700-(case when p_date=date '2026-11-19' and v_qty>=4 then 2700 else 0 end)`). Le reçu et le panier montrent le même rabais.
- Tests de transactions avec `anon` et `ROLLBACK` : 1 pizza = 27 $, 3 = 81 $, 4 = 81 $, 5 = 108 $, 8 = 189 $; aucune commande fictive conservée. Test d'interface simulé le 19 novembre et le 26 novembre passé.
- **Offre non approuvée pour le vrai site** : calculer la marge par pizza, les coûts variables de boîtes, garnitures, déplacement et travail, et confirmer la conformité de l'affichage des prix et taxes. La limite de 25 pizzas par jeudi reste en vigueur. Ne pas publier sur `main` sans approbation.

## Maquette promotionnelle — À VALIDER (16 novembre 2026)
- La date de cueillette apparaît dans une capsule à contour fin avec une micro-mention « Prochaine cueillette » et « Une nouvelle date chaque semaine ». **Ce n'est pas un bouton de sélection** : la date est générée automatiquement d'après le prochain jeudi.
- À partir d'une pizza dans le panier, un indicateur à quatre points rappelle progressivement le forfait, uniquement si la capacité restante permet encore d'atteindre quatre pizzas. Aucun encadré promotionnel permanent.
- Offre *expérimentale et non approuvée pour la vente réelle* : **4 pizz pour 99 $**, prix individuel **27 $**, économie **9 $** par groupe de quatre. Le rabais se répète pour chaque groupe de quatre dans une commande (8 = 198 $); les autres pizzas restent à 27 $.
- Le serveur de test calcule et sauvegarde lui-même le total en centimes dans l'enregistrement atomique : `total_cents = pizza_qty*2700 - (pizza_qty/4)*900` (division entière PostgreSQL). Le navigateur affiche le même calcul et la confirmation privilégie le total du serveur.
- Vérifications transactionnelles avec rollback : 1 pizz = 27 $, 3 = 81 $, 4 = 99 $, 5 = 126 $, 8 = 198 $. Aucun faux achat conservé.
- **Avant lancement** : confirmer que la marge sur 4 pizzas permet 9 $ de rabais (ingrédients, pâtons, boîtes, énergie, temps), valider les règles de taxes/prix affichés, ainsi que la cadence réelle pour 4+ pizzas. La maquette continue de pointer vers le Supabase de test.
- La maquette garde la photo d'origine; la prise de commandes réelles n'est toujours PAS activée.

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
