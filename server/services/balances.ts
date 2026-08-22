export interface Balance {
  source: "wise" | "paypal";
  currency: string;
  amount: number;
  profile?: "personal" | "business";
  label?: string;
}

export interface BalancesResult {
  balances: Balance[];
  errors: string[];
  fetchedAt: string;
}

const WISE_BASE = process.env.WISE_ENV === "sandbox" ? "https://api.wise-sandbox.com" : "https://api.wise.com";
export const PAYPAL_BASE = process.env.PAYPAL_ENV === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

const CACHE_MS = 60_000;
let cache: { at: number; result: BalancesResult } | null = null;

async function getJson(url: string, init: RequestInit, what: string): Promise<any> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${what}: ${res.status} ${await res.text()}`);
  return res.json();
}

// --- Wise -------------------------------------------------------------------
// Balances are NOT SCA-protected, so a plain personal token is enough. The
// balance-statement endpoint is a different story and is deliberately unused —
// see the "Wise transactions" note in CLAUDE.md.
async function wiseBalances(): Promise<Balance[]> {
  const token = process.env.WISE_API_TOKEN;
  if (!token) return [];
  const headers = { Authorization: `Bearer ${token}` };

  const profiles = (await getJson(`${WISE_BASE}/v1/profiles`, { headers }, "Wise profiles")) as {
    id: number;
    type: string;
    fullName?: string;
    details?: { name?: string };
  }[];

  const out: Balance[] = [];
  for (const p of profiles) {
    // Business profiles only. This app tracks SIÁN OÜ; folding a personal
    // profile into the balance would overstate what the business holds.
    if (p.type !== "business") continue;
    // `types` is a required query param on v4.
    const balances = (await getJson(
      `${WISE_BASE}/v4/profiles/${p.id}/balances?types=STANDARD`,
      { headers },
      `Wise balances (profile ${p.id})`
    )) as { currency: string; amount: { value: number } }[];

    for (const b of balances) {
      out.push({
        source: "wise",
        currency: b.currency,
        amount: b.amount?.value ?? 0,
        // Wise returns name:null for standard balances, so identify by profile
        // instead — an account can have both a personal and a business profile
        // and the two must stay distinguishable.
        profile: p.type === "business" ? "business" : "personal",
        label: p.fullName || p.details?.name || p.type,
      });
    }
  }
  return out;
}

// --- PayPal -----------------------------------------------------------------
let paypalToken: { value: string; expiresAt: number } | null = null;

export async function paypalAccessToken(id: string, secret: string): Promise<string> {
  if (paypalToken && Date.now() < paypalToken.expiresAt) return paypalToken.value;

  const tok = (await getJson(
    `${PAYPAL_BASE}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    },
    "PayPal token"
  )) as { access_token: string; expires_in: number; scope: string };

  // Deliberately no scope preflight. PayPal's token `scope` list is NOT
  // authoritative: /v1/reporting/balances returns 200 for this app even though
  // `reporting/balances/read` is absent from the 26 advertised scopes. Checking
  // it rejected working credentials. The 403 path below carries the guidance.

  // Refresh a minute early rather than racing the expiry.
  paypalToken = { value: tok.access_token, expiresAt: Date.now() + (tok.expires_in - 60) * 1000 };
  return paypalToken.value;
}

async function paypalBalances(): Promise<Balance[]> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) return [];

  const token = await paypalAccessToken(id, secret);
  // The integration guide shows a singular `balance` object; the OpenAPI schema
  // and the live response both return the plural array. Trust the array.
  const data = (await getJson(
    `${PAYPAL_BASE}/v1/reporting/balances`,
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } },
    "PayPal balances"
  ).catch((e: Error) => {
    if (/\b(401|403)\b/.test(e.message)) {
      throw new Error(
        `${e.message} — enable "Transaction Search" on the app at developer.paypal.com. ` +
          `If it is already ticked, the cached token may predate it (up to 9h); create a fresh REST app ` +
          `to skip the wait. On live this also requires a Business account.`
      );
    }
    throw e;
  })) as { balances?: { currency: string; primary?: boolean; total_balance: { value: string } }[] };

  return (data.balances ?? []).map((b) => ({
    source: "paypal" as const,
    currency: b.currency,
    amount: parseFloat(b.total_balance?.value ?? "0") || 0,
    label: b.primary ? "Primary" : undefined,
  }));
}

// --- Aggregate --------------------------------------------------------------
export async function getBalances(): Promise<BalancesResult> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.result;

  // allSettled, not all: one provider being down or unconfigured must never
  // take the other's balances with it.
  const settled = await Promise.allSettled([wiseBalances(), paypalBalances()]);

  const balances: Balance[] = [];
  const errors: string[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") balances.push(...r.value);
    else errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
  }
  for (const e of errors) console.error("[balances]", e);

  const result = { balances, errors, fetchedAt: new Date().toISOString() };
  cache = { at: Date.now(), result };
  return result;
}
