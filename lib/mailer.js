import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getIncharge, ticketLabel } from './core.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const EMAILS_FILE = path.join(DATA_DIR, 'emails.json');

function readLocalEmails() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(EMAILS_FILE)) return [];
    const content = fs.readFileSync(EMAILS_FILE, 'utf-8');
    return JSON.parse(content) || [];
  } catch {
    return [];
  }
}

function writeLocalEmails(emails) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(EMAILS_FILE, JSON.stringify(emails, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write local emails:', err);
  }
}

export function generateTicketEmailHtml({ ticket, incharge, reply, studentEmail }) {
  const code = ticketLabel(ticket);
  const now = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>CampusVoice AI Service Ticket ${code}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0e17; color: #e2e8f0; margin: 0; padding: 24px; }
    .container { max-width: 620px; margin: 0 auto; background: #131726; border: 1px solid #242c46; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%); padding: 28px 32px; color: #ffffff; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); backdrop-filter: blur(8px); padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }
    .header h1 { margin: 0 0 6px; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 0; font-size: 13px; opacity: 0.9; }
    .body { padding: 32px; }
    .section-title { font-size: 12px; font-weight: 800; color: #818cf8; letter-spacing: 1.2px; text-transform: uppercase; margin: 0 0 12px; }
    .card { background: #1a2035; border: 1px solid #2b3553; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; }
    .card-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
    .card-row:last-child { margin-bottom: 0; }
    .label { color: #8c9cb8; font-weight: 500; }
    .value { color: #ffffff; font-weight: 700; text-align: right; }
    .quote-box { background: #1e2540; border-left: 4px solid #6366f1; padding: 14px 16px; border-radius: 0 10px 10px 0; margin-bottom: 24px; font-style: italic; color: #cbd5e1; font-size: 14px; line-height: 1.6; }
    .incharge-box { background: linear-gradient(135deg, #18223c 0%, #1c2748 100%); border: 1.5px solid #3b82f6; border-radius: 14px; padding: 20px; margin-bottom: 24px; }
    .incharge-name { font-size: 16px; font-weight: 800; color: #60a5fa; margin: 0 0 4px; }
    .incharge-role { font-size: 12px; color: #93c5fd; margin: 0 0 12px; }
    .contact-item { font-size: 13px; color: #e2e8f0; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
    .contact-item a { color: #38bdf8; text-decoration: none; font-weight: 600; }
    .timeline { margin: 24px 0; padding-left: 12px; }
    .timeline-item { position: relative; padding-bottom: 20px; padding-left: 24px; border-left: 2px solid #334155; font-size: 13px; }
    .timeline-item:last-child { border-left: 2px solid transparent; padding-bottom: 0; }
    .timeline-item.active { border-left-color: #10b981; }
    .timeline-item.active::before { content: '✓'; position: absolute; left: -11px; top: -1px; width: 20px; height: 20px; background: #10b981; color: #fff; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 800; text-align: center; line-height: 20px; }
    .timeline-item.pending::before { content: '○'; position: absolute; left: -11px; top: -1px; width: 20px; height: 20px; background: #1e293b; border: 2px solid #64748b; color: #94a3b8; border-radius: 50%; font-size: 11px; text-align: center; line-height: 18px; }
    .timeline-title { font-weight: 700; color: #f1f5f9; margin-bottom: 2px; }
    .timeline-desc { font-size: 12px; color: #94a3b8; }
    .btn { display: block; text-align: center; background: #4f46e5; color: #ffffff; padding: 14px 20px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 14px; margin-top: 24px; box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4); }
    .footer { padding: 20px 32px; background: #0e121e; border-top: 1px solid #1e2538; font-size: 11px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">Official Grievance Receipt</div>
      <h1>Ticket Confirmed: ${code}</h1>
      <p>Raised via CampusVoice AI • Recorded on ${now}</p>
    </div>
    <div class="body">
      <div class="section-title">Your Spoken Request</div>
      <div class="quote-box">"${ticket.raw_text || ticket.description}"</div>

      <div class="section-title">AI Assistant Confirmation</div>
      <p style="color:#e2e8f0; font-size: 14px; line-height: 1.6; margin-top: 0; margin-bottom: 20px;">
        ${reply}
      </p>

      <div class="section-title">Issue Details & Classification</div>
      <div class="card">
        <div class="card-row"><span class="label">Ticket Reference:</span><span class="value">${code}</span></div>
        <div class="card-row"><span class="label">Location:</span><span class="value">${ticket.location}</span></div>
        <div class="card-row"><span class="label">Category:</span><span class="value" style="text-transform: capitalize;">${ticket.category}</span></div>
        <div class="card-row"><span class="label">Priority Level:</span><span class="value" style="color: ${ticket.priority === 'high' ? '#f87171' : ticket.priority === 'medium' ? '#fbbf24' : '#34d399'}; text-transform: uppercase;">${ticket.priority}</span></div>
        <div class="card-row"><span class="label">Assigned Department:</span><span class="value">${ticket.department}</span></div>
        <div class="card-row"><span class="label">Current Status:</span><span class="value" style="color: #60a5fa; text-transform: capitalize;">${ticket.status || 'Open'}</span></div>
      </div>

      <div class="section-title">Respective In-Charge Contact</div>
      <div class="incharge-box">
        <div class="incharge-name">${incharge.name}</div>
        <div class="incharge-role">${incharge.role} (${ticket.department})</div>
        <div class="contact-item">📧 <strong>Email:</strong> <a href="mailto:${incharge.email}?subject=Regarding%20Grievance%20Ticket%20${code}">${incharge.email}</a></div>
        <div class="contact-item">📞 <strong>Intercom / Phone:</strong> <span>${incharge.phone}</span></div>
        <div class="contact-item">🏢 <strong>Office:</strong> <span>${incharge.office}</span></div>
        <div class="contact-item">⏱️ <strong>Resolution SLA:</strong> <span style="color:#fbbf24; font-weight:700;">${incharge.sla}</span></div>
      </div>

      <div class="section-title">Progress Tracker</div>
      <div class="timeline">
        <div class="timeline-item active">
          <div class="timeline-title">1. Spoken Complaint Received & Transcribed</div>
          <div class="timeline-desc">Voice input analyzed by CampusVoice AI.</div>
        </div>
        <div class="timeline-item active">
          <div class="timeline-title">2. Category & Urgency Classified</div>
          <div class="timeline-desc">Priority set to ${ticket.priority.toUpperCase()} and routed to ${ticket.department}.</div>
        </div>
        <div class="timeline-item active">
          <div class="timeline-title">3. Official Work Order Emailed to In-Charge</div>
          <div class="timeline-desc">Notice sent to ${incharge.name} (${incharge.email}).</div>
        </div>
        <div class="timeline-item ${ticket.status === 'in_progress' || ticket.status === 'resolved' ? 'active' : 'pending'}">
          <div class="timeline-title">4. Investigation & Campus Field Action</div>
          <div class="timeline-desc">${ticket.status === 'in_progress' ? 'Technician assigned and work is in progress.' : 'Pending inspection by department team.'}</div>
        </div>
        <div class="timeline-item ${ticket.status === 'resolved' ? 'active' : 'pending'}">
          <div class="timeline-title">5. Issue Resolved & Student Verified</div>
          <div class="timeline-desc">${ticket.status === 'resolved' ? 'Resolved successfully.' : 'Final inspection and resolution pending.'}</div>
        </div>
      </div>

      <a href="http://localhost:5173/?tab=tickets&id=${ticket.ticket_number}" class="btn">
        View Live Status in Dashboard →
      </a>
    </div>
    <div class="footer">
      This is an automated notification from CampusVoice AI Smart Service Desk.<br>
      For urgent inquiries, contact ${incharge.name} directly at ${incharge.email}.
    </div>
  </div>
</body>
</html>
`;
}

export async function dispatchTicketEmail({ ticket, studentEmail, reply, lang = 'en' }) {
  const incharge = getIncharge(ticket.category);
  const code = ticketLabel(ticket);
  const recipientStudent = studentEmail || 'student@campusvoice.edu';
  const recipientIncharge = incharge.email;

  const subject = `[${code}] Campus Grievance: ${ticket.location} - ${ticket.department}`;
  const htmlContent = generateTicketEmailHtml({ ticket, incharge, reply, studentEmail: recipientStudent });

  const emailRecord = {
    id: crypto.randomUUID(),
    ticket_id: ticket.id,
    ticket_number: ticket.ticket_number,
    ticket_code: code,
    to_student: recipientStudent,
    to_incharge: recipientIncharge,
    incharge_name: incharge.name,
    incharge_role: incharge.role,
    department: ticket.department,
    priority: ticket.priority,
    location: ticket.location,
    subject,
    html: htmlContent,
    sent_at: new Date().toISOString(),
    status: 'delivered'
  };

  // If Resend API key is configured, send real email over network
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`
        },
        body: JSON.stringify({
          from: 'CampusVoice AI <notifications@campusvoice.edu>',
          to: [recipientStudent, recipientIncharge],
          subject,
          html: htmlContent
        })
      });
      emailRecord.delivery_method = 'resend_live';
    } catch (err) {
      console.warn('Resend network dispatch failed, logged locally:', err);
      emailRecord.delivery_method = 'local_logged';
    }
  } else {
    emailRecord.delivery_method = 'local_simulated';
  }

  // Persist locally for instant tracking
  const allEmails = readLocalEmails();
  allEmails.unshift(emailRecord);
  writeLocalEmails(allEmails.slice(0, 100));

  return emailRecord;
}

export function getEmailsForTicket(ticketNumber) {
  const allEmails = readLocalEmails();
  if (!ticketNumber) return allEmails.slice(0, 30);
  return allEmails.filter(e => String(e.ticket_number) === String(ticketNumber));
}
