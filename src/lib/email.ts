import { Resend } from "resend";
import type { SubscriptionCredentials } from "@/types";

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
  const rows: string[] = [];

  if (creds.channelName) {
    rows.push(
      `<tr><td><strong>Channel name</strong></td><td><code>${creds.channelName}</code></td></tr>`
    );
  }

  // Xtreme API (primary credentials for most apps)
  if (creds.xtremeHost || creds.xtremeUsername || creds.xtremePassword) {
    rows.push(
      `<tr><td colspan="2"><h3 style="margin:16px 0 4px;">Xtreme API (IPTV Smarters, TiviMate, etc.)</h3></td></tr>`
    );
    if (creds.xtremeHost) {
      rows.push(
        `<tr><td><strong>Host / Server URL</strong></td><td><code>${creds.xtremeHost}</code></td></tr>`
      );
    }
    if (creds.xtremeUsername) {
      rows.push(
        `<tr><td><strong>Username</strong></td><td><code>${creds.xtremeUsername}</code></td></tr>`
      );
    }
    if (creds.xtremePassword) {
      rows.push(
        `<tr><td><strong>Password</strong></td><td><code>${creds.xtremePassword}</code></td></tr>`
      );
    }
  }

  // M3U URLs
  const hasM3U =
    creds.m3uUrlAll ||
    creds.m3uUrlLiveTV ||
    creds.m3uUrlMovies ||
    creds.m3uUrlSeries;
  if (hasM3U) {
    rows.push(
      `<tr><td colspan="2"><h3 style="margin:16px 0 4px;">M3U Playlists (for generic IPTV players)</h3></td></tr>`
    );
    if (creds.m3uUrlAll) {
      rows.push(
        `<tr><td><strong>All channels</strong></td><td style="word-break:break-all;"><code>${creds.m3uUrlAll}</code></td></tr>`
      );
    }
    if (creds.m3uUrlLiveTV) {
      rows.push(
        `<tr><td><strong>Live TV</strong></td><td style="word-break:break-all;"><code>${creds.m3uUrlLiveTV}</code></td></tr>`
      );
    }
    if (creds.m3uUrlMovies) {
      rows.push(
        `<tr><td><strong>Movies</strong></td><td style="word-break:break-all;"><code>${creds.m3uUrlMovies}</code></td></tr>`
      );
    }
    if (creds.m3uUrlSeries) {
      rows.push(
        `<tr><td><strong>Series</strong></td><td style="word-break:break-all;"><code>${creds.m3uUrlSeries}</code></td></tr>`
      );
    }
  }

  // Web player
  if (creds.webPlayerUrl) {
    rows.push(
      `<tr><td colspan="2"><h3 style="margin:16px 0 4px;">Watch in Browser</h3></td></tr>`
    );
    rows.push(
      `<tr><td colspan="2"><a href="${creds.webPlayerUrl}" target="_blank">${creds.webPlayerUrl}</a></td></tr>`
    );
  }

  return `<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;">${rows.join("")}</table>`;
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
      <h2>Welcome to ComfyTV!</h2>
      <p>Your <strong>${data.plan}</strong> subscription has been activated.</p>
      <h3>Your Streaming Credentials</h3>
      ${credentialsHtml(data.credentials)}
      <h3>How to watch</h3>
      <ul>
        <li><strong>Xtreme API:</strong> Most common. Use the host, username, and password in apps like IPTV Smarters, TiviMate, OTT Navigator, or Smart IPTV.</li>
        <li><strong>M3U URL:</strong> Paste the URL into your IPTV player app. Use the specific playlist (Live TV / Movies / Series) or the combined "All channels" link.</li>
      </ul>
      <p>Credentials are always available in your <a href="${process.env.NEXTAUTH_URL}/dashboard">ComfyTV dashboard</a> — don&apos;t lose access!</p>
      <p>Need help? Reply to this email.</p>
    `,
  });
}
