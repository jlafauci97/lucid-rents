interface ZipCrimeSummary {
  zipCode: string;
  violent: number;
  property: number;
  qualityOfLife: number;
  total: number;
}

interface BuildingInfo {
  address: string;
  buildingId: string;
}

interface CrimeAlertData {
  userName: string;
  buildings: {
    building: BuildingInfo;
    zipSummary: ZipCrimeSummary;
  }[];
  baseUrl: string;
}

export function buildCrimeAlertHtml(data: CrimeAlertData): string {
  const buildingRows = data.buildings
    .map(
      ({ building, zipSummary }) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">
          <a href="${data.baseUrl}/building/${building.buildingId}" style="color: #2563EB; text-decoration: none; font-weight: 600; font-size: 14px;">
            ${building.address}
          </a>
          <div style="color: #64748b; font-size: 12px; margin-top: 2px;">
            Zip ${zipSummary.zipCode}
          </div>
        </td>
        <td style="padding: 12px 16px; text-align: center; border-bottom: 1px solid #f1f5f9; font-weight: 700; font-size: 16px; color: #0F1D2E;">
          ${zipSummary.total}
        </td>
        <td style="padding: 12px 16px; text-align: center; border-bottom: 1px solid #f1f5f9; color: #EF4444; font-weight: 600;">
          ${zipSummary.violent}
        </td>
        <td style="padding: 12px 16px; text-align: center; border-bottom: 1px solid #f1f5f9; color: #F59E0B; font-weight: 600;">
          ${zipSummary.property}
        </td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">
    <!-- Header -->
    <div style="background-color: #0F1D2E; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 20px;">
        <span style="color: #3B82F6;">Lucid</span> Rents
      </h1>
      <p style="margin: 8px 0 0; color: #94a3b8; font-size: 14px;">
        Daily Crime Alert
      </p>
    </div>

    <!-- Body -->
    <div style="background-color: white; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
      <p style="color: #0F1D2E; font-size: 15px; margin: 0 0 16px;">
        Hi ${data.userName || "there"},
      </p>
      <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
        Here's your daily crime summary for the neighborhoods around your monitored buildings. These are incidents reported by the NYPD in the last 24 hours.
      </p>

      <!-- Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background-color: #f8fafc;">
            <th style="padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">
              Building
            </th>
            <th style="padding: 10px 16px; text-align: center; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">
              Total
            </th>
            <th style="padding: 10px 16px; text-align: center; font-size: 11px; font-weight: 600; color: #EF4444; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">
              Violent
            </th>
            <th style="padding: 10px 16px; text-align: center; font-size: 11px; font-weight: 600; color: #F59E0B; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">
              Property
            </th>
          </tr>
        </thead>
        <tbody>
          ${buildingRows}
        </tbody>
      </table>

      <!-- CTA -->
      <div style="text-align: center; margin-top: 24px;">
        <a href="${data.baseUrl}/crime" style="display: inline-block; background-color: #0F1D2E; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
          View Full Crime Data
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding: 16px 24px; text-align: center; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; background-color: #f8fafc;">
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">
        You're receiving this because you have email alerts enabled for monitored buildings on
        <a href="${data.baseUrl}" style="color: #3B82F6; text-decoration: none;">Lucid Rents</a>.
      </p>
      <p style="margin: 8px 0 0; color: #94a3b8; font-size: 12px;">
        <a href="${data.baseUrl}/profile" style="color: #64748b; text-decoration: none;">
          Manage alert settings
        </a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function buildCrimeAlertSubject(totalCrimes: number): string {
  if (totalCrimes === 0) return "Daily Crime Update — No new incidents";
  return `Daily Crime Alert — ${totalCrimes} new incident${totalCrimes === 1 ? "" : "s"} near your buildings`;
}
