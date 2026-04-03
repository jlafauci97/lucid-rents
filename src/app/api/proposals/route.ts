import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const metro = searchParams.get("metro") || "nyc";
    const borough = searchParams.get("borough");
    const district = searchParams.get("district");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const filters: string[] = [`metro=eq.${metro}`];
    if (borough) filters.push(`borough=eq.${borough}`);
    if (district) filters.push(`council_district=eq.${district}`);
    if (category) filters.push(`category=eq.${category}`);
    if (status) filters.push(`status=eq.${status}`);
    if (type && type !== "all") filters.push(`type=eq.${type}`);

    const offset = (page - 1) * limit;
    const filterStr = filters.join("&");

    const url = `${supabaseUrl}/rest/v1/proposals?select=id,metro,source,external_id,title,description,type,status,category,borough,council_district,neighborhood,sponsor,intro_date,last_action_date,hearing_date,source_url,latitude,longitude&${filterStr}&order=intro_date.desc&limit=${limit}&offset=${offset}`;

    const res = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Prefer: "count=exact",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Proposals API error:", res.status);
      return NextResponse.json({ proposals: [], total: 0, page });
    }

    const proposals = await res.json();
    const totalStr = res.headers.get("content-range");
    const total = totalStr ? parseInt(totalStr.split("/")[1] || "0") : proposals.length;

    return NextResponse.json({ proposals, total, page });
  } catch (error) {
    console.error("Proposals API error:", error);
    return NextResponse.json({ proposals: [], total: 0, page: 1 }, { status: 500 });
  }
}
