import fs from 'fs';
import path from 'path';
import { allowRequest, db, countRows, fail } from '../lib/server.js';
import { cleanTicket, ticketLabel, validateIntent, getIncharge } from '../lib/core.js';
import { dispatchTicketEmail } from '../lib/mailer.js';

function getApiKey() {
  if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('replace_with_your')) {
    return process.env.GEMINI_API_KEY.trim();
  }
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const m = content.match(/GEMINI_API_KEY=([^\r\n]+)/);
      if (m && m[1] && !m[1].includes('replace_with_your')) {
        const val = m[1].trim();
        process.env.GEMINI_API_KEY = val;
        return val;
      }
    }
  } catch {}
  return (process.env.GEMINI_API_KEY || '').trim();
}

const words = {
  en: {
    created: (t) => `Done! ${ticketLabel(t)} was saved for ${t.location}. Priority ${t.priority}; routed to ${t.department}. An official confirmation email with tracking link has been dispatched to both you and the department in-charge.`,
    status: t => `${ticketLabel(t)} is ${t.status.replace('_', ' ')}. ${t.description}. Handled by ${t.department}.`,
    count: n => `There are ${n} unresolved tickets right now.`,
    none: 'I could not find that ticket.',
    missing: 'Please tell me the campus location and what is wrong before I create a ticket.',
    unknown: 'I can help answer your semester doubts, university guidelines, report bullying/ragging, create service tickets, or check ticket status. How can I assist you?'
  },
  hi: {
    created: t => `आपकी शिकायत ${ticketLabel(t)} दर्ज हो गई है। स्थान ${t.location}, प्राथमिकता ${t.priority}। इन-चार्ज को ईमेल भेज दिया गया है।`,
    status: t => `टिकट ${ticketLabel(t)} की स्थिति ${t.status.replace('_',' ')} है।`,
    count: n => `अभी ${n} शिकायतें बाकी हैं।`,
    none: 'वह टिकट नहीं मिला।',
    missing: 'टिकट बनाने के लिए जगह और समस्या दोनों बताइए।',
    unknown: 'मैं आपके सेमेस्टर के प्रश्नों, यूनिवर्सिटी नियमों, रैगिंग/बुलिंग की शिकायत, या सर्विस टिकट में मदद कर सकता हूँ।'
  },
  gu: {
    created: t => `તમારી ફરિયાદ ${ticketLabel(t)} નોંધાઈ ગઈ છે. સ્થળ ${t.location}, પ્રાથમિકતા ${t.priority}. ઇમેઇલ મોકલી દેવાયો છે.`,
    status: t => `ટિકિટ ${ticketLabel(t)} ની સ્થિતિ ${t.status.replace('_',' ')} છે.`,
    count: n => `હાલ ${n} ફરિયાદો બાકી છે.`,
    none: 'આ ટિકિટ મળી નથી.',
    missing: 'ફરિયાદ નોંધાવવા સ્થળ અને સમસ્યા બંને જણાવો.',
    unknown: 'હું સેમેસ્ટર પ્રશ્નો, યુનિવર્સિટી નિયમો, બુલિંગ રિપોર્ટિંગ અથવા ટિકિટ સર્વિસમાં મદદ કરી શકું છું.'
  }
};

