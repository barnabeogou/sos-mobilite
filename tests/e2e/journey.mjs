/**
 * Parcours de bout en bout (navigateur réel) contre le backend de test local :
 * inscription client & pro → validation admin → SOS → acceptation → devis → négociation du prix →
 * déplacement → code d'arrivée → fin → paiement → avis → reçu.
 * Prend des captures d'écran de chaque étape dans docs/captures/.
 *
 * Usage : APP=http://localhost:5173 DATABASE_URL=... node tests/e2e/journey.mjs
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import pg from 'pg';
import { mkdirSync } from 'node:fs';

const APP = process.env.APP ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'docs/captures';
mkdirSync(OUT, { recursive: true });
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
// Base de test vierge à chaque exécution
await db.query('truncate auth.users cascade');
await db.query('alter sequence public.request_ref_seq restart; alter sequence public.receipt_seq restart');

const browser = await chromium.launch();
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Africa/Abidjan' };
const desktop = { viewport: { width: 1360, height: 860 }, deviceScaleFactor: 1, locale: 'fr-FR', timezoneId: 'Africa/Abidjan' };

const errors = [];
async function newPage(opts, geo) {
  const ctx = await browser.newContext({ ...opts, ...(geo ? { geolocation: geo, permissions: ['geolocation'] } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/realtime|websocket|WebSocket|ERR_CONNECTION|storage|Failed to load resource/i.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return page;
}
let n = 0;
async function shot(page, name, fullPage = true) {
  await page.waitForTimeout(400);
  // CLEAN=1 : masque les barres fixes (en-tête, onglets, toasts) qui se répètent sur une capture pleine page
  const clean = process.env.CLEAN === '1' && fullPage;
  if (clean) {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('body *')) {
        const pos = getComputedStyle(el).position;
        if (pos === 'fixed' || pos === 'sticky') el.setAttribute('data-shot-hidden', el.style.visibility || ' ');
      }
      for (const el of document.querySelectorAll('[data-shot-hidden]')) el.style.visibility = 'hidden';
    });
  }
  n += 1;
  const file = `${OUT}/${String(n).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: file, fullPage });
  if (clean) {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-shot-hidden]')) {
        el.style.visibility = el.getAttribute('data-shot-hidden').trim();
        el.removeAttribute('data-shot-hidden');
      }
    });
  }
  console.log('📸', file);
}
const step = (s) => console.log(`\n▶ ${s}`);

const stamp = Date.now().toString(36);
const CLIENT = { name: 'Awa Koné', phone: '+225 07 11 22 33 44', email: `awa.${stamp}@test.local`, pw: 'Panne2026!' };
const MECH = { name: 'Yao Kouassi', business: 'Garage Yao Plateau', phone: '+225 05 66 77 88 99', email: `yao.${stamp}@test.local`, pw: 'Garage2026!' };
const ADMIN = { name: 'Équipe SOS', phone: '+225 01 00 00 00 00', email: `admin.${stamp}@test.local`, pw: 'Admin2026!' };

// ---------------------------------------------------------------------------
step('Accueil public');
const visitor = await newPage(mobile);
await visitor.goto(APP);
await visitor.getByRole('link', { name: /SOS — Signaler une panne/i }).first().waitFor();
await shot(visitor, 'accueil-mobile');
const visitorDesk = await newPage(desktop);
await visitorDesk.goto(APP);
await shot(visitorDesk, 'accueil-ordinateur', false);
await visitorDesk.goto(`${APP}/services`);
await shot(visitorDesk, 'services', false);

// ---------------------------------------------------------------------------
step('Inscription client');
const client = await newPage(mobile, { latitude: 5.325, longitude: -4.02, accuracy: 12 });
await client.goto(`${APP}/inscription`);
await client.getByLabel('Nom complet').fill(CLIENT.name);
await client.getByLabel('Téléphone').fill(CLIENT.phone);
await client.getByLabel('Adresse e-mail').fill(CLIENT.email);
await client.getByLabel('Commune').selectOption('Plateau');
await client.getByLabel('Mot de passe', { exact: true }).fill(CLIENT.pw);
await client.getByLabel('Confirmer le mot de passe').fill(CLIENT.pw);
await client.getByRole('checkbox').check();
await shot(client, 'inscription-client');
await client.getByRole('button', { name: 'Créer mon compte' }).click();
await client.waitForURL(`${APP}/client`);
await client.getByText('Salut Awa').first().waitFor();
await shot(client, 'client-accueil');

step('Mon véhicule');
await client.goto(`${APP}/client/vehicules`);
await client.getByRole('button', { name: 'Ajouter' }).first().click();
await client.getByLabel('Marque').fill('Toyota');
await client.getByLabel('Modèle').fill('Corolla');
await client.getByLabel('Année').fill('2016');
await client.getByLabel('Immatriculation').fill('1234 AB 01');
await client.getByLabel('Couleur').fill('Grise');
const in20 = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
await client.getByLabel('Fin de l’assurance').fill(in20);
await client.getByRole('button', { name: 'Enregistrer' }).click();
await client.getByText('Toyota Corolla').first().waitFor();
await client.getByRole('button', { name: 'Ajouter un entretien' }).click();
const ago85 = new Date(Date.now() - 85 * 86400000).toISOString().slice(0, 10);
await client.getByLabel('Date').fill(ago85);
await client.getByLabel('Kilométrage').fill('84500');
await client.getByLabel('Coût').fill('25000');
await client.getByRole('button', { name: 'Enregistrer' }).click();
await client.getByText(/Vidange à prévoir/).first().waitFor();
await shot(client, 'mon-vehicule');

// ---------------------------------------------------------------------------
step('Inscription professionnel');
const mech = await newPage(mobile, { latitude: 5.3197, longitude: -4.0167, accuracy: 8 });
await mech.goto(`${APP}/inscription/professionnel`);
await mech.getByLabel('Nom et prénom').fill(MECH.name);
await mech.getByLabel(/Nom du garage/).fill(MECH.business);
await mech.getByLabel('Téléphone professionnel').fill(MECH.phone);
await mech.getByLabel('Adresse e-mail').fill(MECH.email);
await mech.getByLabel('Commune principale d’intervention').selectOption('Plateau');
await mech.getByLabel('Mot de passe', { exact: true }).fill(MECH.pw);
await mech.getByLabel('Confirmer le mot de passe').fill(MECH.pw);
await mech.getByRole('checkbox').check();
await mech.getByRole('button', { name: 'Créer mon compte professionnel' }).click();
await mech.waitForURL(`${APP}/pro/profil`);

step('Profil professionnel');
await mech.getByLabel('Activité').selectOption('garage');
await mech.getByLabel('Années d’expérience').fill('12');
await mech.getByLabel('Adresse de l’atelier').fill('Avenue Chardy, Plateau');
await mech.getByLabel('Horaires').fill('Lun–Sam 7h–20h, urgences 24h/24');
await mech.getByRole('button', { name: 'Moto' }).click();
await mech.getByRole('button', { name: 'Batterie déchargée' }).click();
await mech.getByRole('button', { name: 'Dépannage mécanique' }).click();
await mech.getByRole('button', { name: 'Utiliser ma position' }).click();
await mech.getByText(/Position de base : 5\.3197/).first().waitFor();
await mech.getByRole('button', { name: 'Enregistrer le profil professionnel' }).click();
await mech.getByText('Profil professionnel enregistré.').first().waitFor();
await shot(mech, 'pro-profil');
await mech.goto(`${APP}/pro`);
await mech.getByText('En attente de validation').first().waitFor();
await shot(mech, 'pro-en-attente');

// ---------------------------------------------------------------------------
step('Administration : création du compte et validation');
const admin = await newPage(desktop);
await admin.goto(`${APP}/inscription`);
await admin.getByLabel('Nom complet').fill(ADMIN.name);
await admin.getByLabel('Téléphone').fill(ADMIN.phone);
await admin.getByLabel('Adresse e-mail').fill(ADMIN.email);
await admin.getByLabel('Mot de passe', { exact: true }).fill(ADMIN.pw);
await admin.getByLabel('Confirmer le mot de passe').fill(ADMIN.pw);
await admin.getByRole('checkbox').check();
await admin.getByRole('button', { name: 'Créer mon compte' }).click();
await admin.waitForURL(`${APP}/client`);
// Promotion du premier super administrateur (opération SQL documentée dans le README)
await db.query(`update public.profiles set role = 'admin', admin_level = 'super_admin' where email = $1`, [ADMIN.email]);
await admin.goto(`${APP}/admin`);
await admin.getByText('Vue d’ensemble').first().waitFor();
await admin.goto(`${APP}/admin/professionnels`);
await admin.getByText(MECH.business).click();
await admin.getByRole('button', { name: 'Valider le profil' }).click();
await shot(admin, 'admin-validation-pro', false);
await admin.getByRole('button', { name: 'Confirmer' }).click();
await admin.getByText('Profil vérifié').first().waitFor();

step('Professionnel disponible');
await mech.goto(`${APP}/pro`);
await mech.getByRole('button', { name: 'Me rendre disponible' }).click();
await mech.getByText(/Vous recevez les demandes compatibles/).first().waitFor();
await shot(mech, 'pro-disponible');

// ---------------------------------------------------------------------------
step('SOS client');
await client.goto(`${APP}/client`);
await client.waitForTimeout(500);
await shot(client, 'client-accueil-rappels');
await client.getByRole('link', { name: /SOS — Signaler une panne/i }).click();
await client.waitForURL(/\/client\/sos/);
await client.getByRole('button', { name: /Batterie déchargée/ }).click();
await shot(client, 'sos-etape-1');
await client.getByRole('button', { name: 'Continuer' }).click();
await client.getByRole('button', { name: 'Ne démarre pas' }).click();
await client.getByRole('button', { name: 'Voyant allumé' }).click();
await client.getByLabel('Décrivez la situation').fill('La voiture a calé au feu et ne redémarre plus. Le tableau de bord s’allume faiblement.');
await shot(client, 'sos-etape-2');
await client.getByRole('button', { name: 'Continuer' }).click();
await client.getByRole('button', { name: 'Utiliser ma position actuelle' }).click();
await client.getByText('Position trouvée').first().waitFor();
await client.getByLabel('Repère pour vous trouver').fill('Devant la pharmacie du Plateau, à côté de la station');
await client.getByRole('checkbox').check();
await shot(client, 'sos-etape-3');
await client.getByRole('button', { name: 'Trouver un mécano' }).click();
await client.waitForURL(/\/client\/demandes\//);
const requestUrl = client.url();
await client.getByText(/professionnel contacté/).first().waitFor();
await shot(client, 'suivi-recherche');

// ---------------------------------------------------------------------------
step('Le professionnel accepte et envoie son devis');
await mech.goto(`${APP}/pro`);
await mech.getByText('Batterie déchargée').first().waitFor();
await shot(mech, 'pro-proposition');
await mech.getByRole('button', { name: 'Accepter' }).click();
await mech.waitForURL(/\/pro\/missions\//);
await mech.getByLabel('Diagnostic & main-d’œuvre').fill('12000');
await mech.getByLabel('Pièces').fill('38000');
await mech.getByLabel('Déplacement').fill('2000');
await mech.getByLabel('Délai d’arrivée estimé').fill('15');
await mech.getByLabel('Précisions pour le client').fill('Batterie 60 Ah neuve fournie et posée, test de charge inclus.');
await shot(mech, 'pro-devis');
await mech.getByRole('button', { name: 'Envoyer le devis' }).click();
await mech.getByText('Devis envoyé — en attente du client').first().waitFor();

step('Négociation du prix');
await client.goto(requestUrl);
await client.getByText('Devis proposé').first().waitFor();
await shot(client, 'client-devis');
await client.getByRole('button', { name: 'Proposer un prix' }).click();
await client.getByLabel('Votre prix').fill('45000');
await client.getByLabel(/Message au professionnel/).fill('Je peux régler 45 000 F en espèces dès votre arrivée.');
await shot(client, 'client-contre-proposition');
await client.getByRole('button', { name: 'Envoyer ma proposition' }).click();
await client.getByText('Votre proposition : 45 000 FCFA').first().waitFor();

await mech.reload();
await mech.getByText('Le client propose 45 000 FCFA').first().waitFor();
await shot(mech, 'pro-contre-proposition');
await mech.getByRole('button', { name: 'Garder mon prix' }).click();
await mech.getByText('Vous maintenez votre prix.').first().waitFor();

await client.reload();
await client.getByText('Le professionnel maintient son prix').first().waitFor();
await shot(client, 'client-prix-maintenu');
await client.getByRole('button', { name: 'Proposer un prix' }).click();
await client.getByLabel('Votre prix').fill('48000');
await client.getByRole('button', { name: 'Envoyer ma proposition' }).click();
await client.getByText('Votre proposition : 48 000 FCFA').first().waitFor();

await mech.reload();
await mech.getByRole('button', { name: 'Accepter 48 000 FCFA' }).click();
await mech.getByText('Prix négocié validé').first().waitFor();
await shot(mech, 'pro-prix-negocie');

step('Le client voit le prix négocié validé');
await client.reload();
await client.getByText('Prix négocié validé').first().waitFor();
await shot(client, 'client-prix-negocie');

step('Déplacement et code d’arrivée');
await mech.reload();
await mech.getByRole('button', { name: 'Je pars chez le client' }).click();
await mech.getByText('Arrivé sur place ?').first().waitFor();
await client.reload();
await client.getByText('Code de confirmation d’arrivée').first().waitFor();
const code = (await client.getByTestId('arrival-code').innerText()).trim();
await shot(client, 'client-code-arrivee');
await mech.getByLabel('Code d’arrivée').fill('0000' === code ? '1111' : '0000');
await mech.getByRole('button', { name: 'Valider' }).click();
await mech.getByText(/Code incorrect/).first().waitFor();
await mech.getByLabel('Code d’arrivée').fill(code);
await mech.getByRole('button', { name: 'Valider' }).click();
await mech.getByText('Intervention en cours').first().waitFor();
await shot(mech, 'pro-intervention');

step('Fin de mission et paiement');
await mech.getByRole('button', { name: 'Terminer la mission' }).click();
await mech.getByText('Montant à encaisser').first().waitFor();
await mech.getByLabel('Moyen de paiement').selectOption('wave');
await mech.getByRole('button', { name: 'J’ai reçu le paiement' }).click();
await mech.getByText(/En attente de la confirmation du client/).first().waitFor();
await shot(mech, 'pro-paiement-declare');

await client.reload();
await client.getByText('Confirmer la fin de l’intervention').first().waitFor();
await shot(client, 'client-confirmation');
await client.getByRole('button', { name: 'Tout est en ordre' }).click();
await client.getByText('Évaluez la prestation').first().waitFor();
await client.getByRole('radio', { name: '5 sur 5' }).click();
await client.getByPlaceholder('Un commentaire ? (facultatif)').fill('Arrivé en 15 minutes, prix discuté et respecté. Merci !');
await client.getByRole('button', { name: 'Envoyer mon avis' }).click();
await client.getByText('Votre évaluation').first().waitFor();
await shot(client, 'client-intervention-terminee');
await client.getByRole('link', { name: 'Reçu' }).click();
await client.getByText(/REC-\d{4}-\d{6}/).first().waitFor();
await shot(client, 'recu');

// ---------------------------------------------------------------------------
step('Tableaux de bord');
await mech.goto(`${APP}/pro/paiements`);
await mech.getByText('Formules professionnelles').first().waitFor();
await shot(mech, 'pro-gains');
await admin.goto(`${APP}/admin`);
await admin.getByText('Interventions terminées').first().waitFor();
await shot(admin, 'admin-vue-ensemble', false);
await admin.goto(`${APP}/admin/demandes?x=1`);
await admin.getByRole('combobox', { name: 'Statut' }).selectOption('all');
await admin.getByText('Batterie déchargée').first().click();
await admin.getByText('Historique').first().waitFor();
await shot(admin, 'admin-detail-demande');
await admin.goto(`${APP}/admin/parametres`);
await admin.getByText('Catégories de services').first().waitFor();
await shot(admin, 'admin-tarifs', false);

// Vérification en base
const { rows } = await db.query(
  `select r.status, p.amount, p.commission_amount, p.receipt_number, m.rating_avg, m.completed_missions
     from service_requests r join payments p on p.request_id = r.id join mechanic_profiles m on m.id = r.assigned_mechanic_id
    order by r.created_at desc limit 1`,
);
console.log('\nÉtat final en base :', rows[0]);
// Devis de 52 000 F négocié à 48 000 F ; commission Starter 12 % → 5 760 F
if (rows[0].status !== 'closed' || rows[0].amount !== 48000 || rows[0].commission_amount !== 5760) throw new Error('État final inattendu');

await browser.close();
await db.end();
if (errors.length) {
  console.log('\n⚠️ Erreurs navigateur :\n' + errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('\n✅ Parcours complet réussi, aucune erreur navigateur.');
}
