import { NextResponse } from "next/server";
import { publicGet, Ticker } from "@/lib/wazirx";

export async function GET() {
  try {
    const data = await publicGet<Ticker[]>("/sapi/v1/tickers/24hr");
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
