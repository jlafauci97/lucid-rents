import { NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Fetch all encampments with coordinates
    const url = `${supabaseUrl}/rest/v1/encampments?select=sr_number,created_date,status,address,zip_code,latitude,longitude,council_district,nc_name&latitude=not.is.null&longitude=not.is.null&metro=eq.los-angeles&order=created_date.desc&limit=10000`;

    const res = await fetch(url, {
      headers: { apikey: supabaseKey },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error("Encampments map fetch error:", res.status);
      return NextResponse.json({ points: [], total: 0 });
    }

    const records = await res.json();

    // Aggregate by council district for stats
    const byDistrict = new Map<string, number>();
    const byStatus = new Map<string, number>();
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    let recentCount = 0;

    for (const r of records) {
      const district = r.council_district || "Unknown";
      byDistrict.set(district, (byDistrict.get(district) || 0) + 1);

      const status = r.status || "Unknown";
      byStatus.set(status, (byStatus.get(status) || 0) + 1);

      if (new Date(r.created_date) >= ninetyDaysAgo) {
        recentCount++;
      }
    }

    const points = records.map((r: {
      sr_number: string;
      created_date: string;
      status: string;
      address: string;
      zip_code: string;
      latitude: number;
      longitude: number;
      council_district: string;
      nc_name: string;
    }) => ({
      id: r.sr_number,
      date: r.created_date,
      status: r.status,
      address: r.address,
      zip: r.zip_code,
      lat: r.latitude,
      lng: r.longitude,
      district: r.council_district,
      nc: r.nc_name,
    }));

    return NextResponse.json({
      points,
      total: records.length,
      recent: recentCount,
      byDistrict: Object.fromEntries(byDistrict),
      byStatus: Object.fromEntries(byStatus),
    });
  } catch (error) {
    console.error("Map encampments error:", error);
    return NextResponse.json({ points: [], total: 0 }, { status: 500 });
  }
}
