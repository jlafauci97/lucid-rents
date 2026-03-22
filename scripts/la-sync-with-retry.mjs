const { createClient } = await import("@supabase/supabase-js");
const { randomUUID } = await import("crypto");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Wait for API to come back
async function waitForAPI() {
  const testUrl = "https://data.lacity.org/resource/uwyf-t9jw.json?$limit=1";
  let attempts = 0;
  while (true) {
    attempts++;
    try {
      const res = await fetch(testUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          console.log(`API is back after ${attempts} attempts!`);
          return;
        }
      }
      console.log(`Attempt ${attempts}: API returned ${res.status}, retrying in 2min...`);
    } catch (e) {
      console.log(`Attempt ${attempts}: ${e.message}, retrying in 2min...`);
    }
    await new Promise(r => setTimeout(r, 120000));
  }
}

async function loadBuildingMap() {
  console.log("Loading LA building addresses...");
  const map = new Map();
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("buildings")
      .select("id, full_address")
      .eq("metro", "los-angeles")
      .range(offset, offset + 9999);
    if (!data?.length) break;
    for (const b of data) {
      const key = b.full_address.split(",")[0].trim().toUpperCase();
      map.set(key, b.id);
    }
    offset += data.length;
    if (data.length < 10000) break;
  }
  console.log(`Loaded ${map.size} building addresses`);
  return map;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function syncViolations(buildingMap) {
  console.log("\n=== LAHD Violations ===");
  let offset = 0, total = 0, linked = 0, inserted = 0;
  while (true) {
    try {
      const rows = await fetchJSON(`https://data.lacity.org/resource/uwyf-t9jw.json?$limit=5000&$offset=${offset}&$order=date_case_generated DESC`);
      if (!rows?.length) break;
      const violations = [];
      for (const r of rows) {
        if (!r.cse_case_number) continue;
        const addr = (r.address || "").trim().toUpperCase();
        const bid = buildingMap.get(addr) || null;
        if (bid) linked++;
        violations.push({
          id: randomUUID(), building_id: bid, violation_id: r.cse_case_number,
          class: "C", inspection_date: r.date_case_generated || null,
          status: r.case_status || "UNKNOWN", status_date: r.cse_case_status_date || null,
          borough: r.apc || "Los Angeles",
          house_number: (r.address || "").split(" ")[0],
          street_name: (r.address || "").split(" ").slice(1).join(" "),
          nov_description: `LAHD: ${r.case_status || ""} - ${r.address || ""}`,
          metro: "los-angeles", imported_at: new Date().toISOString()
        });
      }
      for (let i = 0; i < violations.length; i += 500) {
        const { error } = await supabase.from("hpd_violations").insert(violations.slice(i, i + 500));
        if (!error) inserted += Math.min(500, violations.length - i);
        else console.error("  err:", error.message);
      }
      total += rows.length;
      console.log(`  Violations: ${total} fetched, ${inserted} inserted, ${linked} linked`);
      offset += 5000;
      if (rows.length < 5000) break;
    } catch (e) { console.error("  fetch err:", e.message); break; }
  }
  return { total, inserted, linked };
}

async function syncComplaints(buildingMap) {
  console.log("\n=== LA 311 Complaints ===");
  let offset = 0, total = 0, linked = 0, inserted = 0;
  while (true) {
    try {
      const rows = await fetchJSON(`https://data.lacity.org/resource/pvft-t768.json?$limit=5000&$offset=${offset}&$order=createddate DESC&$where=createddate>'2024-01-01'`);
      if (!rows?.length) break;
      const complaints = [];
      for (const r of rows) {
        if (!r.srnumber) continue;
        const addr = (r.address || "").trim().toUpperCase();
        const bid = buildingMap.get(addr) || null;
        if (bid) linked++;
        complaints.push({
          id: randomUUID(), building_id: bid,
          unique_key: r.srnumber.substring(0, 50),
          complaint_type: (r.requesttype || "General").substring(0, 100),
          descriptor: (r.requesttype || "").substring(0, 200),
          agency: "LA 311", status: r.status || "Open",
          created_date: r.createddate || null, closed_date: r.closeddate || null,
          resolution_description: (r.actiontaken || "").substring(0, 500),
          borough: r.councildistrict ? `CD ${r.councildistrict}` : "Los Angeles",
          incident_address: (r.address || "").substring(0, 200),
          latitude: r.latitude ? parseFloat(r.latitude) : null,
          longitude: r.longitude ? parseFloat(r.longitude) : null,
          metro: "los-angeles", imported_at: new Date().toISOString()
        });
      }
      for (let i = 0; i < complaints.length; i += 500) {
        const { error } = await supabase.from("complaints_311").insert(complaints.slice(i, i + 500));
        if (!error) inserted += Math.min(500, complaints.length - i);
        else console.error("  err:", error.message);
      }
      total += rows.length;
      console.log(`  Complaints: ${total} fetched, ${inserted} inserted, ${linked} linked`);
      offset += 5000;
      if (rows.length < 5000) break;
    } catch (e) { console.error("  fetch err:", e.message); break; }
  }
  return { total, inserted, linked };
}

