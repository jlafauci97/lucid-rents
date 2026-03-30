interface MarketingAlertData {
  stepName: string;
  error: string;
  draftId: string;
  workflowRunId: string;
  contentType: string;
  baseUrl: string;
}

export function buildMarketingAlertHtml(data: MarketingAlertData): string {
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
        Marketing Workflow Alert
      </p>
    </div>

    <!-- Body -->
    <div style="background-color: white; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
      <h2 style="margin: 0 0 16px; color: #0F1D2E; font-size: 18px; font-weight: 700;">
        Marketing Workflow Failed
      </h2>
      <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
        A marketing workflow has failed after exhausting all retries. Please review the details below and check the mission control dashboard.
      </p>

      <!-- Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background-color: #f8fafc;">
            <th style="padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; width: 40%;">
              Field
            </th>
            <th style="padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">
              Step
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 700; color: #0F1D2E;">
              ${data.stepName}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">
              Error
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #EF4444; font-family: monospace; word-break: break-word;">
              ${data.error}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">
              Content Type
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #0F1D2E;">
              ${data.contentType}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">
              Draft ID
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #0F1D2E; font-family: monospace;">
              ${data.draftId}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #64748b;">
              Workflow Run ID
            </td>
            <td style="padding: 12px 16px; font-size: 13px; color: #0F1D2E; font-family: monospace;">
              ${data.workflowRunId}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- CTA -->
      <div style="text-align: center; margin-top: 24px;">
        <a href="${data.baseUrl}/dashboard/mission-control/marketing" style="display: inline-block; background-color: #0F1D2E; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
          View Mission Control
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding: 16px 24px; text-align: center; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; background-color: #f8fafc;">
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">
        You're receiving this because you have workflow failure alerts enabled on
        <a href="${data.baseUrl}" style="color: #3B82F6; text-decoration: none;">Lucid Rents</a>.
      </p>
      <p style="margin: 8px 0 0; color: #94a3b8; font-size: 12px;">
        <a href="${data.baseUrl}/dashboard/mission-control/marketing" style="color: #64748b; text-decoration: none;">
          Manage alert settings
        </a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function buildMarketingAlertSubject(stepName: string): string {
  return `Marketing workflow failed: ${stepName}`;
}
