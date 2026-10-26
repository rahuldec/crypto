import { NextRequest, NextResponse } from "next/server";
import { publicGet, Kline } from "@/lib/wazirx";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  try {
    const interval = req.nextUrl.searchParams.get("interval") ?? "1h";
    const limit = req.nextUrl.searchParams.get("limit") ?? "24";
    const data = await publicGet<Kline[]>("/sapi/v1/klines", {
      symbol,
      interval,
      limit,
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
