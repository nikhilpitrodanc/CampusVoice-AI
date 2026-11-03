import { allowRequest, db, fail } from '../lib/server.js';
import { cleanTicket, statuses, getIncharge } from '../lib/core.js';
import { getEmailsForTicket } from '../lib/mailer.js';

export default async function handler(req, res) {
  if (!allowRequest(req, res)) return;
  try {
    if (req.method === 'GET') {
      const number = req.query?.number;
      if (number && !/^\d{1,10}$/.test(String(number))) return res.status(400).json({ error:'Invalid ticket number' });
      const filter = number ? `&ticket_number=eq.${encodeURIComponent(String(number))}` : '';
      const records = await db(`tickets?select=id,ticket_number,category,department,location,description,priority,status,created_at${filter}&order=created_at.desc&limit=60`);
      
      const enriched = (records || []).map(r => ({
        ...r,
        incharge: getIncharge(r.category),
        emails: getEmailsForTicket(r.ticket_number)
      }));

      return res.status(200).json({ tickets: enriched });
    }
    if (req.method === 'POST') {
      const ticket = cleanTicket(req.body);
      const incharge = getIncharge(ticket.category);
      const [saved] = await db('tickets', {
        method: 'POST',
        body: {
          ...ticket,
          incharge_name: incharge.name,
          incharge_role: incharge.role,
          incharge_email: incharge.email,
          incharge_phone: incharge.phone,
          incharge_office: incharge.office
        }
      });
      return res.status(201).json({ ticket: { ...saved, incharge } });
    }
    if (req.method === 'PATCH') {
      const id = String(req.body?.id ?? '');
      const status = String(req.body?.status ?? '');
      if (!/^[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id) || !statuses.includes(status)) return res.status(400).json({ error: 'Invalid ticket or status' });
      const [saved] = await db(`tickets?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } });
      if (!saved) return res.status(404).json({ error: 'Ticket not found' });
      return res.status(200).json({ ticket: { ...saved, incharge: getIncharge(saved.category) } });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    if (error.message?.startsWith('Please provide')) return res.status(400).json({ error: error.message });
    return fail(res, error);
  }
}
