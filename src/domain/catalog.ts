import type {
  DocumentType,
  MaintenanceKind,
  MechanicKind,
  PaymentMethod,
  TicketCategory,
  VehicleType,
} from '@/types/database';

export const VEHICLE_TYPES: { value: VehicleType; label: string; brand: string; description: string }[] = [
  { value: 'auto', label: 'Auto', brand: 'SOS AUTO', description: 'Voitures, VTC, taxis, utilitaires' },
  { value: 'moto', label: 'Moto', brand: 'SOS MOTO', description: 'Motos, scooters, livreurs' },
  { value: 'marine', label: 'Marine', brand: 'SOS MARINE', description: 'Jet-skis et bateaux' },
];

export const vehicleTypeLabel = (t: VehicleType) => VEHICLE_TYPES.find((v) => v.value === t)?.label ?? t;

/**
 * Catalogue de référence (identique à la migration 20261031000006).
 * Sert uniquement à l'affichage des pages publiques lorsque la base n'est pas joignable.
 */
export const REFERENCE_SERVICES: { slug: string; name: string; description: string; icon: string; vehicle_types: VehicleType[] }[] = [
  { slug: 'depannage_mecanique', name: 'Dépannage mécanique', description: 'Le véhicule ne démarre pas, fait un bruit anormal ou affiche un voyant.', icon: 'wrench', vehicle_types: ['auto', 'moto'] },
  { slug: 'batterie', name: 'Batterie déchargée', description: 'Démarrage assisté, contrôle ou remplacement de la batterie.', icon: 'battery-charging', vehicle_types: ['auto', 'moto'] },
  { slug: 'crevaison', name: 'Crevaison', description: 'Pneu à plat, réparation ou changement de roue sur place.', icon: 'circle-dot', vehicle_types: ['auto', 'moto'] },
  { slug: 'remorquage', name: 'Remorquage', description: 'Transport du véhicule immobilisé vers un garage.', icon: 'truck', vehicle_types: ['auto', 'moto'] },
  { slug: 'carburant', name: 'Panne de carburant', description: 'Livraison de carburant pour repartir.', icon: 'fuel', vehicle_types: ['auto', 'moto', 'marine'] },
  { slug: 'ouverture_vehicule', name: 'Ouverture de véhicule', description: 'Clés enfermées ou perdues — selon les prestations autorisées et après vérification du propriétaire.', icon: 'key-round', vehicle_types: ['auto'] },
  { slug: 'assistance_marine', name: 'Assistance nautique', description: 'Jet-skis et bateaux : diagnostic, réparation et assistance.', icon: 'sailboat', vehicle_types: ['marine'] },
  { slug: 'autre', name: 'Autres services', description: 'Toute autre assistance liée à votre véhicule.', icon: 'circle-ellipsis', vehicle_types: ['auto', 'moto', 'marine'] },
];

/** Raccourcis du tableau de bord client (maquette : Batterie, Pneu crevé, Remorquage). */
export const QUICK_SERVICES = ['batterie', 'crevaison', 'remorquage'] as const;

export const SYMPTOMS: { value: string; label: string; icon: string }[] = [
  { value: 'ne_demarre_pas', label: 'Ne démarre pas', icon: 'car' },
  { value: 'bruit_anormal', label: 'Bruit anormal', icon: 'activity' },
  { value: 'voyant_allume', label: 'Voyant allumé', icon: 'gauge' },
  { value: 'fumee', label: 'Fumée', icon: 'wind' },
  { value: 'pneu_a_plat', label: 'Pneu à plat', icon: 'circle-dot' },
  { value: 'plus_essence', label: 'Plus d’essence', icon: 'fuel' },
  { value: 'batterie_faible', label: 'Batterie faible', icon: 'battery-low' },
  { value: 'surchauffe', label: 'Surchauffe', icon: 'thermometer' },
  { value: 'cles_enfermees', label: 'Clés enfermées', icon: 'key-round' },
  { value: 'accident_leger', label: 'Choc léger', icon: 'triangle-alert' },
  { value: 'autre', label: 'Autre', icon: 'circle-ellipsis' },
];

export const symptomLabel = (v: string) => SYMPTOMS.find((s) => s.value === v)?.label ?? v;

