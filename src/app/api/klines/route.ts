import { NextRequest, NextResponse } from "next/server";
import { publicGet, Kline } from "@/lib/wazirx";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  try {
    const data = await publicGet<Kline[]>("/sapi/v1/klines", {
      symbol,
      interval: "1h",
      limit: 24,
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
