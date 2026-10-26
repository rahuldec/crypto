import crypto from "crypto";

const BASE = "https://api.wazirx.com";
const API_KEY = process.env.WAZIRX_API_KEY!;
const SECRET_KEY = process.env.WAZIRX_SECRET_KEY!;

function sign(params: Record<string, string | number>): string {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  return crypto.createHmac("sha256", SECRET_KEY).update(qs).digest("hex");
}

export async function signedGet<T>(path: string, extra: Record<string, string | number> = {}): Promise<T> {
  const timestamp = Date.now();
  const params = { ...extra, recvWindow: 5000, timestamp };
  const signature = sign(params);
  const qs = new URLSearchParams(
    Object.entries({ ...params, signature }).map(([k, v]) => [k, String(v)])
  ).toString();
  const res = await fetch(`${BASE}${path}?${qs}`, {
    headers: { "X-API-KEY": API_KEY },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`WazirX ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function publicGet<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  const url = qs ? `${BASE}${path}?${qs}` : `${BASE}${path}`;
  const res = await fetch(url, { next: { revalidate: 10 } });
  if (!res.ok) throw new Error(`WazirX ${path}: ${res.status}`);
  return res.json();
}

export type Ticker = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  openPrice: string;
  lowPrice: string;
  highPrice: string;
  lastPrice: string;
  volume: string;
  bidPrice: string;
  askPrice: string;
  at: number;
};

export type Fund = {
  asset: string;
  free: string;
  locked: string;
};

export type Kline = [number, number, number, number, number, number];