function localInterpret(text) {
  const lower = text.toLowerCase().trim();

  const isHindi = /\b(hai|mein|mera|meri|karo|nahi|batao|kya|pani|paani|bijli|kamra|shikayat|kitne|baki|dikhaye|ragging|rag|marpeet|madad)\b/i.test(lower);
  const isGujarati = /\b(chhe|ma|maru|mari|nathi|aavtu|kaho|pan|shikayat|ketla|madad)\b/i.test(lower);
  const lang = isHindi ? 'hi' : (isGujarati ? 'gu' : 'en');

  // 1. Bullying, Ragging, Mental Distress, Harassment (Safety Alert)
  if (/\b(bully|bullying|bullied|ragging|ragged|harass|harassment|threat|threatened|scared|suicide|suicidal|depression|depressed|mental health|abuse|abused|rag|fight|beating)\b/i.test(lower)) {
    const reply = lang === 'hi'
      ? 'कॉलेज में बुलिंग और रैगिंग पर जीरो टॉलरेंस पॉलिसी है। आप सुरक्षित हैं। हमारी 24/7 एंटी-रैगिंग हेल्पलाइन 1800-180-5522 पर तुरंत संपर्क करें या चीफ सिक्योरिटी ऑफिसर कैप्टन विक्रम सिंह (+91 98765 43216 / security.incharge@campusvoice.edu) को सूचित करें। आपकी सुरक्षा के लिए एक गोपनीय हाई-प्रायोरिटी टिकट दर्ज कर लिया गया है।'
      : lang === 'gu'
      ? 'કોલેજમાં બુલિંગ અને રેગિંગ સામે સખત પ્રતિબંધ છે. અમારી 24/7 હેલ્પલાઇન 1800-180-5522 પર કૉલ કરો અથવા ચીફ સિક્યુરિટી ઓફિસર કૅપ્ટન વિક્રમ સિંહ (+91 98765 43216) નો સંપર્ક કરો. તમારી સુરક્ષા માટે ગુપ્ત ટિકિટ નોંધાઈ ગઈ છે.'
      : 'The university maintains a strict Zero-Tolerance Policy against bullying and ragging. You are safe. Please call our 24/7 Anti-Ragging Helpline at 1800-180-5522 or reach Chief Security Officer Capt. Vikram Singh immediately at security.incharge@campusvoice.edu (+91 98765 43216). A confidential High-Priority safety ticket has been opened to alert the welfare committee.';

    return {
      intent: 'safety_alert',
      lang,
      ticket: {
        category: 'safety',
        priority: 'high',
        location: 'Campus Wide / Confidential Student Welfare',
        description: text.slice(0, 300)
      },
      ticketNumber: null,
      reply
    };
  }

  // 1b. Complaints about Teachers, Faculty, Teaching Quality, or Course Pace
  if (/\b(teacher|professor|faculty|sir|maam|mam|teach|teaching)\b/i.test(lower)) {
    if (/\b(not teaching|not clear|not clearly|properly|complain|complaint|issue|problem|bad|poor|pace|clarity|clarify|different classrooms|room)\b/i.test(lower) || /i want to (complain|file a complaint)/i.test(lower)) {
      return {
        intent: 'create_ticket',
        lang,
        ticket: {
          category: 'academic',
          priority: 'medium',
          location: 'Academic Block / Classrooms',
          description: text.slice(0, 300)
        },
        ticketNumber: null,
        reply: 'I have logged your academic grievance regarding teaching quality. It has been routed to Dean of Academic Affairs Dr. Sanjeev Kapoor for official review.'
      };
    }
  }

  // 2. Semester Doubts, Guidelines, Q&A (Academic & General Campus Knowledge)
  if (
    /\b(semester|current semester|sem|clarity|credit|credits|attendance|cgpa|gpa|marks|grading|grade|pass|passing|fail|backlog|kt|exam|mid sem|end sem|syllabus|curriculum|reeval|re-eval|re-evaluation|detained|scholarship|library|curfew|dispensary|internship|portal)\b/i.test(lower) &&
    !/\b(ac|fan|light|water|broken|leak|clean|dirty|trash|wifi down|not working)\b/i.test(lower)
  ) {
    let answer = '';

    if (/\b(semester|clarity|current semester|credit|curriculum|syllabus)\b/i.test(lower)) {
      answer = 'For semester clarity: 1) Minimum 75% attendance is mandatory in all theory & lab subjects to appear for end-semester exams. 2) Evaluation comprises 40% Continuous Internal Assessment (quizzes, assignments, mid-sem exams) and 60% End-Semester Examination. 3) A 10-point relative grading scale applies (passing is 40%). For subject syllabi, credit distribution, or advisor meetings, contact Academic Dean Dr. Sanjeev Kapoor at academics.incharge@campusvoice.edu (Admin Block, Room 102).';
    } else if (/\b(attendance|percentage|detained|absent)\b/i.test(lower)) {
      answer = 'University Attendance Guidelines: Minimum 75% attendance is required in each course. If attendance falls between 65%-74% due to medical reasons, submit a registered medical certificate within 3 days to the Academic Office. Attendance below 65% results in exam debarment. Reach out to Dr. Sanjeev Kapoor (academics.incharge@campusvoice.edu) for leave applications.';
    } else if (/\b(marks|passing|pass|grade|grading|cgpa|gpa|fail|backlog|kt)\b/i.test(lower)) {
      answer = 'Grading & Passing Rules: The passing threshold is 40% combined in internal and end-semester components. Grading follows a 10-point scale: O (10), A+ (9), A (8), B+ (7), B (6), C (5), P (4), F (0). Backlog exams are conducted in the subsequent supplementary cycle. Re-evaluation can be filed on the student portal within 10 days of results.';
    } else if (/\b(library|book|reading room)\b/i.test(lower)) {
      answer = 'Central Library Hours: Weekdays from 8:00 AM to 11:00 PM; Weekends from 9:00 AM to 5:00 PM. The 2nd-floor study hall operates 24/7 during mid-sem and end-sem exam weeks. For book reservations or digital library access, contact Head Librarian Dr. Meera Sen at library.incharge@campusvoice.edu.';
    } else if (/\b(scholarship|fee|fees|concession)\b/i.test(lower)) {
      answer = 'Scholarships & Financial Aid: Merit and need-based scholarships, as well as railway concession forms, are processed through the Student Welfare Office (Room 12, Student Activity Centre). Contact Student Welfare Officer Pooja Deshmukh at helpdesk.incharge@campusvoice.edu.';
    } else {
      answer = 'University Guidelines: Students are encouraged to review the Academic Handbook on the student portal. For semester course planning, attendance concessions, or student welfare inquiries, Dr. Sanjeev Kapoor (Academic Dean, academics.incharge@campusvoice.edu) and Pooja Deshmukh (Student Welfare, helpdesk.incharge@campusvoice.edu) are available to assist.';
    }

    return {
      intent: 'qa_guidance',
      lang,
      ticket: null,
      ticketNumber: null,
      reply: answer
    };
  }

  // 3. Count open tickets
  if (/(how many|total|count|kitne|ketla).*(open|pending|unresolved|baki|tickets|shikayatein|feriyado)/i.test(lower) || /^(open tickets|pending tickets|count tickets)$/i.test(lower)) {
    return { intent: 'count_open', lang, ticket: null, ticketNumber: null, reply: '' };
  }

  // 4. Check ticket status
  const ticketMatch = lower.match(/\b(?:cv-?|ticket\s*(?:number|no\.?|#)?\s*)(\d{1,6})\b/i) || lower.match(/\b(\d{4})\b/);
  if (ticketMatch && /(status|check|kya hua|kya sthiti|kaisi hai|update)/i.test(lower)) {
    return { intent: 'check_ticket', lang, ticket: null, ticketNumber: Number(ticketMatch[1]), reply: '' };
  }

  // 5. List tickets
  if (/(show|list|view|recent|all|dikhaye|bataye|darshav).*(tickets|complaints|shikayat)/i.test(lower)) {
    return { intent: 'list_tickets', lang, ticket: null, ticketNumber: null, reply: 'Showing recent tickets.' };
  }

  // 6. Greetings
  if (/^(hello|hi|hey|good morning|good afternoon|good evening|namaste|kem cho)\b/i.test(lower) && lower.length < 25) {
    const greetingReplies = {
      en: 'Hey there! 👋 I am CampusVoice. You can ask me university guidelines, clarify semester doubts, report bullying/ragging confidentially, or raise campus maintenance tickets.',
      hi: 'नमस्ते! मैं CampusVoice हूँ। आप मुझसे सेमेस्टर के नियम पूछ सकते हैं, बुलिंग/रैगिंग रिपोर्ट कर सकते हैं, या कॉलेज की समस्या का टिकट बना सकते हैं।',
      gu: 'નમસ્તે! હું CampusVoice છું. સેમેસ્ટર પ્રશ્નો, ગાઇડલાઇન્સ, અથવા કૉલેજ સમસ્યાઓ માટે પૂછો.'
    };
    return { intent: 'unknown', lang, ticket: null, ticketNumber: null, reply: greetingReplies[lang] };
  }

  // 7. Extract Physical Location for Grievance Tickets
  let location = '';
  const locPatterns = [
    /\b(?:in|at|near|for)\s+([a-zA-Z\d\s\-\.\/]+?)(?:,|\.|\bis\b|\bhas\b|\band\b|\bmein\b|\bma\b|\bnot\b|\bthe\b|\bwith\b|\b(?:ac|fan|wifi|light|water|issue|problem|heater|cooler)\b|$)/i,
    /\b(room\s*(?:no\.?|number)?\s*[a-zA-Z\d\-]+)/i,
    /\b(classroom\s*[a-zA-Z\d\-]+)/i,
    /\b(hostel\s*[a-zA-Z\d\-]+)/i,
    /\b(lab\s*[a-zA-Z\d\-]+|computer lab(?:,?\s*block\s*[a-zA-Z\d\-]+)?)/i,
    /\b(block\s*[a-zA-Z\d\-]+)/i,
    /\b([A-Z]\s*[-]?\s*\d{3,4})\b/i,
    /\b(library|cafeteria|canteen|auditorium|ground|parking|gym)\b/i
  ];
  for (const pat of locPatterns) {
    const m = text.match(pat);
    if (m && m[1]) {
      let candidate = m[1].trim();
      candidate = candidate.replace(/\b(the|a|an)\b/gi, '').replace(/\b(ac|fan|wifi|light|water|issue|problem)\b/gi, '').trim();
      if (candidate.length >= 2) {
        location = candidate;
        break;
      }
    }
  }

  if (!location) {
    const fallbackPlace = text.match(/\b([A-Z]\d{2,4}|[A-Z]-\d{2,4}|room\s*\w+|hostel\s*\w+|lab\s*\w+)/i);
    if (fallbackPlace) location = fallbackPlace[1].trim();
  }

  // Category
  let category = 'other';
  if (/\b(wifi|wi-fi|internet|network|router|ethernet|computer|pc|laptop|projector|printer|system|software)\b/i.test(lower)) {
    category = 'it';
  } else if (/\b(clean|dirty|trash|garbage|dust|smell|washroom|toilet|restroom|sweep|mop|bin|litter)\b/i.test(lower)) {
    category = 'cleanliness';
  } else if (/\b(hostel|mess|food|canteen|dining|geyser|bed|roommate|warden)\b/i.test(lower)) {
    category = 'hostel';
  } else if (/\b(ac|a\/c|air condition|fan|light|bulb|tube|electricity|power|plug|socket|switch|door|window|bench|desk|chair|water|pipe|leak|tap)\b/i.test(lower)) {
    category = 'maintenance';
  } else if (/\b(book|library|journal|borrow|reading room)\b/i.test(lower)) {
    category = 'library';
  } else if (/\b(attendance|marks|faculty|professor|teacher|lecture|class|syllabus)\b/i.test(lower)) {
    category = 'academic';
  } else if (/\b(theft|steal|stolen|guard|security|safety|fire|emergency|hazard|smoke)\b/i.test(lower)) {
    category = 'safety';
  }

  // Priority
  let priority = 'medium';
  if (/\b(exam|today|urgent|immediate|danger|fire|shock|emergency|injury|no drinking water|blackout)\b/i.test(lower)) {
    priority = 'high';
  } else if (/\b(broken|not working|down|stopped|leaking|damaged|very hot|heavy|failure)\b/i.test(lower)) {
    priority = 'medium';
  } else if (/\b(minor|slow|suggestion|request|small|slight)\b/i.test(lower)) {
    priority = 'low';
  }

  // If user is raising a grievance but location is missing:
  if (!location) {
    if (category === 'academic') {
      location = 'Academic Block / Classrooms';
    } else if (category === 'safety') {
      location = 'Campus Wide / Confidential';
    } else {
      return {
        intent: 'create_ticket',
        lang,
        ticket: null,
        ticketNumber: null,
        reply: ''
      };
    }
  }

  return {
    intent: 'create_ticket',
    lang,
    ticket: {
      category,
      priority,
      location,
      description: text.slice(0, 300)
    },
    ticketNumber: null,
    reply: ''
  };
}

const SYSTEM_PROMPT = `You are CampusVoice AI, the intelligent voice & grievance assistant for university students.
You assist students with:
1. Academic Q&A, course questions, syllabus, exam guidelines, grading system, attendance criteria, faculty contacts, campus life, clubs, and facilities.
2. Registering grievances, maintenance requests, and academic complaints with automatic routing to department in-charges.
3. Confidential safety and anti-ragging support.

CRITICAL VERBATIM TRANSCRIPTION MANDATE:
When processing spoken audio, the "transcript" field MUST be the 100% complete, exact, word-for-word transcript of everything spoken by the student.
- Absolutely DO NOT summarize, compress, or provide a conclusion in "transcript".
- Do NOT replace the student's words with generic phrases like "Voice audio recording" or "Spoken grievance".
- If a student says: "the teacher is not teaching properly and not clearly in the classroom so I want to file a complaint about this issue", the "transcript" MUST be word-for-word: "the teacher is not teaching properly and not clearly in the classroom so I want to file a complaint about this issue".
- Maintain all words, locations, and details as spoken.

University In-charges & Key Policies:
- Academic Affairs: Dean Dr. Sanjeev Kapoor (academics.incharge@campusvoice.edu, Admin Block Room 102).
  Rules: Minimum 75% attendance is strictly mandatory to appear for end-semester exams (medical concession requires certificate within 3 days). Evaluation: 40% Continuous Internal Assessment + 60% End-Sem Exam. Passing criteria: 40% aggregate. Backlog exams held in the subsequent cycle. Re-eval applications open within 10 days of results.
- Anti-Ragging & Bullying: Zero-Tolerance Policy. 24/7 Helpline: 1800-180-5522. Chief Security Officer Capt. Vikram Singh (+91 98765 43216, security.incharge@campusvoice.edu).
- IT Support & Wi-Fi: Prof. Anita Sharma (it.incharge@campusvoice.edu).
- Campus Facilities & Maintenance: Rajesh Verma (facilities.incharge@campusvoice.edu).
- Sanitation & Cleanliness: Sunil Patil (housekeeping.incharge@campusvoice.edu).
- Hostel & Mess: Dr. K. Ramanathan (hostel.warden@campusvoice.edu).
- Central Library: Dr. Meera Sen (library.incharge@campusvoice.edu). Open 8 AM to 11 PM (24/7 during exams).
- Student Welfare Desk: Pooja Deshmukh (helpdesk.incharge@campusvoice.edu).

Supported Intents:
1. "qa_guidance":
   - For ANY student question, doubts about semester, credit requirements, passing criteria, attendance guidelines, grading scale, backlog exams, syllabus, faculty meetings, library hours, scholarships, campus policies, or general university queries.
   - In "reply", write a complete, friendly, knowledgeable, and direct answer.
   - "ticket" MUST be null for qa_guidance.

2. "create_ticket":
   - For complaints, issues, or grievances.
   - ACADEMIC / TEACHER / FACULTY COMPLAINTS: If a student complains about a teacher/professor not teaching properly, lectures not clear, pace too fast, evaluation dispute, or attendance discrepancy:
     * category: "academic"
     * priority: "medium" (or "high" if exams are near)
     * location: "Academic Block / Classrooms" (or whatever department/classroom mentioned. Do NOT require a single room number!)
     * description: clear summary of the student's issue.
     * reply: empathetic confirmation that the issue has been filed and routed to Academic Dean Dr. Sanjeev Kapoor.
   - PHYSICAL / CAMPUS ISSUES: broken AC, fan, Wi-Fi down, water cooler leaking, washroom cleanliness, hostel issues:
     * category: maintenance|cleanliness|it|hostel|library|other
     * priority: low|medium|high
     * location: exact room/block/hall as spoken (if not given, default to "Campus Wide")
     * description: summary of the defect.
     * reply: brief confirmation.

3. "safety_alert":
   - When a student mentions bullying, ragging, harassment, emotional distress, or personal safety.
   - category: "safety", priority: "high", location: "Campus Wide / Confidential".
   - reply: compassionate reassurance + 24/7 Helpline 1800-180-5522 & Capt. Vikram Singh (+91 98765 43216).

4. "check_ticket": For tracking status of an existing ticket (ticketNumber as integer or null).
5. "count_open": For asking how many tickets/complaints are open.
6. "list_tickets": For requesting to show recent tickets.
7. "unknown": For general greetings or open-ended conversation. Provide a natural, helpful reply in "reply".

Always identify language (en, hi, gu). Hinglish is hi.
Output valid JSON adhering strictly to schema.`;

async function interpret(transcript) {
  const key = getApiKey();
  if (!key || key.includes('replace_with_your')) {
    return validateIntent(localInterpret(transcript));
  }

  const models = [
    process.env.GEMINI_MODEL,
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite'
  ].filter(Boolean);

  for (const model of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-goog-api-key':key },
        body:JSON.stringify({
          systemInstruction:{ parts:[{ text: SYSTEM_PROMPT }] },
          contents:[{ role:'user', parts:[{ text:transcript }] }],
          generationConfig:{ temperature:0.2, responseMimeType:'application/json', responseSchema:{
            type:'OBJECT', properties:{
              intent:{ type:'STRING', enum:['create_ticket','check_ticket','list_tickets','count_open','qa_guidance','safety_alert','unknown'] },
              lang:{ type:'STRING', enum:['en','hi','gu'] },
              ticket:{ type:'OBJECT', nullable:true, properties:{ category:{type:'STRING'},priority:{type:'STRING'},location:{type:'STRING'},description:{type:'STRING'} } },
              ticketNumber:{ type:'INTEGER', nullable:true },
              reply:{ type:'STRING' }
            },
            required:['intent','lang','reply']
          } }
        })
      });

      if (!response.ok) continue;
      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('');
      if (!content) continue;
      return validateIntent(JSON.parse(content));
    } catch {
      continue;
    }
  }

  // Fallback to local rule-based interpret if cloud models fail
  return validateIntent(localInterpret(transcript));
}