async function syncCrime() {
  console.log("\n=== LAPD Crime ===");
  let offset = 0, total = 0, inserted = 0;
  while (true) {
    try {
      const rows = await fetchJSON(`https://data.lacity.org/resource/2nrs-mtv8.json?$limit=5000&$offset=${offset}&$order=date_occ DESC&$where=date_occ>'2024-01-01'`);
      if (!rows?.length) break;
      const incidents = [];
      for (const r of rows) {
        if (!r.dr_no) continue;
        incidents.push({
          id: randomUUID(), incident_id: r.dr_no,
          category: (r.crm_cd_desc || "Unknown").substring(0, 200),
          description: `${r.crm_cd_desc || ""} - ${r.premis_desc || ""}`.substring(0, 500),
          date: r.date_occ || null, time: r.time_occ || null,
          latitude: r.lat ? parseFloat(r.lat) : null,
          longitude: r.lon ? parseFloat(r.lon) : null,
          precinct: r.area_name || null, borough: r.area_name || "Los Angeles",
          status: r.status_desc || null,
          metro: "los-angeles", imported_at: new Date().toISOString()
        });
      }
      for (let i = 0; i < incidents.length; i += 500) {
        const { error } = await supabase.from("crime_incidents").insert(incidents.slice(i, i + 500));
        if (!error) inserted += Math.min(500, incidents.length - i);
        else { console.error("  err:", error.message); break; }
      }
      total += rows.length;
      console.log(`  Crime: ${total} fetched, ${inserted} inserted`);
      offset += 5000;
      if (rows.length < 5000) break;
      if (total >= 200000) break;
    } catch (e) { console.error("  fetch err:", e.message); break; }
  }
  return { total, inserted };
}

async function syncPermits(buildingMap) {
  console.log("\n=== LADBS Permits ===");
  let offset = 0, total = 0, linked = 0, inserted = 0;
  while (true) {
    try {
      const rows = await fetchJSON(`https://data.lacity.org/resource/yv23-pmwf.json?$limit=5000&$offset=${offset}&$order=status_date DESC&$where=issue_date>'2024-01-01'`);
      if (!rows?.length) break;
      const permits = [];
      for (const r of rows) {
        if (!r.permit_number) continue;
        const addrParts = [r.address_start, r.street_direction, r.street_name, r.street_suffix].filter(Boolean);
        const addr = addrParts.join(" ").toUpperCase();
        const bid = buildingMap.get(addr) || null;
        if (bid) linked++;
        permits.push({
          id: randomUUID(), building_id: bid, permit_id: r.permit_number,
          permit_type: (r.permit_type || "Unknown").substring(0, 100),
          filing_date: r.issue_date || null,
          job_description: (r.work_description || "").substring(0, 1000),
          status: (r.status || "Unknown").substring(0, 50),
          borough: "Los Angeles",
          house_number: r.address_start || "",
          street_name: [r.street_direction, r.street_name, r.street_suffix].filter(Boolean).join(" "),
          zip_code: r.zip_code || null,
          metro: "los-angeles", imported_at: new Date().toISOString()
        });
      }
      for (let i = 0; i < permits.length; i += 500) {
        const { error } = await supabase.from("dob_permits").insert(permits.slice(i, i + 500));
        if (!error) inserted += Math.min(500, permits.length - i);
        else { console.error("  err:", error.message); break; }
      }
      total += rows.length;
      console.log(`  Permits: ${total} fetched, ${inserted} inserted, ${linked} linked`);
      offset += 5000;
      if (rows.length < 5000) break;
    } catch (e) { console.error("  fetch err:", e.message); break; }
  }
  return { total, inserted, linked };
}

async function syncEnergy(buildingMap) {
  console.log("\n=== LA Energy Benchmarks ===");
  let offset = 0, total = 0, linked = 0, inserted = 0;
  while (true) {
    try {
      const rows = await fetchJSON(`https://data.lacity.org/resource/9yda-i4ya.json?$limit=5000&$offset=${offset}`);
      if (!rows?.length) break;
      if (offset === 0) console.log("  Sample keys:", Object.keys(rows[0]).slice(0, 10).join(", "));
      const benchmarks = [];
      for (const r of rows) {
        const addr = (r.property_address || r.address || r.street_address || "").trim().toUpperCase();
        const bid = buildingMap.get(addr) || null;
        if (bid) linked++;
        benchmarks.push({
          id: randomUUID(), building_id: bid,
          energy_star_score: r.energy_star_score ? parseInt(r.energy_star_score) : null,
          site_eui: r.site_eui ? parseFloat(r.site_eui) : (r.weather_normalized_site_eui ? parseFloat(r.weather_normalized_site_eui) : null),
          total_ghg_emissions: r.total_ghg_emissions ? parseFloat(r.total_ghg_emissions) : null,
          report_year: r.year_ending ? parseInt(r.year_ending) : 2024,
          property_name: (r.property_name || "").substring(0, 200),
          metro: "los-angeles", imported_at: new Date().toISOString()
        });
      }
      for (let i = 0; i < benchmarks.length; i += 500) {
        const { error } = await supabase.from("energy_benchmarks").insert(benchmarks.slice(i, i + 500));
        if (!error) inserted += Math.min(500, benchmarks.length - i);
        else { console.error("  err:", error.message); break; }
      }
      total += rows.length;
      console.log(`  Energy: ${total} fetched, ${inserted} inserted, ${linked} linked`);
      offset += 5000;
      if (rows.length < 5000) break;
    } catch (e) { console.error("  fetch err:", e.message); break; }
  }
  return { total, inserted, linked };
}

async function main() {
  console.log("Waiting for data.lacity.org to come back...");
  await waitForAPI();
  
  const buildingMap = await loadBuildingMap();
  
  console.log("\nRunning all syncs in parallel...");
  const results = await Promise.allSettled([
    syncViolations(buildingMap),
    syncComplaints(buildingMap),
    syncCrime(),
    syncPermits(buildingMap),
    syncEnergy(buildingMap)
  ]);
  
  console.log("\n=== FINAL RESULTS ===");
  const names = ["Violations", "Complaints", "Crime", "Permits", "Energy"];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") console.log(`${names[i]}: ${JSON.stringify(r.value)}`);
    else console.log(`${names[i]}: FAILED - ${r.reason?.message || r.reason}`);
  });
}

main().catch(console.error);
