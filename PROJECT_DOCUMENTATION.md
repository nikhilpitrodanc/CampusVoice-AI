# CampusVoice AI — Project Submission & Technical Documentation

**Live Demo URL:** [https://campusvoice-ai-gules.vercel.app](https://campusvoice-ai-gules.vercel.app)  
**GitHub Repository:** [https://github.com/nikhilpitrodanc/CampusVoice-AI](https://github.com/nikhilpitrodanc/CampusVoice-AI)  
**Author / Developer:** Nikhil Pitroda  
**Track / Category:** Voice-First AI / Campus Innovation  

---

## 1. Executive Summary: What Was Built & How It Works

**CampusVoice AI** is a voice-first campus grievance assistant and academic intelligence platform designed for university students, faculty, and administrative staff. 

Traditional university grievance portals are tedious: students must log into cumbersome forms, select confusing departmental hierarchies, and wait days without acknowledgment. **CampusVoice AI** replaces this with a conversational, zero-friction experience:

1. **Voice Input:** A student simply taps the microphone orb and speaks their issue or academic question naturally in English, Hindi, or Gujarati.
2. **Real-Time Streaming Transcription:** Spoken words appear on screen in real time with zero delay.
3. **Intelligent Pause & Sentence Completion:** Using client-side Voice Activity Detection (VAD), the system detects when the student has concluded their sentence and automatically submits without requiring a manual stop tap.
4. **Multimodal Gemini 3.5 Triage:** Google Gemini 3.5 Flash processes the audio and text in a 2-stage pipeline:
   - Stage 1: Exact verbatim transcription (ensuring the student's exact words are preserved).
   - Stage 2: Intent classification, priority assessment (Low/Medium/High), department assignment, and location extraction.
5. **Instant Persistent Database Storage:** Tickets are registered in a cloud Supabase PostgreSQL database with unique tracking IDs (e.g. `CV-1025`).
6. **Automated Departmental Routing & In-Charge Notification:** Specific university officials (Facilities, Sanitation, IT, Hostel Warden, Library, Academic Dean, or Security Welfare) are assigned, and an official tracking receipt is generated with target SLAs.
7. **Spoken Voice Confirmation:** The assistant responds back with a warm, confident professional voice synthesizing the response.

---

## 2. Key Features

### 🎙️ 1. Zero-Flicker Voice Capture & Adaptive VAD
- Real-time time-domain Root Mean Square (RMS) audio energy analyser.
- 500ms initial ambient noise calibration that absorbs mouse clicks and screen tap transients.
- Automatic sentence completion detection triggered ~1.0s after speech ceases.

### 🧠 2. Gemini 3.5 Multimodal Intelligence
- **Complaint Triage:** Extracts issue description, physical location (room, lab, block), priority, and category.
- **Academic Doubts & Guidelines Desk:** Knowledgeable guidance on university semester policies, minimum 75% attendance criteria, relative grading scales, and syllabus questions.
- **Emergency Safety Escalation:** Immediate detection of bullying, ragging, or distress, triggering confidential High-Priority tickets and displaying 24/7 helpline contacts (`1800-180-5522`).

### 🏛️ 3. Pre-Configured Campus In-Charge Directory
- **Facilities & Maintenance:** Rajesh Verma (`facilities.incharge@campusvoice.edu`) — SLA: 4-6h
- **Housekeeping & Sanitation:** Sunil Patil (`housekeeping.incharge@campusvoice.edu`) — SLA: 2-4h
- **IT & Wi-Fi:** Prof. Anita Sharma (`it.incharge@campusvoice.edu`) — SLA: 2-5h
- **Hostel & Mess:** Dr. K. Ramanathan (`hostel.warden@campusvoice.edu`) — SLA: 6-12h
- **Central Library:** Dr. Meera Sen (`library.incharge@campusvoice.edu`) — SLA: 12-24h
- **Academic Affairs:** Dean Dr. Sanjeev Kapoor (`academics.incharge@campusvoice.edu`)
- **Campus Security & Welfare:** Capt. Vikram Singh (`security.incharge@campusvoice.edu`)

### 📋 4. Service Tickets Dashboard & Dispatch Receipts
- Filterable ticket desk displaying ongoing, open, and resolved issues.
- Ticket details modal featuring interactive 5-stage resolution timelines and official dispatched email receipts.
- Top notification bar featuring an auto-vanishing 7-second progress timer line.

### 🌐 5. Multilingual & Cross-Platform
- Native support for English, Hindi (हिन्दी / Hinglish), and Gujarati (ગુજરાતી).
- Fully responsive on mobile, tablet, and desktop browsers.

---

## 3. Individual Contribution & Work Done

As the sole developer and architect of this project, I handled 100% of the end-to-end implementation:
- **System Architecture & Design:** Formulated the voice-first workflow, UI/UX glassmorphic design language, and database architecture.
- **Frontend Development:** Built the React 19 application with custom soundwave canvas animations, state-driven Siri glowing orb, modal drawers, and ticket history sidebars.
- **Voice Activity Detection & Audio Engineering:** Developed the hybrid VAD combining Web Audio API time-domain amplitude tracking with the Web Speech API recognition stream.
- **AI & Serverless Backend:** Engineered the Vercel serverless API handlers (`/api/process`, `/api/tickets`), prompt engineering, and Gemini 3.5 integration.
- **Database & Deployment:** Designed the Supabase PostgreSQL schema with Row Level Security (RLS) and deployed the production application on Vercel with automated CI/CD.

---

## 4. Technical Decisions & Challenges Overcome

### Challenge 1: Premature Silence Detection & Mechanical Click Transients
- **Problem:** When users clicked the microphone button, the physical mouse click or trackpad tap created an audio transient spike, causing silence detectors to prematurely stop recording before the user could speak.
- **Solution:** Implemented a 500ms startup warmup window (`frameIndex < 30`) that absorbs mechanical clicks into an adaptive noise floor calibrator. Voice activity is only recognized if sustained across multiple consecutive frames.

### Challenge 2: Accented & Multimodal Audio Transcription
- **Problem:** When querying LLMs for both audio transcription and JSON schema parsing simultaneously, models frequently hallucinated or returned empty transcripts.
- **Solution:** Implemented a 2-stage decoupled pipeline in `/api/process.js`: Stage 1 performs dedicated verbatim speech-to-text audio extraction. Stage 2 executes structured intent extraction on the transcribed text.

### Challenge 3: Seamless Database Resiliency (Supabase Schema Fallback)
- **Problem:** If a cloud database table lacks certain optional metadata columns (such as `incharge_email`), PostgREST throws a 400 `PGRST204` schema cache error.
- **Solution:** Added automated error interception in `lib/server.js` that catches `PGRST204`, filters the payload down to the verified core columns (`category`, `department`, `location`, `description`, `priority`, `status`), and retries the insert seamlessly with zero user interruption.

---

## 5. Technology Stack Summary

- **Frontend:** React 19, Vite 6, Lucide Icons, Vanilla CSS3 Glassmorphism
- **AI / LLM:** Google Gemini 3.5 Flash (via REST API)
- **Audio:** Web Speech API, Web Audio Analyser (Time-Domain RMS), MediaRecorder API
- **TTS Voice Output:** Web SpeechSynthesis API (warm male resonance tuning)
- **Backend:** Node.js Serverless Functions on Vercel Edge
- **Database:** Supabase (PostgreSQL with RLS)
- **Version Control & CI/CD:** GitHub, Vercel Automated Deployments
- **License:** MIT License (Copyright © 2026 Nikhil Pitroda)

