/** A beer you can check in. Catalog beers are built in; custom ones are added by the user. */
export type Beer = {
  id: string;
  name: string;
  brewery: string;
  style: string;
  abv?: number;
};

/** Approximate glass color per style, used for card art. */
const STYLE_COLORS: Record<string, string> = {
  IPA: '#E9A62B',
  'Hazy IPA': '#F4B63F',
  'Session IPA': '#EDB23A',
  'Pale Ale': '#E39A2A',
  Lager: '#F4C84A',
  Pilsner: '#F6D55C',
  Amber: '#B8601C',
  Bock: '#8A4A1C',
  Bitter: '#B96A26',
  Stout: '#23150E',
  'Imperial Stout': '#1A0F0A',
  Porter: '#3B2416',
  Sour: '#F3D36B',
  Wheat: '#F2CC62',
  Witbier: '#F5DC8A',
  'Belgian Strong': '#D08A2C',
};

export function beerColor(style: string) {
  return STYLE_COLORS[style] ?? '#E3A33A';
}

/** Dark beers get light text on their art. */
export function isDarkBeer(style: string) {
  return ['Stout', 'Imperial Stout', 'Porter', 'Bock'].includes(style);
}

const b = (id: string, name: string, brewery: string, style: string, abv: number): Beer => ({
  id,
  name,
  brewery,
  style,
  abv,
});

export const BEER_CATALOG: Beer[] = [
  b('hazy-little-thing', 'Hazy Little Thing', 'Sierra Nevada', 'Hazy IPA', 6.7),
  b('sierra-nevada-pale-ale', 'Pale Ale', 'Sierra Nevada', 'Pale Ale', 5.6),
  b('guinness-draught', 'Guinness Draught', 'Guinness', 'Stout', 4.2),
  b('pliny-the-elder', 'Pliny the Elder', 'Russian River', 'IPA', 8.0),
  b('fat-tire', 'Fat Tire', 'New Belgium', 'Amber', 5.2),
  b('voodoo-ranger', 'Voodoo Ranger IPA', 'New Belgium', 'IPA', 7.0),
  b('juicy-haze', 'Juicy Haze', 'New Belgium', 'Hazy IPA', 7.5),
  b('pilsner-urquell', 'Pilsner Urquell', 'Plzeňský Prazdroj', 'Pilsner', 4.4),
  b('founders-breakfast-stout', 'Breakfast Stout', 'Founders', 'Stout', 8.3),
  b('founders-all-day-ipa', 'All Day IPA', 'Founders', 'Session IPA', 4.7),
  b('murphys-stout', 'Murphy’s Irish Stout', 'Heineken Ireland', 'Stout', 4.0),
  b('london-porter', 'London Porter', 'Fuller’s', 'Porter', 5.4),
  b('london-pride', 'London Pride', 'Fuller’s', 'Bitter', 4.7),
  b('old-rasputin', 'Old Rasputin', 'North Coast', 'Imperial Stout', 9.0),
  b('berliner-weisse', 'Berliner Weisse', 'Schneeeule', 'Sour', 3.0),
  b('hitachino-white', 'Hitachino Nest White Ale', 'Kiuchi', 'Witbier', 5.5),
  b('shiner-bock', 'Shiner Bock', 'Spoetzl', 'Bock', 4.4),
  b('zombie-dust', 'Zombie Dust', '3 Floyds', 'Pale Ale', 6.2),
  b('two-hearted', 'Two Hearted', 'Bell’s', 'IPA', 7.0),
  b('lagunitas-ipa', 'Lagunitas IPA', 'Lagunitas', 'IPA', 6.2),
  b('blue-moon', 'Blue Moon Belgian White', 'Blue Moon', 'Witbier', 5.4),
  b('weihenstephaner-hefe', 'Hefeweissbier', 'Weihenstephaner', 'Wheat', 5.4),
  b('duvel', 'Duvel', 'Duvel Moortgat', 'Belgian Strong', 8.5),
  b('heineken', 'Heineken', 'Heineken', 'Lager', 5.0),
  b('stella-artois', 'Stella Artois', 'AB InBev', 'Lager', 5.0),
  b('modelo-especial', 'Modelo Especial', 'Grupo Modelo', 'Lager', 4.4),
  b('sapporo', 'Sapporo Premium', 'Sapporo', 'Lager', 4.9),
];

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Id for a beer the user typed that isn't in the catalog. */
export function customBeerId(name: string) {
  return `custom-${normalize(name)}`;
}

export function findBeer(id: string | undefined, custom: Beer[]): Beer | undefined {
  if (!id) return undefined;
  return BEER_CATALOG.find((beer) => beer.id === id) ?? custom.find((beer) => beer.id === id);
}

/** Beers whose name, brewery or style match the query; exact name matches first. */
export function searchBeers(query: string, custom: Beer[]): Beer[] {
  const q = normalize(query);
  const all = [...custom, ...BEER_CATALOG];
  if (!q) return all;
  return all
    .filter((beer) => normalize(`${beer.name}${beer.brewery}${beer.style}`).includes(q))
    .sort((a, c) => Number(normalize(c.name).startsWith(q)) - Number(normalize(a.name).startsWith(q)));
}
