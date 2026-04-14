import { Resend } from "resend";
import type { SubscriptionCredentials } from "@/types";
import {
  buildMyBunnyM3uUrls,
  buildWebPlayerUrl,
  DEFAULT_XTREME_HOST,
} from "@/lib/mybunny";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "sfrench71@gmail.com";
const FROM_EMAIL = "ComfyTV <noreply@comfytv.xyz>";

export async function sendAdminNewOrderEmail(order: {
  userEmail: string;
  userName: string;
  plan: string;
  amount: number;
  currency: string;
  txHash: string;
  desiredChannelName?: string;
}) {
  if (!resend) {
    console.log("Resend not configured, skipping email. Order:", order);
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `New ComfyTV Order — ${order.plan} plan from ${order.userName}`,
    html: `
      <h2>New Order Received</h2>
      <p><strong>Customer:</strong> ${order.userName} (${order.userEmail})</p>
      <p><strong>Plan:</strong> ${order.plan}</p>
      <p><strong>Amount:</strong> ${order.amount} ${order.currency}</p>
      ${
        order.desiredChannelName
          ? `<p><strong>Requested channel name:</strong> <code>${order.desiredChannelName}</code></p>`
          : ""
      }
      <p><strong>TX Hash:</strong> ${order.txHash}</p>
      <p>Log in to <a href="${process.env.NEXTAUTH_URL}/admin/orders">ComfyTV Admin</a> to review and provision.</p>
    `,
  });
}

function credentialsHtml(creds: SubscriptionCredentials): string {
  const host = creds.xtremeHost || DEFAULT_XTREME_HOST;
  const urls = buildMyBunnyM3uUrls(
    host,
    creds.xtremeUsername,
    creds.xtremePassword,
    creds.collectionSize || 2
  );

  const catRow = (
    label: string,
    m3u: string,
    color: string
  ) => {
    const web = buildWebPlayerUrl(m3u);
    return `
      <tr>
        <td style="padding:8px 0;border-top:1px solid #334155;">
          <div style="font-weight:600;color:${color};font-size:13px;">${label}</div>
          <div style="margin-top:4px;word-break:break-all;font-family:monospace;font-size:11px;color:#cbd5e1;">${m3u}</div>
          <div style="margin-top:6px;"><a href="${web}" style="display:inline-block;background:#7c3aed;color:#fff;padding:6px 12px;border-radius:6px;text-decoration:none;font-size:12px;">Watch in Browser</a></div>
        </td>
      </tr>
    `;
  };

  return `
    <div style="background:#0f172a;padding:16px;border-radius:12px;color:#e2e8f0;">
      ${creds.channelName ? `<p><strong>Channel name:</strong> <code>${creds.channelName}</code></p>` : ""}
      <h3 style="color:#60a5fa;margin:12px 0 8px;font-size:15px;">Xtreme API (primary — use in IPTV Smarters / TiviMate / OTT Nav)</h3>
      <table style="border-collapse:collapse;font-size:13px;width:100%;">
        <tr><td style="padding:4px 0;"><strong>Host</strong></td><td style="padding:4px 0;"><code>${host}</code></td></tr>
        <tr><td style="padding:4px 0;"><strong>Username</strong></td><td style="padding:4px 0;"><code>${creds.xtremeUsername || ""}</code></td></tr>
        <tr><td style="padding:4px 0;"><strong>Password</strong></td><td style="padding:4px 0;"><code>${creds.xtremePassword || ""}</code></td></tr>
      </table>

      <h3 style="color:#60a5fa;margin:16px 0 0;font-size:15px;">Playlists (M3U URLs)</h3>
      <table style="border-collapse:collapse;width:100%;">
        ${catRow("🔥 Hot Channels", urls.hotChannels, "#fb923c")}
        ${catRow("📡 Live TV", urls.liveTV, "#60a5fa")}
        ${catRow("🎬 Movies", urls.movies, "#f87171")}
        ${catRow("📺 Series", urls.series, "#22d3ee")}
      </table>
    </div>
  `;
}

export async function sendCustomerCredentialsEmail(
  customerEmail: string,
  data: {
    plan: string;
    credentials: SubscriptionCredentials;
  }
) {
  if (!resend) {
    console.log(
      "Resend not configured, skipping email. Credentials:",
      customerEmail,
      data
    );
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: customerEmail,
    subject: "Your ComfyTV Subscription is Ready!",
    html: `
      <div style="max-width:640px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">
        <h2>Welcome to ComfyTV!</h2>
        <p>Your <strong>${data.plan}</strong> subscription has been activated.</p>
        ${credentialsHtml(data.credentials)}
        <h3 style="margin-top:20px;">How to watch</h3>
        <ul style="font-size:14px;line-height:1.6;">
          <li><strong>Use Xtreme API in any IPTV app</strong> — IPTV Smarters, TiviMate, OTT Navigator, Smart IPTV. Enter the host, username, and password above.</li>
          <li><strong>Use M3U URLs</strong> — paste a specific category URL into any IPTV player.</li>
          <li><strong>Watch in Browser</strong> — click the purple buttons above to watch instantly from your browser.</li>
        </ul>
        <p style="margin-top:16px;">All credentials are always available in your <a href="${process.env.NEXTAUTH_URL}/dashboard">ComfyTV dashboard</a>.</p>
        <p style="color:#64748b;font-size:13px;">Need help? Reply to this email.</p>
      </div>
    `,
  });
}
