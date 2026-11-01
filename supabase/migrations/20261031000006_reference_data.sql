-- =============================================================================
-- SOS MOBILITÉ — Données de référence (catalogue et paramètres)
--
-- Ce ne sont PAS des données d'exemple : ce sont les types d'assistance définis
-- dans le cahier des charges et les paramètres issus du plan financier.
-- Les tarifs indicatifs restent vides (NULL) tant que l'administration ne les
-- a pas fixés depuis le tableau de bord (Tarifs).
-- =============================================================================

insert into public.service_categories (slug, name, description, icon, vehicle_types, sort_order) values
  ('depannage_mecanique', 'Dépannage mécanique',
   'Le véhicule ne démarre pas, fait un bruit anormal ou affiche un voyant.',
   'wrench', array['auto','moto']::public.vehicle_type[], 10),
  ('batterie', 'Batterie déchargée',
   'Démarrage assisté, contrôle ou remplacement de la batterie.',
   'battery-charging', array['auto','moto']::public.vehicle_type[], 20),
  ('crevaison', 'Crevaison',
   'Pneu à plat, réparation ou changement de roue sur place.',
   'circle-dot', array['auto','moto']::public.vehicle_type[], 30),
  ('remorquage', 'Remorquage',
   'Transport du véhicule immobilisé vers un garage.',
   'truck', array['auto','moto']::public.vehicle_type[], 40),
  ('carburant', 'Panne de carburant',
   'Livraison de carburant pour repartir.',
   'fuel', array['auto','moto','marine']::public.vehicle_type[], 50),
  ('ouverture_vehicule', 'Ouverture de véhicule',
   'Clés enfermées ou perdues — selon les prestations autorisées et après vérification du propriétaire.',
   'key-round', array['auto']::public.vehicle_type[], 60),
  ('assistance_marine', 'Assistance nautique',
   'Jet-skis et bateaux : diagnostic, réparation et assistance.',
   'sailboat', array['marine']::public.vehicle_type[], 70),
  ('autre', 'Autres services',
   'Toute autre assistance liée à votre véhicule.',
   'circle-ellipsis', array['auto','moto','marine']::public.vehicle_type[], 90)
on conflict (slug) do nothing;

insert into public.platform_settings (key, value, description) values
  ('commission_rate_starter', '0.12', 'Commission sur les interventions — formule Garage Starter (0 FCFA/mois)'),
  ('commission_rate_pro', '0.05', 'Commission sur les interventions — formule Garage Pro'),
  ('pro_plan_monthly_fee', '10000', 'Abonnement mensuel Garage Pro (FCFA)'),
  ('proposal_timeout_minutes', '10', 'Durée de validité d''une proposition de mission (minutes)'),
  ('default_search_radius_km', '5', 'Rayon de recherche initial (km)'),
  ('max_search_radius_km', '30', 'Rayon de recherche maximal après élargissement (km)'),
  ('max_proposals_per_round', '10', 'Nombre maximal de professionnels sollicités par vague'),
  ('support_phone', 'null', 'Numéro du support affiché dans l''application (à renseigner)'),
  ('support_whatsapp', 'null', 'Numéro WhatsApp du support (à renseigner)'),
  ('support_email', 'null', 'Adresse e-mail du support (à renseigner)')
on conflict (key) do nothing;
