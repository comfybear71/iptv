import { Resend } from "resend";

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
      <p><strong>TX Hash:</strong> ${order.txHash}</p>
      <p>Log in to <a href="${process.env.NEXTAUTH_URL}/admin/orders">ComfyTV Admin</a> to review and provision.</p>
    `,
  });
}

export async function sendCustomerCredentialsEmail(
  customerEmail: string,
  data: {
    plan: string;
    m3uUrl: string;
    username: string;
    password: string;
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
      <p><strong>M3U URL:</strong> <code>${data.m3uUrl}</code></p>
      <p><strong>Username:</strong> <code>${data.username}</code></p>
      <p><strong>Password:</strong> <code>${data.password}</code></p>
      <p>Add the M3U URL to your IPTV player app to start watching.</p>
      <p>If you need help, reply to this email.</p>
    `,
  });
}