async function interpretAudio(base64Audio, mimeType, interimText = '') {
  const key = getApiKey();
  if (!key || key.includes('replace_with_your')) {
    return {
      intent: 'unknown',
      lang: 'en',
      ticket: null,
      ticketNumber: null,
      transcript: interimText || '',
      reply: 'Audio received! To enable server-side audio transcription with Gemini AI, set your GEMINI_API_KEY in .env.'
    };
  }

  const cleanMime = mimeType ? mimeType.split(';')[0] : 'audio/webm';
  let speechTranscript = (interimText || '').trim();
  let isQuotaExceeded = false;

  // STEP 1: Dedicated Audio Speech-to-Text Transcription with Gemini 3.5 Flash
  try {
    const transcribeRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: cleanMime, data: base64Audio } },
            { text: 'Listen to the audio recording carefully. Transcribe all speech verbatim word-for-word. Return ONLY the exact transcribed text of what the student said. Do NOT summarize, explain, or add commentary. If the audio is completely silent or no words were spoken, respond with "SILENT".' }
          ]
        }],
        generationConfig: {
          temperature: 0.1
        }
      })
    });

    if (transcribeRes.status === 429) {
      isQuotaExceeded = true;
    } else if (transcribeRes.ok) {
      const transcribeData = await transcribeRes.json();
      const rawText = transcribeData.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('').trim();
      if (rawText && !/^silent\.?$/i.test(rawText) && rawText.length > 2) {
        speechTranscript = rawText.replace(/^["']|["']$/g, '').trim();
      }
    }
  } catch (err) {
    console.warn('Dedicated audio transcription call failed:', err);
  }

  // STEP 2: If we now have the verbatim transcript, interpret it using full campus intelligence
  if (speechTranscript && speechTranscript.length > 2 && !/^(silent|no speech)/i.test(speechTranscript)) {
    const parsed = await interpret(speechTranscript);
    return {
      ...parsed,
      transcript: speechTranscript
    };
  }

  // STEP 3: Fallback multimodal structured prompt if speechTranscript was still empty
  const audioModels = ['gemini-3.5-flash', 'gemini-3.8-flash'];
  for (const model of audioModels) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [
            { inlineData: { mimeType: cleanMime, data: base64Audio } },
            { text: 'Listen carefully to the student\'s speech. Transcribe what they said verbatim into "transcript", classify intent, and reply.' }
          ] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                transcript: { type: 'STRING', description: 'Exact verbatim text of what the student said' },
                intent: { type: 'STRING', enum: ['create_ticket', 'check_ticket', 'list_tickets', 'count_open', 'qa_guidance', 'safety_alert', 'unknown'] },
                lang: { type: 'STRING', enum: ['en', 'hi', 'gu'] },
                ticket: { type: 'OBJECT', nullable: true, properties: { category: { type: 'STRING' }, priority: { type: 'STRING' }, location: { type: 'STRING' }, description: { type: 'STRING' } } },
                ticketNumber: { type: 'INTEGER', nullable: true },
                reply: { type: 'STRING' }
              },
              required: ['intent', 'lang', 'reply', 'transcript']
            }
          }
        })
      });

      if (response.status === 429) {
        isQuotaExceeded = true;
      } else if (response.ok) {
        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('');
        if (content) {
          const parsedObj = JSON.parse(content);
          if (parsedObj.transcript && parsedObj.transcript.length > 2) {
            return validateIntent(parsedObj);
          }
        }
      }
    } catch (err) {
      console.warn(`Fallback audio model ${model} failed:`, err);
    }
  }

  if (isQuotaExceeded) {
    return {
      intent: 'unknown',
      lang: 'en',
      ticket: null,
      ticketNumber: null,
      transcript: speechTranscript || '',
      reply: 'Your Gemini API key has exceeded its daily free quota limit on Google AI Studio. Please generate a fresh API key at aistudio.google.com/apikey and update GEMINI_API_KEY in Vercel.'
    };
  }

  return {
    intent: 'unknown',
    lang: 'en',
    ticket: null,
    ticketNumber: null,
    transcript: speechTranscript || '',
    reply: 'I heard your voice recording! Please ask your question or state your complaint.'
  };
}

