import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuth';
import { HomePage } from '@/pages/public/HomePage';
import { StatusTimeline } from '@/components/requests/RequestParts';
import { NotConfigured } from '@/components/layout/Guards';
import { errorMessage } from '@/lib/errors';

function wrap(ui: React.ReactNode) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('interface', () => {
  it('la page d’accueil met en avant le SOS et le slogan officiel', () => {
    render(wrap(<HomePage />));
    expect(screen.getByRole('link', { name: /SOS — Signaler une panne/i })).toBeInTheDocument();
    expect(screen.getByText('Votre tranquillité, notre engagement.')).toBeInTheDocument();
    expect(screen.getAllByText(/SOS/).length).toBeGreaterThan(3);
  });

  it('sans base configurée, affiche un écran de configuration (aucune donnée simulée)', () => {
    render(wrap(<NotConfigured />));
    expect(screen.getByText('Base de données non connectée')).toBeInTheDocument();
  });

  it('la frise marque les étapes franchies', () => {
    render(<StatusTimeline status="en_route" history={[]} />);
    expect(screen.getByText('En route')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
  });

  it('traduit les erreurs métier SQL en français', () => {
    expect(errorMessage({ message: 'MECHANIC_BUSY' })).toMatch(/mission en cours/);
    expect(errorMessage({ message: 'X', hint: 'Demande introuvable.' })).toBe('Demande introuvable.');
    expect(errorMessage({ message: 'Invalid login credentials' })).toBe('E-mail ou mot de passe incorrect.');
    expect(errorMessage({ message: 'new row violates row-level security policy' })).toBe('Action non autorisée.');
  });
});
