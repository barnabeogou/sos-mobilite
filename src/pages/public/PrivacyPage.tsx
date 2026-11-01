import { Notice } from '@/components/ui/Display';
import { BRAND } from '@/config/env';

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-12 md:px-8">
      <h1 className="text-3xl font-extrabold">Données personnelles et localisation</h1>
      <Notice tone="warning" title="Document de travail">
        Ce texte décrit le fonctionnement de l’application. Les conditions générales et la politique de confidentialité définitives doivent
        être validées juridiquement en Côte d’Ivoire avant l’ouverture au public.
      </Notice>
      <section className="space-y-2 text-silver-300">
        <h2 className="text-xl font-bold text-white">Ce que nous collectons</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Votre nom, numéro de téléphone et adresse e-mail pour créer votre compte.</li>
          <li>Les informations de vos véhicules (marque, modèle, immatriculation) que vous choisissez d’enregistrer.</li>
          <li>Votre position au moment d’une demande d’assistance, uniquement après votre accord explicite.</li>
          <li>Les photos et la description de la panne que vous ajoutez.</li>
        </ul>
      </section>
      <section className="space-y-2 text-silver-300">
        <h2 className="text-xl font-bold text-white">Partage de votre position</h2>
        <p>
          Votre position est demandée au moment de la demande et sert uniquement à trouver les professionnels proches. Avant acceptation,
          les professionnels ne voient qu’une position approximative (environ 1 km) et aucune coordonnée personnelle. Seul le
          professionnel qui accepte la mission voit votre position précise et votre numéro.
        </p>
      </section>
      <section className="space-y-2 text-silver-300">
        <h2 className="text-xl font-bold text-white">Sécurité</h2>
        <p>
          Les accès sont limités par des règles de sécurité au niveau de la base de données : chaque client ne voit que ses propres
          informations, chaque professionnel uniquement les missions qui lui sont attribuées. Les documents justificatifs des
          professionnels ne sont consultables que par l’équipe de vérification.
        </p>
      </section>
      <section className="space-y-2 text-silver-300">
        <h2 className="text-xl font-bold text-white">Vos droits</h2>
        <p>
          Vous pouvez consulter et modifier vos informations depuis votre profil, et demander la suppression de votre compte via le support{' '}
          {BRAND.name}.
        </p>
      </section>
    </article>
  );
}
