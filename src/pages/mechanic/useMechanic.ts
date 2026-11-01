import { useQuery } from '@tanstack/react-query';
import { useProfile } from '@/hooks/useAuth';
import { getMyMechanicProfile, listMyDocuments, listMySpecialties } from '@/services/mechanic.service';

export function useMechanicProfile() {
  const profile = useProfile();
  return useQuery({ queryKey: ['mechanic-profile', profile.id], queryFn: () => getMyMechanicProfile(profile.id) });
}

export function useMySpecialties() {
  const profile = useProfile();
  return useQuery({ queryKey: ['my-specialties', profile.id], queryFn: () => listMySpecialties(profile.id) });
}

export function useMyDocuments() {
  const profile = useProfile();
  return useQuery({ queryKey: ['my-documents', profile.id], queryFn: () => listMyDocuments(profile.id) });
}

/** Étapes nécessaires avant de pouvoir recevoir des missions. */
export function useOnboardingChecklist() {
  const mech = useMechanicProfile();
  const specs = useMySpecialties();
  const docs = useMyDocuments();
  const items = [
    { key: 'zone', label: 'Position de base et rayon d’intervention', done: Boolean(mech.data?.base_lat && mech.data?.base_lng) },
    { key: 'specialties', label: 'Au moins une spécialité', done: (specs.data?.length ?? 0) > 0 },
    { key: 'documents', label: 'Documents justificatifs déposés', done: (docs.data?.length ?? 0) > 0 },
    { key: 'verified', label: 'Validation par l’équipe SOS MOBILITÉ', done: mech.data?.verification_status === 'approved' },
  ];
  return { items, loading: mech.isLoading || specs.isLoading || docs.isLoading, complete: items.every((i) => i.done) };
}
