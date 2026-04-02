import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalizeAddress(addr) {
  if (!addr) return null;
  return addr.toUpperCase().replace(/[.,#]/g, "").replace(/\s+/g, " ")
    .replace(/\bSTREET\b/g, "ST").replace(/\bAVENUE\b/g, "AVE").replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bDRIVE\b/g, "DR").replace(/\bPLACE\b/g, "PL").replace(/\bCOURT\b/g, "CT")
    .replace(/\bLANE\b/g, "LN").replace(/\bROAD\b/g, "RD")
    .replace(/\bNORTH\b/g, "N").replace(/\bSOUTH\b/g, "S").replace(/\bEAST\b/g, "E").replace(/\bWEST\b/g, "W")
    .replace(/\s+(APT|UNIT|#|FL|FLOOR|STE|SUITE|RM|ROOM)\b.*$/i, "").trim();
}

function generateSlug(addr) {
  return addr.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200);
}

async function main() {
  console.log("Loading Miami buildings...");
  const addrMap = new Map();
  let offset = 0, total = 0;
  while (true) {
    const { data } = await supabase.from("buildings").select("id, full_address")
      .eq("metro", "miami").range(offset, offset + 10000 - 1);
    if (!data || data.length === 0) break;
    for (const b of data) {
      const norm = normalizeAddress(b.full_address.split(",")[0]?.trim());
      if (norm && norm.length >= 5) addrMap.set(norm, b.id);
    }
    total += data.length;
    if (data.length < 10000) break;
    offset += 10000;
  }
  console.log(`Loaded ${total.toLocaleString()} buildings, ${addrMap.size.toLocaleString()} addresses`);

  // Fetch unlinked in batches, process as we go
  let totalLinked = 0, totalCreated = 0, totalUnmatched = 0, totalProcessed = 0;
  offset = 0;
  while (true) {
    const { data: batch, error } = await supabase.from("complaints_311")
      .select("unique_key, incident_address")
      .eq("metro", "miami").is("building_id", null)
      .not("incident_address", "is", null)
      .range(offset, offset + 5000 - 1);
    if (error) { console.error("Fetch error:", error.message); break; }
    if (!batch || batch.length === 0) break;

    // Group by address
    const addrToKeys = new Map();
    for (const r of batch) {
      const norm = normalizeAddress(r.incident_address);
      if (!norm || norm.length < 5) continue;
      if (!addrToKeys.has(norm)) addrToKeys.set(norm, []);
      addrToKeys.get(norm).push(r.unique_key);
    }

    for (const [addr, keys] of addrToKeys) {
      let bid = addrMap.get(addr);
      if (!bid) {
        const parts = addr.match(/^(\d+[-\d]*)\s+(.+)$/);
        const slug = generateSlug(addr);

        // Check if building already exists by slug + metro + borough
        const { data: existing } = await supabase
          .from("buildings")
          .select("id")
          .eq("slug", slug)
          .eq("metro", "miami")
          .eq("borough", "Miami-Dade")
          .maybeSingle();

        if (existing) {
          bid = existing.id;
        } else {
          const { data: nb, error: ce } = await supabase.from("buildings").insert({
            full_address: `${addr}, MIAMI, FL`, house_number: parts?.[1] || "",
            street_name: parts?.[2] || addr, city: "Miami", state: "FL", metro: "miami",
            borough: "Miami-Dade",
            slug, violation_count: 0, complaint_count: 0, review_count: 0, overall_score: null,
          }).select("id").single();
          if (ce) {
            if (ce.code === "23505") {
              const { data: ex } = await supabase.from("buildings").select("id").eq("slug", slug).eq("metro", "miami").eq("borough", "Miami-Dade").single();
              if (ex) bid = ex.id;
            }
            if (!bid) { totalUnmatched++; continue; }
          } else if (nb) { bid = nb.id; totalCreated++; addrMap.set(addr, nb.id); }
        }
      }

      for (let i = 0; i < keys.length; i += 500) {
        const chunk = keys.slice(i, i + 500);
        const { error: le } = await supabase.from("complaints_311").update({ building_id: bid }).in("unique_key", chunk);
        if (!le) totalLinked += chunk.length;
      }
    }

    totalProcessed += batch.length;
    if (totalProcessed % 25000 === 0) {
      console.log(`Progress: ${totalProcessed.toLocaleString()} processed, ${totalLinked.toLocaleString()} linked, ${totalCreated} created`);
    }
    offset += 5000;
  }

  console.log(`\nDone: ${totalProcessed.toLocaleString()} processed, ${totalLinked.toLocaleString()} linked, ${totalCreated} buildings created, ${totalUnmatched} unmatched`);
}
main().catch(console.error);
