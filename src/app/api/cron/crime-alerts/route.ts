import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";
import { buildCrimeAlertHtml, buildCrimeAlertSubject } from "@/lib/email/crime-alert";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { error: "Missing RESEND_API_KEY" },
      { status: 500 }
    );
  }

  const resend = new Resend(resendKey);
  const supabase = getSupabaseAdmin();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://lucidrents.com";
  const fromEmail = process.env.RESEND_FROM_EMAIL || "alerts@lucidrents.com";

  const startTime = Date.now();
  let emailsSent = 0;
  let usersProcessed = 0;
  const errors: string[] = [];

  try {
    // Create sync log
    const { data: logData } = await supabase
      .from("sync_log")
      .insert({ sync_type: "crime_alerts", status: "running" })
      .select("id")
      .single();
    const logId = logData?.id;

    // Get all monitored buildings with email_enabled
    const { data: monitors } = await supabase
      .from("monitored_buildings")
      .select("user_id, building_id, buildings(full_address, zip_code), profiles(email, display_name)")
      .eq("email_enabled", true);

    if (!monitors || monitors.length === 0) {
      if (logId) {
        await supabase
          .from("sync_log")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            records_added: 0,
            records_linked: 0,
          })
          .eq("id", logId);
      }
      return NextResponse.json({
        success: true,
        message: "No users with email alerts enabled",
        emails_sent: 0,
      });
    }

    // Group monitors by user
    const userMonitors = new Map<
      string,
      {
        email: string;
        displayName: string;
        buildings: { buildingId: string; address: string; zipCode: string }[];
      }
    >();

    for (const m of monitors as Record<string, unknown>[]) {
      const userId = m.user_id as string;
      const building = m.buildings as { full_address: string; zip_code: string } | null;
      const profile = m.profiles as { email: string; display_name: string } | null;

      if (!building?.zip_code || !profile?.email) continue;

      if (!userMonitors.has(userId)) {
        userMonitors.set(userId, {
          email: profile.email,
          displayName: profile.display_name || "",
          buildings: [],
        });
      }

      userMonitors.get(userId)!.buildings.push({
        buildingId: m.building_id as string,
        address: building.full_address,
        zipCode: building.zip_code,
      });
    }

    // Get crimes from last 24 hours per zip
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Collect all unique zip codes across all users
    const allZips = new Set<string>();
    for (const userData of userMonitors.values()) {
      for (const b of userData.buildings) {
        allZips.add(b.zipCode);
      }
    }

    // Single batched query for all zip codes (replaces N individual queries)
    const zipCrimeCounts = new Map<
      string,
      { total: number; violent: number; property: number; qualityOfLife: number }
    >();

    if (allZips.size > 0) {
      const { data: crimes } = await supabase
        .from("nypd_complaints")
        .select("zip_code, crime_category")
        .in("zip_code", [...allZips])
        .gte("cmplnt_date", oneDayAgo);

      if (crimes) {
        for (const c of crimes) {
          const zip = c.zip_code;
          if (!zip) continue;
          if (!zipCrimeCounts.has(zip)) {
            zipCrimeCounts.set(zip, { total: 0, violent: 0, property: 0, qualityOfLife: 0 });
          }
          const counts = zipCrimeCounts.get(zip)!;
          counts.total++;
          if (c.crime_category === "violent") counts.violent++;
          else if (c.crime_category === "property") counts.property++;
          else counts.qualityOfLife++;
        }
      }
    }

    // Send emails per user
    for (const [, userData] of userMonitors) {
      usersProcessed++;

      // Build per-building crime data
      const buildingsWithCrimes = userData.buildings
        .map((b) => {
          const counts = zipCrimeCounts.get(b.zipCode);
          if (!counts || counts.total === 0) return null;
          return {
            building: { address: b.address, buildingId: b.buildingId },
            zipSummary: {
              zipCode: b.zipCode,
              ...counts,
            },
          };
        })
        .filter(Boolean) as NonNullable<
        {
          building: { address: string; buildingId: string };
          zipSummary: {
            zipCode: string;
            total: number;
            violent: number;
            property: number;
            qualityOfLife: number;
          };
        }
      >[];

      // Skip users with no new crimes
      if (buildingsWithCrimes.length === 0) continue;

      const totalCrimes = buildingsWithCrimes.reduce(
        (sum, b) => sum + b.zipSummary.total,
        0
      );

      const html = buildCrimeAlertHtml({
        userName: userData.displayName,
        buildings: buildingsWithCrimes,
        baseUrl,
      });

      try {
        await resend.emails.send({
          from: fromEmail,
          to: userData.email,
          subject: buildCrimeAlertSubject(totalCrimes),
          html,
        });
        emailsSent++;
      } catch (emailErr) {
        errors.push(`Email to ${userData.email}: ${String(emailErr)}`);
      }
    }

    // Finalize sync log
    if (logId) {
      await supabase
        .from("sync_log")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          records_added: emailsSent,
          records_linked: usersProcessed,
          errors: errors.length > 0 ? errors : null,
        })
        .eq("id", logId);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      success: true,
      duration_seconds: parseFloat(elapsed),
      users_processed: usersProcessed,
      emails_sent: emailsSent,
      errors,
    });
  } catch (err) {
    console.error("Crime alerts cron error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
