import { addMonths, dueDateOf, formatDate, formatMonth, parseDate, todayISO } from '../dates';
import { centsToInput, formatEUR, parseDecimal, parseEUR } from '../money';

describe('parseEUR', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,5', 123450],
    ['1234.56', 123456],
    ['1.234', 123400],
    ['12', 1200],
    ['0,99 €', 99],
    ['  620 ', 62000],
  ])('parst %s', (input, cents) => {
    expect(parseEUR(input)).toBe(cents);
  });

  it.each(['', 'abc', '-5', '1,234,5', '12,345', '1.2.3'])('lehnt %j ab', (input) => {
    expect(parseEUR(input)).toBeNull();
  });

  it('rundet Gleitkomma-Fehler nicht falsch', () => {
    expect(parseEUR('19,99')).toBe(1999);
    expect(parseEUR('0,29')).toBe(29);
  });
});

describe('Formatierung', () => {
  it('formatiert Euro deutsch', () => {
    expect(formatEUR(123456).replace(/\s/g, ' ')).toBe('1.234,56 €');
  });

  it('erzeugt Formularwerte', () => {
    expect(centsToInput(62000)).toBe('620,00');
    expect(parseEUR(centsToInput(123456))).toBe(123456);
  });

  it('parst Dezimalzahlen', () => {
    expect(parseDecimal('62,5')).toBe(62.5);
    expect(parseDecimal('62.5')).toBe(62.5);
    expect(parseDecimal('x')).toBeNull();
  });
});

describe('Datum', () => {
  it('rechnet Monate über Jahreswechsel', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-02', -3)).toBe('2025-11');
    expect(addMonths('2026-12', 0)).toBe('2026-12');
  });

  it('formatiert deutsch', () => {
    expect(formatMonth('2026-03')).toBe('März 2026');
    expect(formatDate('2026-09-03')).toBe('03.09.2026');
    expect(dueDateOf('2026-09')).toBe('2026-09-03');
  });

  it('parst nur gültige Daten', () => {
    expect(parseDate('1.4.2022')).toBe('2022-04-01');
    expect(parseDate('31.02.2022')).toBeNull();
    expect(parseDate('2022-04-01')).toBeNull();
  });

  it('nutzt die lokale Zeit für heute', () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