export default async function handler(req, res) {
  if (!allowRequest(req,res)) return;
  if (req.method !== 'POST') return res.status(405).json({error:'Use POST'});

  const hasAudio = Boolean(req.body?.audio);
  const text = String(req.body?.text ?? '').trim().slice(0,1000);
  const interimText = String(req.body?.interimText ?? '').trim().slice(0, 1000);
  const studentEmail = String(req.body?.studentEmail ?? '').trim().slice(0, 150);

  if (!hasAudio && text.length < 3) return res.status(400).json({error:'Please speak or type a request'});

  try {
    let parsed = hasAudio
      ? await interpretAudio(req.body.audio, req.body.mimeType, interimText)
      : await interpret(text);

    // If audio returned unknown or empty but interimText contains student complaint, fall back to interpreting interimText
    if (hasAudio && (parsed.intent === 'unknown' || !parsed.ticket) && interimText && interimText.length > 6) {
      const textParsed = await interpret(interimText);
      if (textParsed.intent && textParsed.intent !== 'unknown') {
        parsed = textParsed;
        parsed.transcript = interimText;
      }
    }

    let resolvedTranscript = '';
    if (hasAudio) {
      if (parsed.transcript && parsed.transcript.trim().length > 1 && !/^(voice audio recording|voice spoken grievance|audio received|spoken campus grievance)/i.test(parsed.transcript.trim())) {
        resolvedTranscript = parsed.transcript.trim();
      } else if (interimText && interimText.length > 2) {
        resolvedTranscript = interimText;
      } else if (parsed.ticket?.description && !/^(student grievance submitted via voice assistant|voice audio recording)/i.test(parsed.ticket.description)) {
        resolvedTranscript = parsed.ticket.description.trim();
      } else {
        resolvedTranscript = 'Your spoken query';
      }
    } else {
      resolvedTranscript = (text || parsed.transcript || '').trim();
    }
    const say = words[parsed.lang] || words.en;

    // 1. Q&A and University / Semester Guidance / Conversational Queries
    if (parsed.intent === 'qa_guidance' || parsed.intent === 'unknown') {
      return res.status(200).json({
        ok: true,
        intent: parsed.intent,
        lang: parsed.lang,
        reply: parsed.reply || say.unknown,
        transcript: resolvedTranscript
      });
    }

    // 2. Safety Alert (Anti-Bullying, Ragging, Urgent Distress)
    if (parsed.intent === 'safety_alert') {
      const ticketData = {
        category: 'safety',
        priority: 'high',
        location: parsed.ticket?.location || 'Campus / Confidential Student Welfare',
        description: parsed.ticket?.description || resolvedTranscript || text
      };
      const cleaned = cleanTicket(ticketData);
      const incharge = getIncharge('safety');
      const [saved] = await db('tickets', {
        method: 'POST',
        body: {
          ...cleaned,
          raw_text: resolvedTranscript || text || '[Spoken Safety Alert]',
          student_email: studentEmail || 'student@campusvoice.edu',
          incharge_name: incharge.name,
          incharge_role: incharge.role,
          incharge_email: incharge.email,
          incharge_phone: incharge.phone,
          incharge_office: incharge.office
        }
      });

      const emailRecord = await dispatchTicketEmail({
        ticket: saved,
        studentEmail,
        reply: parsed.reply,
        lang: parsed.lang
      });

      return res.status(201).json({
        ok: true,
        intent: 'safety_alert',
        lang: parsed.lang,
        reply: parsed.reply,
        transcript: resolvedTranscript,
        ticket: { ...saved, incharge },
        email: emailRecord
      });
    }

    // 3. Physical & Academic Grievance Tickets
    if (parsed.intent === 'create_ticket') {
      let ticketData = parsed.ticket;
      if (!ticketData || typeof ticketData !== 'object') {
        ticketData = {};
      }

      // Smart defaults if location or description are omitted by student
      if (!ticketData.location || ticketData.location.trim().length < 2) {
        if (ticketData.category === 'academic') {
          ticketData.location = 'Academic Block / Classrooms';
        } else if (ticketData.category === 'safety') {
          ticketData.location = 'Campus / Confidential Welfare';
        } else if (ticketData.category === 'it') {
          ticketData.location = 'Campus Network / IT';
        } else if (ticketData.category === 'hostel') {
          ticketData.location = 'Hostel Campus';
        } else if (ticketData.category === 'cleanliness') {
          ticketData.location = 'Campus Grounds / Common Area';
        } else {
          ticketData.location = 'Campus Wide';
        }
      }

      if (!ticketData.description || ticketData.description.trim().length < 5) {
        ticketData.description = resolvedTranscript || text || 'Student grievance submitted via voice assistant';
      }

      let ticket;
      try {
        ticket = cleanTicket(ticketData);
      } catch {
        return res.status(200).json({
          ok: false,
          intent: 'create_ticket',
          lang: parsed.lang,
          reply: parsed.reply || say.missing,
          transcript: resolvedTranscript
        });
      }

      const incharge = getIncharge(ticket.category);
      const [saved] = await db('tickets', {
        method: 'POST',
        body: {
          ...ticket,
          raw_text: resolvedTranscript || text || '[Voice Audio Recording]',
          student_email: studentEmail || 'student@campusvoice.edu',
          incharge_name: incharge.name,
          incharge_role: incharge.role,
          incharge_email: incharge.email,
          incharge_phone: incharge.phone,
          incharge_office: incharge.office
        }
      });

      if (!saved) throw new Error('Ticket not stored');

      const confirmationReply = parsed.reply
        ? `${parsed.reply} (Ticket ${ticketLabel(saved)} registered, routed to ${saved.department})`
        : say.created(saved);

      const emailRecord = await dispatchTicketEmail({
        ticket: saved,
        studentEmail,
        reply: confirmationReply,
        lang: parsed.lang
      });

      return res.status(201).json({
        ok: true,
        intent: parsed.intent,
        lang: parsed.lang,
        reply: confirmationReply,
        transcript: resolvedTranscript,
        ticket: { ...saved, incharge },
        email: emailRecord
      });
    }

    // 4. Check Status
    if (parsed.intent === 'check_ticket') {
      if (!parsed.ticketNumber) return res.status(200).json({ok:true,intent:parsed.intent,lang:parsed.lang,reply:say.none});
      const rows = await db(`tickets?select=*&ticket_number=eq.${parsed.ticketNumber}&limit=1`);
      return res.status(200).json({ok:true,intent:parsed.intent,lang:parsed.lang,reply:rows[0]?say.status(rows[0]):say.none});
    }

    // 5. Count Open Tickets
    if (parsed.intent === 'count_open') {
      const count = await countRows('tickets?select=id&status=neq.resolved');
      return res.status(200).json({ok:true,intent:parsed.intent,lang:parsed.lang,reply:say.count(count)});
    }

    // 6. List Recent Tickets
    if (parsed.intent === 'list_tickets') {
      return res.status(200).json({ok:true,intent:parsed.intent,lang:parsed.lang,reply:parsed.reply || 'Showing recent tickets.'});
    }

    return res.status(200).json({ok:true,intent:'unknown',lang:parsed.lang,reply:parsed.reply || say.unknown});
  } catch(error) {
    return fail(res, error);
  }
}
