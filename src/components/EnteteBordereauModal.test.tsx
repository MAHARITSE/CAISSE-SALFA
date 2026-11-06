import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnteteBordereauModal } from './EnteteBordereauModal';
import { enteteParDefaut } from '../utils/entete';

const ouvrir = () => {
  const onEnregistrer = vi.fn();
  render(<EnteteBordereauModal entetes={enteteParDefaut()} onEnregistrer={onEnregistrer} onFermer={vi.fn()} />);
  return { onEnregistrer, modale: screen.getByRole('dialog', { name: 'En-tête des bordereaux' }) };
};

describe('éditeur d’en-tête', () => {
  it('conserve la casse saisie dans le champ, son aperçu et les données enregistrées', async () => {
    const user = userEvent.setup();
    const { onEnregistrer, unmount } = (() => {
      const onEnregistrer = vi.fn();
      const rendu = render(<EnteteBordereauModal entetes={enteteParDefaut()} onEnregistrer={onEnregistrer} onFermer={vi.fn()} />);
      return { onEnregistrer, unmount: rendu.unmount };
    })();
    await user.click(screen.getByLabelText(/^Ligne 7/));
    const champ = screen.getByLabelText('Texte de la ligne 7');
    await user.clear(champ);
    const adresse = 'E-mail : Contact.Salfa@example.org';
    await user.type(champ, adresse);
    expect(champ).toHaveValue(adresse);
    expect(champ).toHaveAttribute('autocapitalize', 'off');
    expect(champ).toHaveStyle({ textTransform: 'none', fontVariant: 'normal' });
    await user.click(screen.getByLabelText(/^Ligne 1/));
    const apercu = screen.getByLabelText(/^Ligne 7/);
    expect(apercu).toHaveTextContent(adresse);
    expect(apercu).toHaveStyle({ textTransform: 'none', fontVariant: 'normal' });
    await user.click(screen.getByRole('button', { name: 'Enregistrer l’en-tête' }));
    const enregistre = onEnregistrer.mock.calls[0][0];
    expect(enregistre.lignes[6].texte).toBe(adresse);
    unmount();
    render(<EnteteBordereauModal entetes={enregistre} onEnregistrer={vi.fn()} onFermer={vi.fn()} />);
    await user.click(screen.getByLabelText(/^Ligne 7/));
    expect(screen.getByLabelText('Texte de la ligne 7')).toHaveValue(adresse);
  });

  it('règle la police, la taille et le style de la ligne choisie', async () => {
    const user = userEvent.setup();
    const { onEnregistrer } = ouvrir();

    // La première ligne est celle qui est ouverte à l'arrivée.
    const texte = screen.getByLabelText('Texte de la ligne 1');
    await user.clear(texte);
    await user.type(texte, 'CAISSE CENTRALE');
    await user.selectOptions(screen.getByLabelText('Police'), 'Georgia');

    const taille = screen.getByLabelText('Taille en points');
    await user.clear(taille);
    await user.type(taille, '14');
    // La première ligne du modèle est déjà en gras : on ne clique pas dessus.
    await user.click(screen.getByRole('button', { name: 'Italique' }));
    await user.click(screen.getByRole('button', { name: 'Aligner à droite' }));

    await user.click(screen.getByRole('button', { name: 'Enregistrer l’en-tête' }));
    expect(onEnregistrer).toHaveBeenCalledTimes(1);
    const enregistre = onEnregistrer.mock.calls[0][0];
    expect(enregistre.lignes[0]).toMatchObject({
      texte: 'CAISSE CENTRALE', police: 'Georgia', taille: 14,
      gras: true, italique: true, alignement: 'droite',
    });
    // Les autres lignes gardent leur mise en forme d'origine.
    expect(enregistre.lignes[1]).toMatchObject({ texte: '(ÉGLISE LUTHERIENNE MALGACHE - MALAGASY LUTHERAN CHURCH)', police: 'Arial' });
  });

  it('ajoute, réordonne et supprime des lignes', async () => {
    const user = userEvent.setup();
    const { onEnregistrer } = ouvrir();
    const avant = enteteParDefaut().lignes.length;

    await user.click(screen.getByRole('button', { name: /Ajouter une ligne/ }));
    await user.type(screen.getByLabelText('Texte de la ligne 8'), 'LIGNE AJOUTEE');
    await user.click(screen.getByRole('button', { name: 'Monter la ligne 8' }));
    await user.click(screen.getByRole('button', { name: 'Supprimer la ligne 1' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer l’en-tête' }));

    const lignes = onEnregistrer.mock.calls[0][0].lignes;
    expect(lignes).toHaveLength(avant);
    // La ligne ajoutée est remontée d'un cran, puis la première ligne disparaît.
    expect(lignes[lignes.length - 2].texte).toBe('LIGNE AJOUTEE');
    expect(lignes[0].texte).toBe('(ÉGLISE LUTHERIENNE MALGACHE - MALAGASY LUTHERAN CHURCH)');
  });

  it('place les images librement et permet de les régler au millimètre', async () => {
    const user = userEvent.setup();
    const { onEnregistrer, modale } = ouvrir();

    // Les deux logos livrés sont sur la feuille.
    expect(modale.querySelectorAll('.entete-feuille__image')).toHaveLength(2);
    await user.click(modale.querySelectorAll('.entete-feuille__image')[0]);
    const gauche = screen.getByLabelText('Gauche (mm)');
    await user.clear(gauche);
    await user.type(gauche, '25');
    const largeur = screen.getByLabelText('Largeur (mm)');
    await user.clear(largeur);
    await user.type(largeur, '30');

    await user.click(screen.getByRole('button', { name: 'Enregistrer l’en-tête' }));
    const images = onEnregistrer.mock.calls[0][0].images;
    expect(images[0]).toMatchObject({ x: 25, largeur: 30 });
    // Le second logo n'a pas bougé.
    expect(images[1]).toMatchObject({ x: 181, largeur: 18 });
  });

  it('retire une image et restaure l’en-tête fourni', async () => {
    const user = userEvent.setup();
    const { onEnregistrer, modale } = ouvrir();

    await user.click(modale.querySelectorAll('.entete-feuille__image')[0]);
    await user.click(screen.getByRole('button', { name: /Retirer/ }));
    expect(modale.querySelectorAll('.entete-feuille__image')).toHaveLength(1);

    // « Restaurer » ramène les deux logos livrés.
    await user.click(screen.getByRole('button', { name: /Restaurer l’en-tête fourni/ }));
    expect(modale.querySelectorAll('.entete-feuille__image')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Enregistrer l’en-tête' }));
    expect(onEnregistrer.mock.calls[0][0].images).toHaveLength(2);
  });

  it('écrit sur la feuille elle-même, sans liste intermédiaire', async () => {
    const user = userEvent.setup();
    const { onEnregistrer, modale } = ouvrir();

    // Plus de liste de lignes : la feuille porte directement les champs.
    expect(modale.querySelectorAll('.entete-ligne')).toHaveLength(enteteParDefaut().lignes.length);

    // On clique la troisième ligne de la feuille et on tape dedans.
    await user.click(screen.getByLabelText(/^Ligne 3/));
    const champ = screen.getByLabelText('Texte de la ligne 3');
    await user.clear(champ);
    await user.type(champ, 'SYNODE FIHERENANA{Enter}');
    // Entrée ouvre la ligne suivante, déjà prête à recevoir le texte.
    expect(screen.getByLabelText('Texte de la ligne 4')).toHaveFocus();
    await user.type(screen.getByLabelText('Texte de la ligne 4'), 'NOUVELLE LIGNE');

    await user.click(screen.getByRole('button', { name: 'Enregistrer l’en-tête' }));
    const lignes = onEnregistrer.mock.calls[0][0].lignes;
    expect(lignes[2].texte).toBe('SYNODE FIHERENANA');
    expect(lignes[3].texte).toBe('NOUVELLE LIGNE');
  });

  it('met en forme la ligne ouverte depuis la barre de la feuille', async () => {
    const user = userEvent.setup();
    const { onEnregistrer } = ouvrir();

    await user.click(screen.getByLabelText(/^Ligne 4/));
    await user.selectOptions(screen.getByLabelText('Police'), 'Georgia');
    await user.click(screen.getByRole('button', { name: 'Centrer' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer l’en-tête' }));

    expect(onEnregistrer.mock.calls[0][0].lignes[3]).toMatchObject({ police: 'Georgia', alignement: 'centre' });
  });

  it('refuse un en-tête dont toutes les lignes sont vides', async () => {
    const user = userEvent.setup();
    const { onEnregistrer } = ouvrir();
    // On vide la seule ligne restante après avoir supprimé les autres.
    for (let i = 0; i < 6; i += 1) await user.click(screen.getByRole('button', { name: 'Supprimer la ligne 1' }));
    const texte = screen.getByLabelText('Texte de la ligne 1');
    await user.clear(texte);
    await user.click(screen.getByRole('button', { name: 'Enregistrer l’en-tête' }));
    expect(onEnregistrer).not.toHaveBeenCalled();
  });
});
