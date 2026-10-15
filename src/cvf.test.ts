import { describe, expect, it } from 'vitest';
import { parseCompetitionId, parseRoster, parseRosterText, parseTeams } from './cvf';

describe('cvf', () => {
  it('vytáhne číslo soutěže z URL i čísla', () => {
    expect(parseCompetitionId('https://www.cvf.cz/souteze/celostatni-souteze?mode=clubs&competitionId=18658')).toBe('18658');
    expect(parseCompetitionId(' 18658 ')).toBe('18658');
    expect(parseCompetitionId('cvf.cz')).toBeNull();
  });

  it('najde družstva podle odkazů s teamId', () => {
    const html = `
      <a href="?teamId=2&competitionId=1&mode=clubs"><img alt="Logo"></a>
      <a href="?teamId=2&competitionId=1&mode=clubs">VK Kralupy</a>
      <a href="?teamId=1&competitionId=1&mode=clubs">SKV Kolín</a>
      <a href="/jinam">Jinam</a>`;
    expect(parseTeams(html)).toEqual([
      { id: '1', name: 'SKV Kolín' },
      { id: '2', name: 'VK Kralupy' },
    ]);
  });

  it('vytáhne hráče z tabulky soupisky a vynechá realizační tým', () => {
    const html = `
      <table><tr><th>Datum</th><th>Zápas</th></tr><tr><td>1.10.</td><td>VK Kralupy - SKV Kolín 3:1</td></tr></table>
      <table>
        <thead><tr><th>Číslo</th><th>Příjmení a jméno</th><th>Ročník</th></tr></thead>
        <tbody>
          <tr><td>7</td><td>Novák Jan</td><td>2001</td></tr>
          <tr><td>1</td><td>Dvořák Petr (L)</td><td>1999</td></tr>
          <tr><td></td><td>Černý Tomáš</td><td>2003</td></tr>
          <tr><td>Trenér</td><td>Svoboda Karel</td><td></td></tr>
        </tbody>
      </table>`;
    expect(parseRoster(html)).toEqual([
      { number: '7', name: 'Novák Jan', libero: undefined },
      { number: '1', name: 'Dvořák Petr', libero: true },
      { number: '', name: 'Černý Tomáš', libero: undefined },
    ]);
  });

  it('přečte ručně vloženou soupisku', () => {
    const text = '7 Novák Jan\nDvořák Petr 12\n#3. Černý Tomáš (L)\n\nŠťastný Ondřej\n14\tKrál Adam\t2002';
    expect(parseRosterText(text)).toEqual([
      { number: '7', name: 'Novák Jan', libero: undefined },
      { number: '12', name: 'Dvořák Petr', libero: undefined },
      { number: '3', name: 'Černý Tomáš', libero: true },
      { number: '', name: 'Šťastný Ondřej', libero: undefined },
      { number: '14', name: 'Král Adam', libero: undefined },
    ]);
  });
});
