import { addMonths, monthOf, todayISO } from '../dates';
import { amountDue } from '../payments';
import type { Db, Payment, Ticket } from '../types';

/** Beispieldaten für Tests, relativ zu `now`. */
export function createSeed(now: Date = new Date()): Db {
  const today = todayISO(now);
  const thisMonth = monthOf(today);
  const lastYear = now.getFullYear() - 1;

  const properties: Db['properties'] = [
    { id: 'p1', name: 'Lindenhof', street: 'Lindenstraße 12', zip: '50667', city: 'Köln' },
    { id: 'p2', name: 'Am Stadtpark', street: 'Parkallee 5', zip: '20144', city: 'Hamburg' },
  ];

  const units: Db['units'] = [
    unit('u1', 'p1', 'Wohnung 1', 'EG links', 58.5, 2, 62000, 20500),
    unit('u2', 'p1', 'Wohnung 2', '1. OG', 74, 3, 78500, 26000),
    unit('u3', 'p1', 'Wohnung 3', '2. OG', 92.5, 4, 99000, 32500),
    unit('u4', 'p2', 'Wohnung A', 'EG', 47, 2, 71000, 19500),
    unit('u5', 'p2', 'Wohnung B', '1. OG', 63, 3, 89000, 26000),
  ];

  const tenants: Db['tenants'] = [
    {
      id: 't1',
      unitId: 'u1',
      name: 'Anna Schneider',
      email: 'anna.schneider@example.com',
      phone: '0221 1234567',
      moveIn: '2022-04-01',
      inviteCode: null,
      claimed: true,
    },
    {
      id: 't2',
      unitId: 'u2',
      name: 'Murat Yılmaz',
      email: 'murat.yilmaz@example.com',
      phone: '0176 5551234',
      moveIn: '2023-09-01',
      inviteCode: null,
      claimed: true,
    },
    {
      id: 't3',
      unitId: 'u3',
      name: 'Familie Kowalski',
      email: 'kowalski@example.com',
      phone: '0221 7654321',
      moveIn: `${lastYear}-07-01`,
      inviteCode: '0A1B2C3D4E5F',
      claimed: false,
    },
    {
      id: 't4',
      unitId: 'u4',
      name: 'Lena Hoffmann',
      email: 'lena.hoffmann@example.com',
      phone: '040 9876543',
      moveIn: '2021-01-01',
      inviteCode: null,
      claimed: true,
    },
  ];

  const payments: Payment[] = [];
  for (let back = 4; back >= 0; back--) {
    const month = addMonths(thisMonth, -back);
    for (const t of tenants) {
      if (monthOf(t.moveIn) > month) continue;
      const u = units.find((x) => x.id === t.unitId)!;
      const p: Payment = {
        id: `pay_${t.id}_${month}`,
        tenantId: t.id,
        month,
        rentDue: u.baseRent,
        utilitiesDue: u.utilitiesPrepayment,
        paid: 0,
      };
      const isCurrent = back === 0;
      const isLast = back === 1;
      const unpaid = (t.id === 't2' && (isCurrent || isLast)) || (t.id === 't3' && isCurrent);
      const partial = t.id === 't3' && isLast;
      if (partial) {
        p.paid = Math.round(amountDue(p) / 2);
        p.paidOn = `${month}-05`;
      } else if (!unpaid) {
        p.paid = amountDue(p);
        p.paidOn = `${month}-0${t.id === 't1' ? 2 : 3}`;
      }
      payments.push(p);
    }
  }

  const costs: Db['costs'] = [
    cost('p1', lastYear, 'Heizung', 428000, 'area'),
    cost('p1', lastYear, 'Wasser/Abwasser', 192000, 'units'),
    cost('p1', lastYear, 'Müllabfuhr', 68400, 'units'),
    cost('p1', lastYear, 'Hausmeister', 156000, 'area'),
    cost('p1', lastYear, 'Gebäudeversicherung', 118000, 'area'),
    cost('p1', lastYear, 'Grundsteuer', 96000, 'area'),
    cost('p1', lastYear, 'Allgemeinstrom', 31200, 'area'),
    cost('p2', lastYear, 'Heizung', 241000, 'area'),
    cost('p2', lastYear, 'Wasser/Abwasser', 105000, 'units'),
    cost('p2', lastYear, 'Müllabfuhr', 42000, 'units'),
    cost('p2', lastYear, 'Hausmeister', 90000, 'area'),
    cost('p2', lastYear, 'Gebäudeversicherung', 69000, 'area'),
  ];

  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();
  const tickets: Ticket[] = [
    {
      id: 'k1',
      tenantId: 't1',
      unitId: 'u1',
      title: 'Heizung im Bad wird nicht warm',
      description: 'Der Heizkörper im Bad bleibt trotz voll aufgedrehtem Thermostat kalt.',
      category: 'Heizung',
      priority: 'normal',
      status: 'in_progress',
      createdAt: daysAgo(10),
      comments: [
        {
          id: 'k1c1',
          authorRole: 'verwalter',
          authorName: 'Hausverwaltung',
          text: 'Danke für die Meldung. Ein Heizungsbauer ist beauftragt, der Termin folgt.',
          at: daysAgo(9),
        },
      ],
    },
    {
      id: 'k2',
      tenantId: 't2',
      unitId: 'u2',
      title: 'Wasserfleck an der Decke im Schlafzimmer',
      description: 'Seit gestern breitet sich ein feuchter Fleck an der Decke aus.',
      category: 'Wasser/Sanitär',
      priority: 'urgent',
      status: 'open',
      createdAt: daysAgo(2),
      comments: [],
    },
    {
      id: 'k3',
      tenantId: 't4',
      unitId: 'u4',
      title: 'Klingel an der Haustür defekt',
      description: 'Die Klingel funktioniert nicht mehr, Besucher können nicht läuten.',
      category: 'Elektrik',
      priority: 'low',
      status: 'done',
      createdAt: daysAgo(30),
      comments: [
        {
          id: 'k3c1',
          authorRole: 'verwalter',
          authorName: 'Hausverwaltung',
          text: 'Klingel wurde ausgetauscht.',
          at: daysAgo(26),
        },
      ],
    },
    {
      id: 'k4',
      tenantId: 't3',
      unitId: 'u3',
      title: 'Wohnzimmerfenster schließt nicht richtig',
      description: 'Das Fenster lässt sich nicht mehr vollständig verriegeln, es zieht.',
      category: 'Fenster/Türen',
      priority: 'normal',
      status: 'open',
      createdAt: daysAgo(5),
      comments: [],
    },
  ];

  return { properties, units, tenants, payments, costs, tickets };
}

function unit(
  id: string,
  propertyId: string,
  name: string,
  floor: string,
  areaSqm: number,
  rooms: number,
  baseRent: number,
  utilitiesPrepayment: number,
): Db['units'][number] {
  return { id, propertyId, name, floor, areaSqm, rooms, baseRent, utilitiesPrepayment };
}

function cost(
  propertyId: string,
  year: number,
  category: string,
  amount: number,
  key: 'area' | 'units',
): Db['costs'][number] {
  return { id: `c_${propertyId}_${year}_${category}`, propertyId, year, category, amount, key };
}
