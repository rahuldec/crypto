import { NextResponse } from "next/server";
import { signedGet, Fund } from "@/lib/wazirx";

export async function GET() {
  try {
    const data = await signedGet<Fund[]>("/sapi/v1/funds");
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
