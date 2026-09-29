/**
 * Email checks for sign-up: a real-world format check plus "did you mean…?" for typos in common
 * providers (gmial.com → gmail.com). Pure functions, so they run under Node (`npx tsx`) too.
 * This can't prove an address exists; that would need a confirmation email.
 */

const COMMON_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.es',
  'ymail.com',
  'hotmail.com',
  'hotmail.es',
  'outlook.com',
  'outlook.es',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'zoho.com',
  'comcast.net',
  'verizon.net',
  'att.net',
  // Real providers that are a letter or two away from the ones above, so they're never "corrected".
  'mail.com',
  'email.com',
  'gmx.de',
  'gmx.net',
  'hotmail.fr',
  'hotmail.co.uk',
  'yahoo.fr',
  'yahoo.co.uk',
  'outlook.fr',
  'live.co.uk',
  'web.de',
];

/** Mistyped ".com" endings: only these are corrected, since ".co", ".cm" etc. are otherwise real. */
const COM_TYPOS = ['con', 'cmo', 'co', 'cm', 'om', 'vom', 'xom', 'comm', 'cim', 'clm', 'ocm', 'coom', 'cpm'];

/** Placeholder, reserved and throwaway domains that can't be someone's real inbox. */
const FAKE_DOMAINS = [
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'email.test',
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'dispostable.com',
];
const RESERVED_TLDS = ['test', 'example', 'invalid', 'localhost', 'local'];

const LOCAL_PART = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export type EmailCheck =
  | { ok: true; email: string; suggestion?: string }
  | { ok: false; reason: string; suggestion?: string };

export function normalizeEmail(input: string) {
  return input.trim().toLowerCase();
}

/** Validates an address. `suggestion` is a corrected full address when the domain looks like a typo. */
export function checkEmail(input: string, { forSignUp = true } = {}): EmailCheck {
  const email = normalizeEmail(input);
  if (!email) return { ok: false, reason: 'Enter your email address.' };
  if (/\s/.test(email)) return { ok: false, reason: 'Email addresses can’t contain spaces.' };

  const at = email.lastIndexOf('@');
  if (at < 1 || email.indexOf('@') !== at) return { ok: false, reason: 'An email needs one @, like name@gmail.com.' };
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (local.length > 64 || !LOCAL_PART.test(local)) {
    return { ok: false, reason: 'The part before the @ has characters an email can’t use.' };
  }
  const labels = domain.split('.');
  const tld = labels[labels.length - 1];
  if (
    labels.length < 2 ||
    domain.length > 253 ||
    !labels.every((l) => DOMAIN_LABEL.test(l)) ||
    !/^[a-z]{2,24}$/.test(tld)
  ) {
    const suggestion = suggestDomain(domain);
    return {
      ok: false,
      reason: 'The part after the @ isn’t a valid domain, like gmail.com.',
      suggestion: suggestion && `${local}@${suggestion}`,
    };
  }

  if (forSignUp && (FAKE_DOMAINS.includes(domain) || RESERVED_TLDS.includes(tld))) {
    return { ok: false, reason: 'Use a real email address you can get into.' };
  }

  const suggestion = suggestDomain(domain);
  return { ok: true, email, suggestion: suggestion && `${local}@${suggestion}` };
}

/**
 * A common provider this domain is probably a typo of: gmial.com, gmail.con, hotmial.co → …com.
 * The name and the ending are compared separately so real domains (mail.com, hotmail.fr) are left alone.
 */
function suggestDomain(domain: string): string | undefined {
  if (COMMON_DOMAINS.includes(domain)) return undefined;
  const dot = domain.indexOf('.');
  if (dot < 1) return undefined;
  const name = domain.slice(0, dot);
  const ending = domain.slice(dot + 1);

  let best: { domain: string; distance: number } | undefined;
  for (const candidate of COMMON_DOMAINS) {
    const cDot = candidate.indexOf('.');
    const cName = candidate.slice(0, cDot);
    const cEnding = candidate.slice(cDot + 1);
    const sameEnding = ending === cEnding || (cEnding === 'com' && COM_TYPOS.includes(ending));
    if (!sameEnding) continue;
    const distance = editDistance(name, cName);
    // Short names get one edit (gmal), longer ones two (hotmial → hotmail is one swap anyway).
    const allowed = cName.length >= 6 ? 2 : 1;
    if (distance <= allowed && (!best || distance < best.distance)) best = { domain: candidate, distance };
  }
  return best && best.domain !== domain ? best.domain : undefined;
}

/** Damerau–Levenshtein (optimal string alignment): swapped letters count as one edit. */
function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