/** Communes du district d'Abidjan (zone pilote). */
export const ABIDJAN_COMMUNES = [
  'Abobo',
  'Adjamé',
  'Anyama',
  'Attécoubé',
  'Bingerville',
  'Cocody',
  'Koumassi',
  'Marcory',
  'Plateau',
  'Port-Bouët',
  'Songon',
  'Treichville',
  'Yopougon',
] as const;

export const MECHANIC_KINDS: { value: MechanicKind; label: string; description: string }[] = [
  { value: 'independant', label: 'Mécanicien indépendant', description: 'Intervention mobile sur place' },
  { value: 'garage', label: 'Garage', description: 'Atelier avec adresse fixe' },
  { value: 'depanneur', label: 'Dépanneur / remorqueur', description: 'Véhicule de remorquage' },
];

export const mechanicKindLabel = (k: MechanicKind) => MECHANIC_KINDS.find((m) => m.value === k)?.label ?? k;

/**
 * Moyens de paiement.
 * Phase 1 : le paiement se fait directement au professionnel (espèces ou mobile money
 * hors application) puis est confirmé dans l'application. Aucun paiement en ligne n'est
 * simulé : `online` indique si une intégration réelle est branchée (aucune à ce jour).
 */
export const PAYMENT_METHODS: { value: PaymentMethod; label: string; short: string }[] = [
  { value: 'cash', label: 'Espèces', short: 'Espèces' },
  { value: 'orange_money', label: 'Orange Money (hors application)', short: 'Orange Money' },
  { value: 'mtn_momo', label: 'MTN Mobile Money (hors application)', short: 'MTN MoMo' },
  { value: 'wave', label: 'Wave (hors application)', short: 'Wave' },
  { value: 'card', label: 'Carte bancaire (terminal du professionnel)', short: 'Carte' },
  { value: 'other', label: 'Autre', short: 'Autre' },
];

export const paymentMethodLabel = (m: PaymentMethod) => PAYMENT_METHODS.find((p) => p.value === m)?.short ?? m;

export const MAINTENANCE_KINDS: { value: MaintenanceKind; label: string; defaultIntervalDays: number | null }[] = [
  { value: 'vidange', label: 'Vidange', defaultIntervalDays: 90 },
  { value: 'pneus', label: 'Pneus', defaultIntervalDays: 365 },
  { value: 'batterie', label: 'Batterie', defaultIntervalDays: 730 },
  { value: 'freins', label: 'Freins', defaultIntervalDays: 365 },
  { value: 'revision', label: 'Révision générale', defaultIntervalDays: 365 },
  { value: 'assurance', label: 'Assurance', defaultIntervalDays: 365 },
  { value: 'autre', label: 'Autre', defaultIntervalDays: null },
];

export const maintenanceLabel = (k: MaintenanceKind) => MAINTENANCE_KINDS.find((m) => m.value === k)?.label ?? k;

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'piece_identite', label: 'Pièce d’identité' },
  { value: 'registre_commerce', label: 'Registre de commerce / patente' },
  { value: 'photo_atelier', label: 'Photo de l’atelier ou du véhicule de service' },
  { value: 'attestation', label: 'Attestation / référence professionnelle' },
  { value: 'autre', label: 'Autre document' },
];

export const documentTypeLabel = (d: DocumentType) => DOCUMENT_TYPES.find((x) => x.value === d)?.label ?? d;

export const TICKET_CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'intervention', label: 'Intervention' },
  { value: 'paiement', label: 'Paiement' },
  { value: 'litige', label: 'Litige' },
  { value: 'compte', label: 'Mon compte' },
  { value: 'securite', label: 'Sécurité' },
  { value: 'autre', label: 'Autre' },
];

export const CANCELLATION_RULE =
  'Vous pouvez annuler gratuitement tant que le professionnel n’est pas en route. Une fois en route, des frais de déplacement peuvent être demandés selon le devis validé.';

export const EMERGENCY_NOTICE =
  'Le SOS de l’application ne remplace pas les services d’urgence. En cas de blessés ou de danger immédiat, appelez les secours : Police 170 / 110 / 111, Pompiers 180, Assistance médicale (SAMU) 185.';
