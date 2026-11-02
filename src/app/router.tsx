import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import {
  BadgeDollarSign,
  CarFront,
  ClipboardList,
  Gauge,
  History,
  LayoutDashboard,
  LifeBuoy,
  MessageSquareWarning,
  Settings2,
  Siren,
  Star,
  UserRound,
  Users,
  UsersRound,
  Wrench,
} from 'lucide-react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AppShell, type NavItem } from '@/components/layout/AppShell';
import { RedirectIfAuthenticated, RequireRole } from '@/components/layout/Guards';
import { LoadingBlock } from '@/components/ui/Display';
import { HomePage } from '@/pages/public/HomePage';
import { NotFoundPage } from '@/pages/public/NotFoundPage';

const S = (el: ReactNode) => <Suspense fallback={<LoadingBlock />}>{el}</Suspense>;

// Pages publiques secondaires & authentification
const ServicesPage = lazy(() => import('@/pages/public/ServicesPage'));
const PhotoCreditsPage = lazy(() => import('@/pages/public/PhotoCreditsPage'));
const PrivacyPage = lazy(() => import('@/pages/public/PrivacyPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const ClientSignUpPage = lazy(() => import('@/pages/auth/ClientSignUpPage'));
const MechanicSignUpPage = lazy(() => import('@/pages/auth/MechanicSignUpPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));

// Espace client
const ClientHome = lazy(() => import('@/pages/client/ClientHome'));
const NewRequestPage = lazy(() => import('@/pages/client/NewRequestPage'));
const RequestTrackingPage = lazy(() => import('@/pages/client/RequestTrackingPage'));
const ClientHistoryPage = lazy(() => import('@/pages/client/ClientHistoryPage'));
const NearbyMechanicsPage = lazy(() => import('@/pages/client/NearbyMechanicsPage'));
const MyVehiclesPage = lazy(() => import('@/pages/client/MyVehiclesPage'));

// Partagé
const ProfilePage = lazy(() => import('@/pages/shared/ProfilePage'));
const SupportPage = lazy(() => import('@/pages/shared/SupportPage'));
const ReceiptPage = lazy(() => import('@/pages/shared/ReceiptPage'));

// Espace professionnel
const MechanicHome = lazy(() => import('@/pages/mechanic/MechanicHome'));
const MechanicMissionsPage = lazy(() => import('@/pages/mechanic/MechanicMissionsPage'));
const MissionDetailPage = lazy(() => import('@/pages/mechanic/MissionDetailPage'));
const MechanicEarningsPage = lazy(() => import('@/pages/mechanic/MechanicEarningsPage'));
const MechanicReviewsPage = lazy(() => import('@/pages/mechanic/MechanicReviewsPage'));
const MechanicProfilePage = lazy(() => import('@/pages/mechanic/MechanicProfilePage'));

// Administration
const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview'));
const AdminRequests = lazy(() => import('@/pages/admin/AdminRequests'));
const AdminRequestDetail = lazy(() => import('@/pages/admin/AdminRequestDetail'));
const AdminMechanics = lazy(() => import('@/pages/admin/AdminMechanics'));
const AdminMechanicDetail = lazy(() => import('@/pages/admin/AdminMechanicDetail'));
const AdminClients = lazy(() => import('@/pages/admin/AdminClients'));
const AdminPayments = lazy(() => import('@/pages/admin/AdminPayments'));
const AdminTickets = lazy(() => import('@/pages/admin/AdminTickets'));
const AdminReviews = lazy(() => import('@/pages/admin/AdminReviews'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));
const AdminTeam = lazy(() => import('@/pages/admin/AdminTeam'));

const clientNav: NavItem[] = [
  { to: '/client', label: 'SOS', icon: Siren, end: true, highlight: true },
  { to: '/client/mecaniciens', label: 'Mécanos', icon: UsersRound },
  { to: '/client/historique', label: 'Interventions', icon: ClipboardList },
  { to: '/client/vehicules', label: 'Véhicules', icon: CarFront },
  { to: '/client/profil', label: 'Profil', icon: UserRound },
];

const mechanicNav: NavItem[] = [
  { to: '/pro', label: 'Accueil', icon: Gauge, end: true },
  { to: '/pro/missions', label: 'Missions', icon: Wrench },
  { to: '/pro/paiements', label: 'Gains', icon: BadgeDollarSign },
  { to: '/pro/avis', label: 'Avis', icon: Star },
  { to: '/pro/profil', label: 'Profil', icon: UserRound },
];

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Vue d’ensemble', icon: LayoutDashboard, end: true },
  { to: '/admin/demandes', label: 'Demandes', icon: ClipboardList },
  { to: '/admin/professionnels', label: 'Professionnels', icon: Wrench },
  { to: '/admin/clients', label: 'Clients', icon: Users },
  { to: '/admin/paiements', label: 'Paiements', icon: BadgeDollarSign },
  { to: '/admin/reclamations', label: 'Réclamations', icon: MessageSquareWarning },
  { to: '/admin/avis', label: 'Évaluations', icon: Star },
  { to: '/admin/parametres', label: 'Tarifs & paramètres', icon: Settings2 },
  { to: '/admin/equipe', label: 'Équipe', icon: LifeBuoy },
];

// Sur mobile, l'admin garde les 5 entrées principales dans la barre d'onglets.
const adminMobileNav = adminNav.slice(0, 4).concat({ to: '/admin/reclamations', label: 'Support', icon: History });

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/services', element: S(<ServicesPage />) },
      { path: '/confidentialite', element: S(<PrivacyPage />) },
      { path: '/credits-photos', element: S(<PhotoCreditsPage />) },
    ],
  },
  { path: '/connexion', element: S(<RedirectIfAuthenticated><LoginPage /></RedirectIfAuthenticated>) },
  { path: '/inscription', element: S(<RedirectIfAuthenticated><ClientSignUpPage /></RedirectIfAuthenticated>) },
  { path: '/inscription/professionnel', element: S(<RedirectIfAuthenticated><MechanicSignUpPage /></RedirectIfAuthenticated>) },
  { path: '/mot-de-passe-oublie', element: S(<ForgotPasswordPage />) },
  { path: '/nouveau-mot-de-passe', element: S(<ResetPasswordPage />) },
  {
    path: '/client',
    element: (
      <RequireRole role="client">
        <AppShell nav={clientNav} homePath="/client" />
      </RequireRole>
    ),
    children: [
      { index: true, element: S(<ClientHome />) },
      { path: 'sos', element: S(<NewRequestPage />) },
      { path: 'demandes/:id', element: S(<RequestTrackingPage />) },
      { path: 'historique', element: S(<ClientHistoryPage />) },
      { path: 'mecaniciens', element: S(<NearbyMechanicsPage />) },
      { path: 'vehicules', element: S(<MyVehiclesPage />) },
      { path: 'profil', element: S(<ProfilePage />) },
      { path: 'support', element: S(<SupportPage />) },
      { path: 'recus/:id', element: S(<ReceiptPage />) },
    ],
  },
  {
    path: '/pro',
    element: (
      <RequireRole role="mechanic">
        <AppShell nav={mechanicNav} homePath="/pro" />
      </RequireRole>
    ),
    children: [
      { index: true, element: S(<MechanicHome />) },
      { path: 'missions', element: S(<MechanicMissionsPage />) },
      { path: 'missions/:id', element: S(<MissionDetailPage />) },
      { path: 'paiements', element: S(<MechanicEarningsPage />) },
      { path: 'avis', element: S(<MechanicReviewsPage />) },
      { path: 'profil', element: S(<MechanicProfilePage />) },
      { path: 'support', element: S(<SupportPage />) },
      { path: 'recus/:id', element: S(<ReceiptPage />) },
    ],
  },
  {
    path: '/admin',
    element: (
      <RequireRole role="admin">
        <AdminShell />
      </RequireRole>
    ),
    children: [
      { index: true, element: S(<AdminOverview />) },
      { path: 'demandes', element: S(<AdminRequests />) },
      { path: 'demandes/:id', element: S(<AdminRequestDetail />) },
      { path: 'professionnels', element: S(<AdminMechanics />) },
      { path: 'professionnels/:id', element: S(<AdminMechanicDetail />) },
      { path: 'clients', element: S(<AdminClients />) },
      { path: 'paiements', element: S(<AdminPayments />) },
      { path: 'reclamations', element: S(<AdminTickets />) },
      { path: 'avis', element: S(<AdminReviews />) },
      { path: 'parametres', element: S(<AdminSettings />) },
      { path: 'equipe', element: S(<AdminTeam />) },
      { path: 'recus/:id', element: S(<ReceiptPage />) },
    ],
  },
  { path: '/espace', element: <Navigate to="/connexion" replace /> },
  { path: '*', element: <NotFoundPage /> },
], {
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});

function AdminShell() {
  // Navigation complète sur ordinateur ; raccourcis sur mobile.
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
  return <AppShell nav={isDesktop ? adminNav : adminMobileNav} homePath="/admin" />;
}
