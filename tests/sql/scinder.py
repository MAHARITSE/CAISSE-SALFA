#!/usr/bin/env python3
"""Découpe un fichier .sql comme le fait phpMyAdmin, et vérifie trois choses.

phpMyAdmin exécute les instructions une par une. Une base non sélectionnée au
moment d'un CREATE TABLE donne « #1046 — Aucune base n'a été sélectionnée »,
et c'est le genre d'erreur qu'on ne voit qu'en production. Ce script rejoue
donc le découpage ici, hors MySQL :

  1. nombre d'instructions réellement exécutées ;
  2. que l'instruction qui échoue est bien celle que phpMyAdmin montre ;
  3. que USE précède la première création de table.

Usage :
    python3 tests/sql/scinder.py deploy/wamp/sql/salfa_install.sql
    python3 tests/sql/scinder.py --liste deploy/wamp/sql/salfa_roles.sql

`--liste` se contente de rejouer le découpage, pour les scripts qui modifient
une base déjà créée (rôles, contrôle d'import).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


def instructions(sql: str) -> list[str]:
    """Découpe sur les points-virgules hors chaînes et hors commentaires."""
    sorties: list[str] = []
    courant: list[str] = []
    i = 0
    n = len(sql)
    while i < n:
        c = sql[i]
        if sql.startswith('--', i) or c == '#':
            fin = sql.find('\n', i)
            i = n if fin < 0 else fin + 1
            continue
        if sql.startswith('/*', i):
            fin = sql.find('*/', i + 2)
            i = n if fin < 0 else fin + 2
            continue
        if c in ("'", '"', '`'):
            j = i + 1
            while j < n:
                if sql[j] == '\\':
                    j += 2
                    continue
                if sql[j] == c:
                    if j + 1 < n and sql[j + 1] == c:
                        j += 2
                        continue
                    break
                j += 1
            courant.append(sql[i:j + 1])
            i = j + 1
            continue
        if c == ';':
            texte = ''.join(courant).strip()
            if texte:
                sorties.append(texte)
            courant = []
            i += 1
            continue
        courant.append(c)
        i += 1
    reste = ''.join(courant).strip()
    if reste:
        sorties.append(reste)
    return sorties


def sans_commentaires(sql: str) -> str:
    return re.sub(r'^\s*--.*$', '', sql, flags=re.M)


def main(chemin: str, seulement_liste: bool = False) -> int:
    sql = Path(chemin).read_text(encoding='utf-8')
    liste = instructions(sql)
    tete = lambda s: ' '.join(s.split())[:64]
    print(f'{chemin} : {len(liste)} instructions')
    for i, ins in enumerate(liste, 1):
        print(f'{i:2}. {tete(ins)}')

    if seulement_liste:
        return 0 if liste else 1

    echecs: list[str] = []
    create = next((i for i, s in enumerate(liste) if s.upper().startswith('CREATE TABLE')), None)
    use = next((i for i, s in enumerate(liste) if re.match(r'^USE\s', s, re.I)), None)
    base = next((i for i, s in enumerate(liste) if re.match(r'^CREATE DATABASE', s, re.I)), None)

    if create is None:
        echecs.append('aucun CREATE TABLE')
    else:
        if use is None:
            echecs.append('aucun USE : « #1046 Aucune base n’a été sélectionnée »')
        elif use > create:
            echecs.append('USE vient après le premier CREATE TABLE')
        if base is None:
            echecs.append('aucun CREATE DATABASE avant le USE')
        elif base > (use if use is not None else create):
            echecs.append('CREATE DATABASE vient après le USE')

    # Une instruction sans base sélectionnée est celle qui casse l'import.
    print()
    if echecs:
        for e in echecs:
            print('ÉCHEC :', e)
        return 1
    print(f'OK — création de base #{base + 1}, USE #{use + 1}, '
          f'première table #{create + 1} : l’ordre est bon.')
    return 0


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--liste']
    sys.exit(main(args[0] if args else 'deploy/wamp/sql/salfa_install.sql', '--liste' in sys.argv))
