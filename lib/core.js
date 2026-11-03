export const categories = ['maintenance', 'cleanliness', 'it', 'hostel', 'library', 'academic', 'safety', 'other'];
export const priorities = ['low', 'medium', 'high'];
export const statuses = ['open', 'in_progress', 'resolved'];

export const departments = {
  maintenance: 'Facilities',
  cleanliness: 'Housekeeping',
  it: 'IT Support',
  hostel: 'Hostel Warden',
  library: 'Library',
  academic: 'Academic Office',
  safety: 'Security',
  other: 'Student Help Desk'
};

export const incharges = {
  maintenance: {
    name: 'Rajesh Verma',
    role: 'Chief Engineer, Campus Facilities',
    email: 'facilities.incharge@campusvoice.edu',
    phone: '+91 98765 43210',
    office: 'Block A, Ground Floor (Utility Bay)',
    sla: '4 to 6 Hours'
  },
  cleanliness: {
    name: 'Sunil Patil',
    role: 'Superintendent, Sanitation & Housekeeping',
    email: 'housekeeping.incharge@campusvoice.edu',
    phone: '+91 98765 43211',
    office: 'Central Utility Annex, Room 04',
    sla: '2 to 4 Hours'
  },
  it: {
    name: 'Prof. Anita Sharma',
    role: 'Director, IT Infrastructure & Network',
    email: 'it.incharge@campusvoice.edu',
    phone: '+91 98765 43212',
    office: 'Computer Centre, 2nd Floor, Room 201',
    sla: '2 to 5 Hours'
  },
  hostel: {
    name: 'Dr. K. Ramanathan',
    role: 'Chief Hostel Warden',
    email: 'hostel.warden@campusvoice.edu',
    phone: '+91 98765 43213',
    office: 'Central Warden Office, Hostel Complex',
    sla: '6 to 12 Hours'
  },
  library: {
    name: 'Dr. Meera Sen',
    role: 'Head Librarian',
    email: 'library.incharge@campusvoice.edu',
    phone: '+91 98765 43214',
    office: 'Central Library, 1st Floor Admin',
    sla: '12 to 24 Hours'
  },
  academic: {
    name: 'Dr. Sanjeev Kapoor',
    role: 'Dean of Academic Affairs',
    email: 'academics.incharge@campusvoice.edu',
    phone: '+91 98765 43215',
    office: 'Main Administrative Block, Room 102',
    sla: '24 Hours'
  },
  safety: {
    name: 'Capt. Vikram Singh (Retd.)',
    role: 'Chief Security Officer',
    email: 'security.incharge@campusvoice.edu',
    phone: '+91 98765 43216',
    office: 'Main Gate Security HQ & Control Room',
    sla: 'Immediate / 1 Hour'
  },
  other: {
    name: 'Pooja Deshmukh',
    role: 'Student Welfare Officer',
    email: 'helpdesk.incharge@campusvoice.edu',
    phone: '+91 98765 43217',
    office: 'Student Activity Centre, Room 12',
    sla: '12 Hours'
  }
};

export function getIncharge(category) {
  return incharges[category] || incharges.other;
}

export function cleanTicket(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid ticket');
  const category = categories.includes(input.category) ? input.category : 'other';
  const priority = priorities.includes(input.priority) ? input.priority : 'medium';
  const location = String(input.location ?? '').trim().slice(0, 120);
  const description = String(input.description ?? '').trim().slice(0, 1500);
  if (location.length < 2 || description.length < 5) throw new Error('Please provide a location and a description.');
  return { category, priority, location, description, department: departments[category] };
}

export function ticketLabel(ticket) {
  return `CV-${String(ticket.ticket_number).padStart(4, '0')}`;
}

export function validateIntent(result) {
  if (!result || typeof result !== 'object') throw new Error('AI returned an invalid response');
  const validIntents = [
    'create_ticket',
    'list_tickets',
    'check_ticket',
    'count_open',
    'qa_guidance',
    'safety_alert',
    'unknown'
  ];
  const intent = validIntents.includes(result.intent) ? result.intent : 'unknown';
  const number = result.ticketNumber;
  return {
    intent,
    lang: result.lang === 'hi' ? 'hi' : result.lang === 'gu' ? 'gu' : 'en',
    ticket: result.ticket ?? null,
    ticketNumber: number !== null && number !== undefined && /^\d{1,10}$/.test(String(number)) ? Number(number) : null,
    reply: String(result.reply ?? '').slice(0, 1200),
    transcript: String(result.transcript ?? '').slice(0, 1000)
  };
}
