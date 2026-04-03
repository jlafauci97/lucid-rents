import { NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const metro = searchParams.get("metro") || "nyc";
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const filters: string[] = [
      `metro=eq.${metro}`,
      "latitude=not.is.null",
      "longitude=not.is.null",
    ];
    if (category) filters.push(`category=eq.${category}`);
    if (status) filters.push(`status=eq.${status}`);
    if (type && type !== "all") filters.push(`type=eq.${type}`);

    const filterStr = filters.join("&");
    const url = `${supabaseUrl}/rest/v1/proposals?select=id,title,status,category,type,latitude,longitude,intro_date,sponsor,source_url&${filterStr}&order=intro_date.desc&limit=5000`;

    const res = await fetch(url, {
      headers: { apikey: supabaseKey },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error("Proposals map fetch error:", res.status);
      return NextResponse.json({ points: [], total: 0 });
    }

    const records = await res.json();

    const byCategory = new Map<string, number>();
    for (const r of records) {
      const cat = r.category || "other";
      byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
    }

    const points = records.map((r: Record<string, unknown>) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      category: r.category,
      type: r.type,
      lat: r.latitude,
      lng: r.longitude,
      date: r.intro_date,
      sponsor: r.sponsor,
      url: r.source_url,
    }));

    return NextResponse.json({
      points,
      total: records.length,
      byCategory: Object.fromEntries(byCategory),
    });
  } catch (error) {
    console.error("Map proposals error:", error);
    return NextResponse.json({ points: [], total: 0 }, { status: 500 });
  }
}
