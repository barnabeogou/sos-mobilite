# Cahier des charges consolidé — SOS MOBILITÉ

Synthèse des éléments du groupe Telegram « SOS MOBILITÉ » (sujets LE PROJET, DESIGN & INTERFACE, GRAPHISME,
MARKETING, Idée d’amélioration, SERVICE DE FACTURATION, IMPÔT ET RÈGLEMENT) et des documents de travail
GARAGE EN LIGNE (dossier complet, présentation investisseurs, plan financier, offre Premium Moto).

## Identité

- **Nom officiel** : SOS MOBILITÉ (anciennement « GARAGE EN LIGNE »). **Slogan** : « Votre tranquillité, notre engagement. »
- Positionnement : premium accessible. Marché : Côte d’Ivoire (pilote Abidjan), puis Afrique de l’Ouest.
- Architecture de marque : SOS AUTO · SOS MOTO · SOS MARINE (jet-skis, bateaux) · SOS SERVICES.
- Palette : bleu nuit `#0B1F33`, rouge sécurité `#E30613`, gris argent `#A7B0BD`, blanc, noir `#0A0A0A` ; bleu électrique pour les actions.
- Typographies : Montserrat (titres), Inter (textes). Valeurs : confiance, engagement, disponibilité, transparence, innovation.
- Mission : simplifier l’accès aux services d’entretien, de réparation, de dépannage et d’assistance pour tous les moyens
  de transport motorisés. Vision : devenir la plateforme de référence en Côte d’Ivoire, puis en Afrique.

## Exigences fonctionnelles (cahier « DESIGN & INTERFACE »)

1. Trois espaces : client, mécanicien, administration. Responsive, priorité Android, PWA.
2. Technologies : React, TypeScript, Tailwind, Supabase (PostgreSQL, Auth, Storage, Edge Functions), GitHub.
3. Client : inscription/connexion (téléphone ou e-mail), profil, véhicules (marque, modèle, immatriculation), demande
   d’assistance, géolocalisation, photos, description, type de dépannage (mécanique, batterie, crevaison, remorquage,
   carburant, ouverture de véhicule, autres) ; prix proposé, accepter/refuser le devis, suivre le mécanicien, statut,
   historique, évaluation, support.
4. Mécanicien : inscription, profil pro, spécialités, zone, documents, **validation obligatoire**, disponibilité,
   demandes compatibles, accepter/refuser, statut de mission, historique, évaluations. Non validé ⇒ aucune mission.
5. Administration : statistiques, gestion des mécaniciens/clients/demandes, validation, attribution manuelle, tarifs,
   catégories, paiements, réclamations, évaluations, plusieurs niveaux d’autorisation.
6. Workflow en 12 étapes, statuts définis, changements non autorisés impossibles, intervention manuelle possible.
7. Tables : profiles, vehicles, mechanic_profiles, service_categories, service_requests, assignments, status_history,
   payments, reviews, notifications, support_tickets ; RLS ; aucune clé secrète dans le navigateur.
8. Intégrations à préparer sans les simuler : Orange Money, MTN MoMo, Wave, carte, Google Maps, push, SMS/OTP.
9. Pages : accueil, services, inscriptions client et mécanicien, connexion, tableaux de bord (3), demande d’assistance,
   suivi, profil, historique. Pas de boutons décoratifs.
10. Code modulaire, README, variables d’environnement, tests, pas de données fictives présentées comme réelles.

## Règles issues des documents projet

- Jamais de prix présenté comme garanti s’il est estimé ; devis final et supplément acceptés avant travaux.
- Code de confirmation à l’arrivée ; partage avec un proche ; bouton de signalement ; suspension rapide.
- Le SOS ne remplace pas les services d’urgence.
- Si personne n’accepte : élargir le rayon, proposer le support, prise en charge manuelle.
- Paiement initial direct au professionnel, tracé ; Mobile Money ensuite.
- Modèle : Garage Starter 0 F/mois + 12 % ; Garage Pro 10 000 F/mois + 5 % ; client gratuit.
- Facture/reçu : prestataire, client, date, véhicule, détail, montant, moyen, numéro unique ; commission calculée.
- Ne jamais marquer un paiement reçu sur une simple capture d’écran.

## Idées d’amélioration (sujet dédié)

- **Mon véhicule** : suivi des entretiens (ex. date de vidange) et alerte avant le prochain changement. ✅ livré
- **Mon assurance** : alerte avant expiration ✅ livré ; liste d’assureurs partenaires et inscription depuis l’application ⏭️
  (nécessite un partenariat avec un assureur agréé).

## Administratif (sujet « IMPÔT ET RÈGLEMENT ») — hors application

Registre de commerce, déclaration fiscale, demande manuscrite.
