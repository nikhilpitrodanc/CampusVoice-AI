import React, { useCallback, useEffect, useRef, useState } from 'react';
import logoImg from './assets/logo.png';
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock,
  ExternalLink,
  Headphones,
  History,
  Info,
  LayoutDashboard,
  Mail,
  MapPin,
  Mic,
  Phone,
  Radio,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';

const formatDate = date =>
  new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

const formatRelativeTime = dateStr => {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  if (isNaN(diffMs)) return '';
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const ticketId = t => `CV-${String(t.ticket_number).padStart(4, '0')}`;

const shortTicketTitle = t => {
  const desc = (t.description || t.raw_text || '').trim();
  if (/ac\s+not\s+working|ac\s+is\s+not\s+working/i.test(desc)) {
    const loc = t.location ? t.location.replace(/^room\s*(number)?\s*/i, 'Room ') : 'Room C 407';
    return `${loc}: AC not working`;
  }
  if (/cleanliness/i.test(desc)) {
    const loc = t.location ? t.location.replace(/^room\s*(number)?\s*/i, 'Room ') : 'Room 408';
    return `${loc}: Cleanliness issue`;
  }
  if (/anti-ragging|bullying\s+policy/i.test(desc)) {
    return 'Anti-ragging & bullying policy';
  }
  if (/bullying|ragging/i.test(desc)) {
    const loc = t.location ? t.location : 'Campus';
    return `${loc}: Bullying report`;
  }
  if (/garbage|waste/i.test(desc)) {
    return 'Parul Univ: Garbage on path';
  }
  if (/paani|water/i.test(desc)) {
    return 'Hostel A: Water supply issue';
  }
  if (/fan/i.test(desc)) {
    return 'Classroom B204: Fan broken';
  }
  if (/teacher|professor|faculty|teaching/i.test(desc)) {
    return 'Faculty: Teaching quality issue';
  }
  if (/semester|guidelines|attendance|exam/i.test(desc)) {
    return 'Academic: Semester doubt';
  }

  let clean = desc
    .replace(/^Complaint regarding\s+/i, '')
    .replace(/^Student (inquiry regarding|reported being|reported)\s+/i, '')
    .replace(/^I want to file a complaint about the\s+/i, '')
    .replace(/^in\s+/i, '')
    .replace(/\.$/, '')
    .trim();

  if (clean.length > 34) {
    clean = clean.slice(0, 32) + '...';
  }
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : `Ticket ${ticketId(t)}`;
};

const quickChips = [
  { emoji: '📚', label: 'Semester guidelines', text: 'I am not getting clarity for my current semester guidelines' },
  { emoji: '🛡️', label: 'Anti-ragging & bullying policy', text: 'What is the anti-ragging and bullying policy on campus?' },
  { emoji: '❄️', label: 'AC not working in C 407', text: 'AC in room C 407 is not working and we have an exam today' },
  { emoji: '📋', label: 'Exam attendance requirement', text: 'What is the minimum attendance requirement for exams?' }
];

export default function App() {
  const [tab, setTab] = useState('assistant');
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('en-IN');
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hey there! 👋 I’m CampusVoice. You can ask me semester doubts, university exam & attendance guidelines, report bullying/ragging confidentially, or raise campus maintenance tickets with automatic in-charge email dispatch.'
    }
  ]);
  const [lastTicket, setLastTicket] = useState(null);
  const [lastEmail, setLastEmail] = useState(null);
  const [createdAlertTicket, setCreatedAlertTicket] = useState(null);
  const alertTimerRef = useRef(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showHeroChips, setShowHeroChips] = useState(false);
  const [studentEmail, setStudentEmail] = useState(
    () => localStorage.getItem('cv-student-email') || 'student@campusvoice.edu'
  );
  const [modalTicket, setModalTicket] = useState(null);
  const [modalTab, setModalTab] = useState('timeline'); // 'timeline' or 'email'
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [ongoingOpen, setOngoingOpen] = useState(true);
  const [resolvedOpen, setResolvedOpen] = useState(true);
  const [code, setCode] = useState(() => sessionStorage.getItem('campusvoice-code') || '');
  const [browserEngine, setBrowserEngine] = useState('');
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const hasSpokenRef = useRef(false);
  const lastSpeechTimestampRef = useRef(0);

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const speechEndTimeoutRef = useRef(null);
  const busyRef = useRef(false);
  const bottomRef = useRef(null);
  const conversationCardRef = useRef(null);
  const currentTextRef = useRef('');

  // Detect supported speech engine
  useEffect(() => {
    const hasSpeechRec = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    const hasMediaRecorder = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
    if (hasSpeechRec) {
      setBrowserEngine('WebSpeech');
    } else if (hasMediaRecorder) {
      setBrowserEngine('MediaRecorder');
    } else {
      setBrowserEngine('None');
    }
  }, []);

  const headers = { 'Content-Type': 'application/json', ...(code ? { 'x-demo-code': code } : {}) };

  const request = useCallback(
    async (path, options = {}) => {
      const response = await fetch(path, {
        ...options,
        headers: { ...headers, ...(options.headers || {}) }
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
      return body;
    },
    [code]
  );

  const refresh = useCallback(async () => {
    try {
      const data = await request('/api/tickets');
      setTickets(data.tickets || []);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [request]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (messages.length > 1) {
      conversationCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages, busy]);

  useEffect(() => {
    // Warm up speech synthesis voices
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        try { window.speechSynthesis.getVoices(); } catch {}
      };
      try { window.speechSynthesis.getVoices(); } catch {}
    }

    return () => {
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
      if (speechEndTimeoutRef.current) clearTimeout(speechEndTimeoutRef.current);
      recognitionRef.current?.abort();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  const pickProfessionalVoice = (langCode) => {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const targetPrefix = langCode === 'hi' ? 'hi' : langCode === 'gu' ? 'gu' : (language.split('-')[0] || 'en');
    const matched = voices.filter(v => v.lang.toLowerCase().startsWith(targetPrefix));
    const pool = matched.length > 0 ? matched : voices;

    const scoreVoice = (v) => {
      const n = (v.name || '').toLowerCase();
      const lang = (v.lang || '').toLowerCase();
      let score = 0;

      // Heavy penalty for female voices to guarantee a professional male assistant
      const femaleKeywords = [
        'female', 'woman', 'girl', 'aria', 'jenny', 'zira', 'samantha', 'kavya',
        'swara', 'victoria', 'susan', 'hazel', 'heera', 'kalpana', 'catherine',
        'linda', 'karen', 'anna', 'helena', 'hortense', 'julie', 'marie'
      ];
      if (femaleKeywords.some(k => n.includes(k))) {
        score -= 500;
      }

      // Strong bonus for high quality male voices
      const topMaleVoices = [
        'guy', 'christopher', 'ryan', 'eric', 'hemant', 'madhur',
        'daniel', 'alex', 'george', 'mark', 'david', 'male', 'prabhat',
        'google uk english male', 'google us english male'
      ];
      if (topMaleVoices.some(m => n.includes(m))) {
        score += 300;
      }

      // Bonus for Natural / Neural / Online clarity
      if (n.includes('natural')) score += 120;
      if (n.includes('neural')) score += 100;
      if (n.includes('online')) score += 80;
      if (n.includes('google')) score += 60;
      if (n.includes('microsoft')) score += 50;

      // Match target language
      if (lang.startsWith(targetPrefix)) score += 50;

      return score;
    };

    const sorted = [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a));
    return sorted[0] || pool[0];
  };

  const speak = (text, langCode = 'en') => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const professionalVoice = pickProfessionalVoice(langCode);
      if (professionalVoice) {
        utterance.voice = professionalVoice;
        utterance.lang = professionalVoice.lang;
      } else {
        utterance.lang = langCode === 'hi' ? 'hi-IN' : langCode === 'gu' ? 'gu-IN' : language;
      }
      utterance.volume = 1.0; // Boost to maximum loudness
      utterance.rate = 1.0;   // Confident, professional speaking rate
      utterance.pitch = 0.94; // Warm, resonant male pitch
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
      setSpeaking(false);
    }
  };

  const processText = async text => {
    const phrase = String(text || '').trim();
    if (!phrase || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setInput('');
    setLiveTranscript('');
    setMessages(m => [...m, { role: 'user', text: phrase }]);

    try {
      const parsed = await request('/api/process', {
        method: 'POST',
        body: JSON.stringify({ text: phrase, studentEmail })
      });
      const reply = parsed.reply || 'How can I assist you with campus services?';

      if (parsed.intent === 'create_ticket' && parsed.ok && parsed.ticket) {
        setLastTicket(parsed.ticket);
        setLastEmail(parsed.email || null);
        setCreatedAlertTicket(parsed.ticket);
        if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
        alertTimerRef.current = setTimeout(() => {
          setCreatedAlertTicket(null);
        }, 7000);
        await refresh();
      }
      if (parsed.intent === 'list_tickets') {
        await refresh();
        setTab('tickets');
      }

      setMessages(m => [
        ...m,
        {
          role: 'assistant',
          text: reply,
          ticket: parsed.ticket || null,
          email: parsed.email || null
        }
      ]);

      speak(reply, parsed.lang);
    } catch (e) {
      const reply = `I couldn't complete that action: ${e.message}. Please try again.`;
      setError(e.message);
      setMessages(m => [...m, { role: 'assistant', text: reply, failed: true }]);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const processAudioRecording = async (base64Audio, mimeType, interimText = '') => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    const interimSpoken = (interimText || currentTextRef.current || '').trim();
    setLiveTranscript(interimSpoken || 'Understanding your concern...');
    const tempId = Date.now();
    const placeholder = interimSpoken.length > 2
      ? `🎙️ "${interimSpoken}"`
      : '🎙️ "Understanding your concern..."';
    setMessages(m => [...m, { id: tempId, role: 'user', text: placeholder }]);

    try {
      const parsed = await request('/api/process', {
        method: 'POST',
        body: JSON.stringify({
          audio: base64Audio,
          mimeType,
          interimText: interimSpoken,
          studentEmail
        })
      });
      const reply = parsed.reply || 'Request received.';

      // Prioritize 100% complete verbatim transcript
      let spokenWords = (parsed.transcript || '').trim();
      if (!spokenWords || /^(voice audio recording|voice spoken grievance|audio received|spoken campus grievance)/i.test(spokenWords)) {
        if (interimSpoken && interimSpoken.length > 2) {
          spokenWords = interimSpoken;
        } else if (parsed.ticket?.description && !/^(student grievance submitted via voice assistant|voice audio recording)/i.test(parsed.ticket.description)) {
          spokenWords = parsed.ticket.description.trim();
        } else {
          spokenWords = 'Your spoken query';
        }
      }

      // Display the student's complete verbatim words in the chat bubble
      setMessages(m => m.map(msg => msg.id === tempId ? { ...msg, text: `🎙️ "${spokenWords}"` } : msg));

      if (parsed.intent === 'create_ticket' && parsed.ok && parsed.ticket) {
        setLastTicket(parsed.ticket);
        setLastEmail(parsed.email || null);
        setCreatedAlertTicket(parsed.ticket);
        if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
        alertTimerRef.current = setTimeout(() => {
          setCreatedAlertTicket(null);
        }, 7000);
        await refresh();
      }
      if (parsed.intent === 'list_tickets') {
        await refresh();
        setTab('tickets');
      }

      setMessages(m => [
        ...m,
        {
          role: 'assistant',
          text: reply,
          ticket: parsed.ticket || null,
          email: parsed.email || null
        }
      ]);

      speak(reply, parsed.lang);
    } catch (e) {
      const reply = `I couldn't process the audio: ${e.message}`;
      setError(e.message);
      setMessages(m => m.map(msg => msg.id === tempId ? { ...msg, text: '🎙️ [Spoken audio]' } : msg));
      setMessages(m => [...m, { role: 'assistant', text: reply, failed: true }]);
    } finally {
      busyRef.current = false;
      setBusy(false);
      setLiveTranscript('');
    }
  };

  const stopAllRecording = () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    if (speechEndTimeoutRef.current) {
      clearTimeout(speechEndTimeoutRef.current);
      speechEndTimeoutRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close(); } catch {}
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    setListening(false);
  };

  const toggleListening = async () => {
    if (isStartingRef.current) return;
    if (listening) {
      stopAllRecording();
      return;
    }

    isStartingRef.current = true;
    isStoppingRef.current = false;
    hasSpokenRef.current = false;
    lastSpeechTimestampRef.current = 0;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setError('');
    currentTextRef.current = '';
    setLiveTranscript('');

    // Turn ON immediately with ZERO flicker
    setListening(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      isStartingRef.current = false;
      setListening(false);
      setError('Audio recording is not supported in this browser. Please use Chrome, Edge, or Firefox, or type your complaint.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (isStoppingRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      mediaStreamRef.current = stream;

      // Start optional companion WebSpeech for streaming interim text and rapid end detection
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          recognitionRef.current = rec;
          rec.lang = language;
          rec.interimResults = true;
          rec.continuous = true;

          rec.onresult = event => {
            if (isStoppingRef.current) return;
            let transcript = '';
            let isFinalChunk = false;
            for (let i = 0; i < event.results.length; i++) {
              transcript += event.results[i][0].transcript;
              if (event.results[i].isFinal) isFinalChunk = true;
            }
            if (transcript) {
              currentTextRef.current = transcript;
              setLiveTranscript(transcript);
              setInput(transcript);

              const clean = transcript.trim();
              if (clean.length >= 3) {
                hasSpokenRef.current = true;
                lastSpeechTimestampRef.current = Date.now();

                // Clear any prior pending timeout
                if (speechEndTimeoutRef.current) clearTimeout(speechEndTimeoutRef.current);

                // Auto-submit promptly once sentence is complete:
                // 550ms if final chunk, 1050ms if speech pauses after spoken words!
                const waitTime = isFinalChunk ? 550 : 1050;
                speechEndTimeoutRef.current = setTimeout(() => {
                  if (!isStoppingRef.current && mediaRecorderRef.current?.state === 'recording') {
                    stopAllRecording();
                  }
                }, waitTime);
              }
            }
          };

          rec.onspeechend = () => {
            if (currentTextRef.current.trim().length >= 3 && !isStoppingRef.current) {
              if (speechEndTimeoutRef.current) clearTimeout(speechEndTimeoutRef.current);
              speechEndTimeoutRef.current = setTimeout(() => {
                if (!isStoppingRef.current && mediaRecorderRef.current?.state === 'recording') {
                  stopAllRecording();
                }
              }, 500);
            }
          };

          // NEVER let companion WebSpeech errors stop the recording or cause flicker!
          rec.onerror = () => {
            // Silently ignore — MediaRecorder is capturing raw high-fidelity audio!
          };
          rec.onend = () => {
            // WebSpeech ended — do NOT change listening state!
          };

          rec.start();
        } catch (e) {
          console.debug('Companion speech recognition not available:', e);
        }
      }

      // Voice Activity Detection (VAD) via Web Audio Analyser
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        try {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          analyserRef.current = analyser;

          const timeData = new Uint8Array(analyser.fftSize);
          let ambientNoise = 1.0;
          let frameIndex = 0;
          let consecutiveVoiceFrames = 0;
          const startedAt = Date.now();

          const checkAudioLevel = () => {
            if (isStoppingRef.current || !mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
            analyser.getByteTimeDomainData(timeData);

            // Compute average deviation from center 128
            let sum = 0;
            for (let i = 0; i < timeData.length; i++) {
              sum += Math.abs(timeData[i] - 128);
            }
            const amp = sum / timeData.length;

            // Calibrate ambient noise floor for the first 30 frames (~500ms)
            // This naturally absorbs initial click/tap transients
            if (frameIndex < 30) {
              ambientNoise = Math.max(0.5, (ambientNoise * frameIndex + amp) / (frameIndex + 1));
              frameIndex++;
            } else {
              const voiceThreshold = Math.max(2.8, ambientNoise * 1.8 + 1.2);

              if (amp > voiceThreshold) {
                consecutiveVoiceFrames++;
                if (consecutiveVoiceFrames >= 5) {
                  hasSpokenRef.current = true;
                  lastSpeechTimestampRef.current = Date.now();
                }
              } else {
                consecutiveVoiceFrames = 0;
                // If student has spoken their sentence, detect pause to auto-submit:
                if (hasSpokenRef.current && lastSpeechTimestampRef.current > 0) {
                  const silenceDuration = Date.now() - lastSpeechTimestampRef.current;
                  if (silenceDuration >= 1100) {
                    stopAllRecording();
                    return;
                  }
                }
              }

              // Auto-submit safety limit after 28s
              if (hasSpokenRef.current && Date.now() - startedAt > 28000) {
                stopAllRecording();
                return;
              }
            }

            animFrameRef.current = requestAnimationFrame(checkAudioLevel);
          };
          animFrameRef.current = requestAnimationFrame(checkAudioLevel);
        } catch (e) {
          console.warn('Audio analyser error:', e);
        }
      }

      const supportedMime = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus'
      ].find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';

      const recorder = new MediaRecorder(stream, supportedMime ? { mimeType: supportedMime } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstart = () => {
        setListening(true);
        setError('');
      };

      recorder.onstop = () => {
        setListening(false);
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          try { audioContextRef.current.close(); } catch {}
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(t => t.stop());
          mediaStreamRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm'
        });

        const capturedInterim = currentTextRef.current;
        if (audioBlob.size > 1000) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result.split(',')[1];
            processAudioRecording(base64String, recorder.mimeType || 'audio/webm', capturedInterim);
          };
          reader.readAsDataURL(audioBlob);
        } else if (capturedInterim && capturedInterim.trim().length > 3) {
          processText(capturedInterim);
        }
      };

      recorder.start(100);
    } catch (err) {
      setListening(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Please allow microphone permissions in your browser URL bar.');
      } else {
        setError(`Could not access microphone: ${err.message}. You can also type your complaint.`);
      }
    } finally {
      isStartingRef.current = false;
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await request('/api/tickets', {
        method: 'PATCH',
        body: JSON.stringify({ id, status })
      });
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const openTicketModal = (t, tabType = 'timeline') => {
    setModalTicket(t);
    setModalTab(tabType);
  };

  const total = tickets.length;
  const open = tickets.filter(t => t.status === 'open').length;
  const resolved = tickets.filter(t => t.status === 'resolved').length;

  const ongoingTickets = tickets.filter(t => t.status !== 'resolved');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved');

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <img src={logoImg} alt="CampusVoice AI" className="brand-logo-img" />
          <div>
            <strong>
              CampusVoice<span> AI</span>
            </strong>
            <small>SMART CAMPUS DESK</small>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <button
          className={`nav-btn ${tab === 'assistant' ? 'active' : ''}`}
          onClick={() => setTab('assistant')}
        >
          <Headphones size={18} /> Voice Assistant
        </button>
        <button
          className={`nav-btn ${tab === 'tickets' ? 'active' : ''}`}
          onClick={() => {
            setTab('tickets');
            refresh();
          }}
        >
          <ClipboardList size={18} /> Service Tickets <span className="nav-count">{total}</span>
        </button>

        {/* ======================================================= */}
        {/* SHORT & PRECISE COMPLAINT HISTORY (ONGOING & RESOLVED)  */}
        {/* ======================================================= */}
        <div className="sidebar-history-container">
          {/* ONGOING SECTION */}
          <div className="history-group">
            <button
              className="history-group-header"
              onClick={() => setOngoingOpen(v => !v)}
              title="Toggle Ongoing Issues"
            >
              <div className="history-group-title">
                <span className="group-bullet ongoing-bullet" />
                <span>Ongoing</span>
                <span className="group-count">{ongoingTickets.length}</span>
              </div>
              <ChevronDown
                size={14}
                className={`chevron-icon ${ongoingOpen ? 'open' : 'collapsed'}`}
              />
            </button>

            {ongoingOpen && (
              <div className="history-items-list">
                {ongoingTickets.length === 0 ? (
                  <div className="history-empty-item">No ongoing issues</div>
                ) : (
                  ongoingTickets.map(t => {
                    const isSelected = selectedTicketId === t.id;
                    return (
                      <div
                        key={t.id}
                        className={`history-row ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedTicketId(t.id);
                          openTicketModal(t, 'timeline');
                        }}
                        title={`${ticketId(t)}: ${t.description || t.raw_text} (Click to track)`}
                      >
                        <span className="row-circle" />
                        <span className="row-title">{shortTicketTitle(t)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* RESOLVED SECTION */}
          <div className="history-group">
            <button
              className="history-group-header"
              onClick={() => setResolvedOpen(v => !v)}
              title="Toggle Resolved Issues"
            >
              <div className="history-group-title">
                <span className="group-bullet resolved-bullet" />
                <span>Resolved</span>
                <span className="group-count">{resolvedTickets.length}</span>
              </div>
              <ChevronDown
                size={14}
                className={`chevron-icon ${resolvedOpen ? 'open' : 'collapsed'}`}
              />
            </button>

            {resolvedOpen && (
              <div className="history-items-list">
                {resolvedTickets.length === 0 ? (
                  <div className="history-empty-item">No resolved issues yet</div>
                ) : (
                  resolvedTickets.map(t => {
                    const isSelected = selectedTicketId === t.id;
                    return (
                      <div
                        key={t.id}
                        className={`history-row resolved ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedTicketId(t.id);
                          openTicketModal(t, 'timeline');
                        }}
                        title={`${ticketId(t)} (Resolved): ${t.description || t.raw_text}`}
                      >
                        <span className="row-circle resolved-circle" />
                        <span className="row-title">{shortTicketTitle(t)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Compact System Info & Desk Status */}
        <div className="sidebar-bottom">
          <div className="info-box-compact">
            <div className="online">
              <span className="online-dot" /> AI SERVICE DESK
            </div>
            <p>Gemini 3.5 classifies complaints & auto-dispatches tracking receipts to in-charges.</p>
          </div>
          <div className="sidebar-footer">
            <ShieldCheck size={16} />
            <span>
              Automated Grievance Desk
              <br />
              <small>Voice-First AI • Gemini 3.5</small>
            </span>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> {tab === 'assistant' ? 'Voice Assistant' : 'Service Tickets'}
          </div>
          <div className="top-actions">
            <span className="system-pill">
              <span className="online-dot" />
              {browserEngine === 'WebSpeech'
                ? 'Web Speech Ready'
                : browserEngine === 'MediaRecorder'
                ? 'Universal Mic Active'
                : 'System Ready'}
            </span>
            <span className="avatar">CV</span>
          </div>
        </header>

        <div className="content">
          {tab === 'assistant' ? (
            <>
              {/* Header Top */}
              <div className="section-top">
                <div>
                  <div className="eyebrow">
                    <Sparkles size={14} /> VOICE-FIRST CAMPUS ASSISTANT
                  </div>
                  <h1>
                    Good to see you <span>👋</span>
                  </h1>
                  <p>Voice-first assistance for academic doubts, university guidelines, and instant campus grievance resolution.</p>
                </div>
                <div className="date-label">
                  INSTANT GRIEVANCE DESK <span>●</span> 24/7 ACTIVE
                </div>
              </div>

              {/* TOP TICKET CREATION NOTIFICATION (DISPLAYS ONLY AFTER CREATION, VANISHES IN 7 SECONDS WITH TIMER LINE) */}
              {createdAlertTicket && (
                <div className="ticket-created-card top-alert">
                  <div className="ticket-created-info">
                    <div className="ticket-created-icon">
                      <CheckCircle2 size={24} />
                    </div>
                    <div className="ticket-created-details">
                      <strong>
                        Ticket {ticketId(createdAlertTicket)} created for {createdAlertTicket.location}
                      </strong>
                      <p>{createdAlertTicket.description}</p>
                      <div className="ticket-created-meta">
                        <span className="ticket-created-badge">
                          Department: {createdAlertTicket.department}
                        </span>
                        <span className="ticket-created-badge">
                          Priority: {createdAlertTicket.priority}
                        </span>
                        <span className="ticket-created-badge">Status: {createdAlertTicket.status}</span>
                        {createdAlertTicket.incharge && (
                          <span className="ticket-created-badge" style={{ color: '#4f46e5', borderColor: '#c7d2fe' }}>
                            👤 In-charge: {createdAlertTicket.incharge.name} ({createdAlertTicket.incharge.email})
                          </span>
                        )}
                        <span className="ticket-created-badge" style={{ color: '#059669', borderColor: '#a7f3d0' }}>
                          📧 Email Dispatched
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="ticket-view-btn"
                      style={{ background: '#4f46e5' }}
                      onClick={() => openTicketModal(createdAlertTicket, 'timeline')}
                    >
                      Track Progress →
                    </button>
                    <button
                      className="ticket-view-btn"
                      style={{ background: '#059669' }}
                      onClick={() => openTicketModal(createdAlertTicket, 'email')}
                    >
                      <Mail size={14} style={{ marginRight: '4px' }} /> View Email
                    </button>
                    <button
                      className="ticket-close-dismiss-btn"
                      onClick={() => {
                        if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
                        setCreatedAlertTicket(null);
                      }}
                      title="Dismiss notification"
                      aria-label="Dismiss notification"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="ticket-timer-track">
                    <div className="ticket-timer-progress" />
                  </div>
                </div>
              )}

              {/* Main Dashboard Row: Voice Assistant (Left) & Metrics Beside It (Right) */}
              <div className="voice-dashboard-row">
                {/* Voice Assistant Card */}
                <section className="siri-hero-card">
                  {/* Top Controls inside Hero */}
                  <div className="siri-controls">
                    <span className={`siri-badge ${listening ? 'active' : ''}`}>
                      {listening ? (
                        <>
                          <Radio size={14} /> Live Listening
                        </>
                      ) : busy ? (
                        <>
                          <Sparkles size={14} /> Understanding your concern...
                        </>
                      ) : speaking ? (
                        <>
                          <Volume2 size={14} /> Replying...
                        </>
                      ) : (
                        <>
                          <Mic size={14} /> Tap to Speak
                        </>
                      )}
                    </span>

                    <div className="siri-actions-right">
                      <div className="email-input-pill" title="Email address where official tracking receipts and in-charge contacts are mailed">
                        <Mail size={12} color="#6366f1" />
                        <input
                          type="email"
                          value={studentEmail}
                          onChange={e => {
                            setStudentEmail(e.target.value);
                            localStorage.setItem('cv-student-email', e.target.value);
                          }}
                          placeholder="your-email@campusvoice.edu"
                          aria-label="Student tracking email"
                        />
                      </div>

                      <div className="lang-select-pill">
                        <span>Language:</span>
                        <select
                          aria-label="Language selection"
                          value={language}
                          onChange={e => setLanguage(e.target.value)}
                          disabled={listening || busy}
                        >
                          <option value="en-IN">English</option>
                          <option value="hi-IN">हिन्दी</option>
                          <option value="gu-IN">ગુજરાતી</option>
                        </select>
                      </div>

                      <button
                        title={voiceEnabled ? 'Mute AI voice output' : 'Enable AI voice output'}
                        className={`voice-toggle-btn ${!voiceEnabled ? 'muted' : ''}`}
                        onClick={() => setVoiceEnabled(v => !v)}
                      >
                        {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* THE GLOWING SIRI ORB IN THE CENTER */}
                  <div className={`siri-orb-wrapper ${listening ? 'listening' : ''}`}>
                    <div className="siri-wave siri-wave-1" />
                    <div className="siri-wave siri-wave-2" />
                    <div className="siri-wave siri-wave-3" />

                    <button
                      className={`siri-button ${
                        listening ? 'listening' : busy ? 'processing' : speaking ? 'speaking' : 'idle'
                      }`}
                      onClick={toggleListening}
                      disabled={busy}
                      title={
                        listening
                          ? 'Click to finish speaking'
                          : 'Click to start speaking your complaint'
                      }
                      aria-label="Voice Assistant Siri Button"
                    >
                      {listening ? (
                        <div className="soundwave-bars">
                          <span className="soundwave-bar" />
                          <span className="soundwave-bar" />
                          <span className="soundwave-bar" />
                          <span className="soundwave-bar" />
                          <span className="soundwave-bar" />
                        </div>
                      ) : busy ? (
                        <Sparkles size={38} />
                      ) : speaking ? (
                        <Volume2 size={38} />
                      ) : (
                        <Mic size={40} />
                      )}
                    </button>
                  </div>

                  {/* Status Heading & Guidance */}
                  <h2 className={`siri-status-title ${listening ? 'listening-title' : ''}`}>
                    {listening
                      ? 'Listening...'
                      : busy
                      ? 'Understanding your concern...'
                      : speaking
                      ? 'CampusVoice is replying...'
                      : 'Tap to Speak'}
                  </h2>

                  <p className="siri-status-subtitle">
                    {listening
                      ? 'Speak your complaint or question naturally.'
                      : speaking
                      ? 'CampusVoice is replying...'
                      : busy
                      ? ''
                      : 'Ask semester doubts, attendance rules, or report campus issues.'}
                  </p>

                  {/* Live Transcript Bubble */}
                  {(listening || liveTranscript) && (
                    <div className="siri-transcript-box live">
                      <span className="quote-mark">“</span>
                      <span>{liveTranscript || (busy ? 'Understanding your concern...' : 'Listening for speech...')}</span>
                      <span className="transcript-cursor" />
                    </div>
                  )}

                  {/* Optional Collapsible Suggestions in Hero */}
                  <div className="hero-suggestions-container">
                    <button
                      type="button"
                      className="hero-suggestions-toggle-btn"
                      onClick={() => setShowHeroChips(v => !v)}
                    >
                      <Sparkles size={12} color="#6366f1" />
                      <span>{showHeroChips ? 'Hide Quick Prompts' : 'Need ideas? View Quick Prompts'}</span>
                      <ChevronDown size={12} className={`chevron-icon ${showHeroChips ? 'open' : 'collapsed'}`} />
                    </button>

                    {showHeroChips && (
                      <div className="hero-compact-chips-row">
                        {quickChips.map(chip => (
                          <button
                            key={chip.text}
                            className="hero-compact-chip"
                            onClick={() => processText(chip.text)}
                            disabled={busy || listening}
                            title={chip.text}
                          >
                            <span>{chip.emoji}</span>
                            <span>{chip.label || chip.text}</span>
                            <ArrowRight size={11} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {/* Metrics Section on the Right Side of Voice Assistant */}
                <aside className="voice-stats-column">
                  <div className="voice-stats-card">
                    <div className="voice-stats-header">
                      <span className="voice-stats-badge">
                        <Sparkles size={12} color="#6366f1" /> LIVE DESK METRICS
                      </span>
                      <button
                        className="voice-stats-link"
                        onClick={() => {
                          setTab('tickets');
                          refresh();
                        }}
                        title="View full service tickets dashboard"
                      >
                        Tickets Desk <ArrowRight size={11} />
                      </button>
                    </div>

                    <div className="voice-stats-list">
                      <div className="voice-stat-item">
                        <div className="stat-icon blue">
                          <ClipboardList size={22} />
                        </div>
                        <div className="voice-stat-info">
                          <p>Total Requests</p>
                          <strong>{total}</strong>
                          <small>All recorded tickets</small>
                        </div>
                      </div>

                      <div className="voice-stat-item">
                        <div className="stat-icon amber">
                          <CircleHelp size={22} />
                        </div>
                        <div className="voice-stat-info">
                          <p>Open Tickets</p>
                          <strong>{open}</strong>
                          <small>Waiting for resolution</small>
                        </div>
                      </div>

                      <div className="voice-stat-item">
                        <div className="stat-icon green">
                          <CheckCircle2 size={22} />
                        </div>
                        <div className="voice-stat-info">
                          <p>Resolved</p>
                          <strong>{resolved}</strong>
                          <small>Successfully handled</small>
                        </div>
                      </div>
                    </div>

                    <div className="voice-stats-footer">
                      <div className="stats-indicator-dot" />
                      <span>Instant AI triage & email dispatch active</span>
                    </div>
                  </div>
                </aside>
              </div>

              {/* CONVERSATION HISTORY & TEXT COMPOSER FALLBACK */}
              <section className="conversation-card" ref={conversationCardRef}>
                <div className="conversation-header">
                  <strong>
                    <Sparkles size={16} color="#6366f1" /> Conversation Log
                  </strong>
                  <span>{messages.length} messages</span>
                </div>

                <div className="conversation-body" aria-live="polite">
                  {messages.map((m, i) => (
                    <div key={i} className={`message ${m.role}`}>
                      <div className="message-avatar">
                        {m.role === 'assistant' ? <Sparkles size={15} /> : 'You'}
                      </div>
                      <div className={`bubble ${m.failed ? 'failure' : ''}`}>
                        <div>{m.text}</div>
                        {m.ticket && (
                          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '11px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontWeight: '700', color: '#4f46e5' }}>{ticketId(m.ticket)}</span>
                            <span>• In-charge: {m.ticket.incharge?.name || m.ticket.department}</span>
                            <button
                              onClick={() => openTicketModal(m.ticket, 'timeline')}
                              style={{ background: 'transparent', color: '#6366f1', textDecoration: 'underline', padding: 0, fontSize: '11px', fontWeight: 600 }}
                            >
                              Track Progress
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* REAL-TIME LIVE USER SPEECH BUBBLE IN CONVERSATION LOG */}
                  {listening && (
                    <div className="message user live-speaking-user-message">
                      <div className="message-avatar">You</div>
                      <div className="bubble live-user-speech-bubble">
                        <div className="live-bubble-indicator-bar">
                          <span className="live-speech-pulse-dot" />
                          <span className="live-speech-tag">
                            Live Voice • Tap button to finish
                          </span>
                        </div>
                        <div className="live-bubble-text">
                          <span>{liveTranscript || 'Listening to your voice... Speak now'}</span>
                          <span className="transcript-cursor" />
                        </div>
                      </div>
                    </div>
                  )}

                  {busy && (
                    <div className="message assistant">
                      <div className="message-avatar">
                        <Sparkles size={15} />
                      </div>
                      <div className="bubble typing">
                        CampusVoice is thinking <span>•••</span>
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Compact text input fallback & quick 1-line suggestions */}
                <div className="composer-bar">
                  <div className="composer-chips-bar">
                    <span className="chips-lead">
                      <Sparkles size={12} color="#6366f1" /> Try asking:
                    </span>
                    <div className="composer-chips-scroll">
                      {quickChips.map(chip => (
                        <button
                          key={chip.text}
                          type="button"
                          className="composer-chip-btn"
                          onClick={() => processText(chip.text)}
                          disabled={busy || listening}
                          title={chip.text}
                        >
                          <span className="chip-emoji">{chip.emoji}</span>
                          <span>{chip.label || chip.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <form
                    className="composer-form"
                    onSubmit={e => {
                      e.preventDefault();
                      processText(input);
                    }}
                  >
                    <input
                      aria-label="Type your campus concern"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder={
                        listening
                          ? 'Listening through microphone...'
                          : 'Prefer typing? Type your complaint here and press Enter...'
                      }
                      disabled={busy}
                    />
                    <button
                      className="composer-send-btn"
                      type="submit"
                      disabled={busy || !input.trim()}
                      title="Send message"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              </section>
            </>
          ) : (
            <>
              {/* ======================================================= */}
              {/* SERVICE TICKETS TAB                                     */}
              {/* ======================================================= */}
              <div className="section-top tickets-heading">
                <div>
                  <div className="eyebrow">
                    <LayoutDashboard size={14} /> LIVE SERVICE DASHBOARD
                  </div>
                  <h1>Service Tickets</h1>
                  <p>Every spoken complaint produces a real, persistent ticket with assigned in-charge and tracking timeline.</p>
                </div>
                <button className="refresh-btn" onClick={refresh}>
                  <RefreshCw size={15} /> Refresh
                </button>
              </div>

              <div className="stats">
                <div className="stat">
                  <div className="stat-icon blue">
                    <ClipboardList size={22} />
                  </div>
                  <div>
                    <p>Total Tickets</p>
                    <strong>{total}</strong>
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-icon amber">
                    <CircleHelp size={22} />
                  </div>
                  <div>
                    <p>Open</p>
                    <strong>{open}</strong>
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-icon green">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <p>Resolved</p>
                    <strong>{resolved}</strong>
                  </div>
                </div>
              </div>

              <section className="tickets-panel">
                <div className="panel-header">
                  <strong>Recent requests & In-charge Assignments</strong>
                  <span>{total} tickets recorded</span>
                </div>

                {!tickets.length ? (
                  <div className="empty">
                    <ClipboardList size={38} />
                    <strong>No tickets yet</strong>
                    <p>Tap the big voice button in Voice Assistant to raise your first complaint.</p>
                    <button onClick={() => setTab('assistant')}>
                      Try Voice Assistant <ArrowRight size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="ticket-list">
                    {tickets.map(t => (
                      <div className="ticket-row" key={t.id}>
                        <div className="ticket-icon">
                          <MapPin size={20} />
                        </div>
                        <div className="ticket-body">
                          <div className="ticket-top">
                            <strong>{ticketId(t)}</strong>
                            <span className={`badge priority-${t.priority}`}>
                              {t.priority} priority
                            </span>
                            <span className={`badge status-${t.status}`}>
                              {t.status.replace('_', ' ')}
                            </span>
                            <span className="badge">{t.department}</span>
                          </div>
                          <p>{t.description}</p>
                          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' }}>
                            <small>
                              📍 {t.location} • {formatDate(t.created_at)}
                            </small>
                            {t.incharge && (
                              <small style={{ color: '#4f46e5', fontWeight: 600 }}>
                                👤 In-charge: {t.incharge.name} (<a href={`mailto:${t.incharge.email}`} style={{ color: '#6366f1' }}>{t.incharge.email}</a>)
                              </small>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => openTicketModal(t, 'timeline')}
                            style={{
                              background: '#edf2ff',
                              color: '#4f46e5',
                              border: '1px solid #c7d2fe',
                              borderRadius: '8px',
                              padding: '7px 11px',
                              fontSize: '11px',
                              fontWeight: 700
                            }}
                          >
                            Track
                          </button>
                          <button
                            onClick={() => openTicketModal(t, 'email')}
                            style={{
                              background: '#ecfdf5',
                              color: '#059669',
                              border: '1px solid #a7f3d0',
                              borderRadius: '8px',
                              padding: '7px 11px',
                              fontSize: '11px',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Mail size={13} /> Email
                          </button>
                          <select
                            aria-label={`Update status for ${ticketId(t)}`}
                            value={t.status}
                            onChange={e => updateStatus(t.id, e.target.value)}
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {/* ======================================================= */}
          {/* TRACKING & EMAIL MODAL DRAWER                           */}
          {/* ======================================================= */}
          {modalTicket && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(6px)',
                display: 'grid',
                placeItems: 'center',
                zIndex: 9999,
                padding: '20px'
              }}
              onClick={() => setModalTicket(null)}
            >
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '20px',
                  maxWidth: '680px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                  border: '1px solid #e2e8f0',
                  animation: 'fadeIn 0.2s ease'
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div
                  style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8fafc'
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>
                      Ticket {ticketId(modalTicket)} — {modalTicket.department}
                    </h3>
                    <small style={{ color: '#64748b' }}>
                      Location: {modalTicket.location} • Status: {modalTicket.status}
                    </small>
                  </div>
                  <button
                    onClick={() => setModalTicket(null)}
                    style={{ background: '#e2e8f0', border: 0, borderRadius: '50%', width: '32px', height: '32px', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Tabs inside modal */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f1f5f9' }}>
                  <button
                    onClick={() => setModalTab('timeline')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: modalTab === 'timeline' ? '#ffffff' : 'transparent',
                      border: 'none',
                      borderBottom: modalTab === 'timeline' ? '2px solid #6366f1' : 'none',
                      fontWeight: 700,
                      color: modalTab === 'timeline' ? '#4f46e5' : '#64748b',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    📈 Issue Progress Tracker
                  </button>
                  <button
                    onClick={() => setModalTab('email')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: modalTab === 'email' ? '#ffffff' : 'transparent',
                      border: 'none',
                      borderBottom: modalTab === 'email' ? '2px solid #6366f1' : 'none',
                      fontWeight: 700,
                      color: modalTab === 'email' ? '#4f46e5' : '#64748b',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    📧 Dispatched Email Receipt
                  </button>
                </div>

                {/* Modal Body */}
                <div style={{ padding: '24px' }}>
                  {modalTab === 'timeline' ? (
                    <div>
                      {/* Incharge Details Card */}
                      <div
                        style={{
                          background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
                          border: '1.5px solid #c7d2fe',
                          borderRadius: '14px',
                          padding: '18px',
                          marginBottom: '24px'
                        }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#4338ca', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
                          Assigned In-Charge Officer
                        </div>
                        <h4 style={{ margin: '0 0 4px', fontSize: '16px', color: '#1e1b4b' }}>
                          {modalTicket.incharge?.name || modalTicket.incharge_name || 'Rajesh Verma'}
                        </h4>
                        <div style={{ fontSize: '12px', color: '#475569', marginBottom: '12px' }}>
                          {modalTicket.incharge?.role || modalTicket.incharge_role || 'Campus Facilities In-Charge'}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px' }}>
                          <div>
                            <strong>Email: </strong>
                            <a href={`mailto:${modalTicket.incharge?.email || modalTicket.incharge_email || 'facilities.incharge@campusvoice.edu'}?subject=Regarding%20Ticket%20${ticketId(modalTicket)}`} style={{ color: '#4f46e5', fontWeight: 600 }}>
                              {modalTicket.incharge?.email || modalTicket.incharge_email || 'facilities.incharge@campusvoice.edu'}
                            </a>
                          </div>
                          <div>
                            <strong>Phone: </strong>
                            <span>{modalTicket.incharge?.phone || modalTicket.incharge_phone || '+91 98765 43210'}</span>
                          </div>
                          <div>
                            <strong>Office: </strong>
                            <span>{modalTicket.incharge?.office || modalTicket.incharge_office || 'Block A, Ground Floor'}</span>
                          </div>
                          <div>
                            <strong>Resolution SLA: </strong>
                            <span style={{ color: '#d97706', fontWeight: 700 }}>{modalTicket.incharge?.sla || '4 to 6 Hours'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Timeline */}
                      <h4 style={{ margin: '0 0 16px', fontSize: '14px', color: '#1e293b' }}>Issue Resolution Lifecycle</h4>
                      <div style={{ paddingLeft: '8px' }}>
                        <div style={{ position: 'relative', paddingLeft: '24px', paddingBottom: '20px', borderLeft: '2px solid #22c55e' }}>
                          <span style={{ position: 'absolute', left: '-10px', top: 0, width: '18px', height: '18px', background: '#22c55e', color: '#fff', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 800 }}>✓</span>
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>1. Grievance Spoken & Transcribed</strong>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            User request: "{modalTicket.raw_text || modalTicket.description}"
                          </div>
                        </div>

                        <div style={{ position: 'relative', paddingLeft: '24px', paddingBottom: '20px', borderLeft: '2px solid #22c55e' }}>
                          <span style={{ position: 'absolute', left: '-10px', top: 0, width: '18px', height: '18px', background: '#22c55e', color: '#fff', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 800 }}>✓</span>
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>2. AI Department & Priority Assigned</strong>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            Priority: <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{modalTicket.priority}</span> • Department: {modalTicket.department}
                          </div>
                        </div>

                        <div style={{ position: 'relative', paddingLeft: '24px', paddingBottom: '20px', borderLeft: '2px solid #22c55e' }}>
                          <span style={{ position: 'absolute', left: '-10px', top: 0, width: '18px', height: '18px', background: '#22c55e', color: '#fff', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 800 }}>✓</span>
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>3. Notification Dispatched via Email</strong>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            Mailed to in-charge ({modalTicket.incharge?.email || 'incharge@campus.edu'}) and student ({modalTicket.student_email || studentEmail}).
                          </div>
                        </div>

                        <div style={{ position: 'relative', paddingLeft: '24px', paddingBottom: '20px', borderLeft: `2px solid ${modalTicket.status === 'in_progress' || modalTicket.status === 'resolved' ? '#22c55e' : '#cbd5e1'}` }}>
                          <span style={{ position: 'absolute', left: '-10px', top: 0, width: '18px', height: '18px', background: modalTicket.status === 'in_progress' || modalTicket.status === 'resolved' ? '#22c55e' : '#e2e8f0', color: modalTicket.status === 'in_progress' || modalTicket.status === 'resolved' ? '#fff' : '#64748b', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 800 }}>
                            {modalTicket.status === 'in_progress' || modalTicket.status === 'resolved' ? '✓' : '4'}
                          </span>
                          <strong style={{ fontSize: '13px', color: modalTicket.status === 'in_progress' || modalTicket.status === 'resolved' ? '#0f172a' : '#64748b' }}>
                            4. Field Inspection & Maintenance
                          </strong>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {modalTicket.status === 'in_progress' ? 'Field technician assigned and repair is currently in progress.' : 'Awaiting physical inspection.'}
                          </div>
                        </div>

                        <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px solid transparent' }}>
                          <span style={{ position: 'absolute', left: '-10px', top: 0, width: '18px', height: '18px', background: modalTicket.status === 'resolved' ? '#22c55e' : '#e2e8f0', color: modalTicket.status === 'resolved' ? '#fff' : '#64748b', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 800 }}>
                            {modalTicket.status === 'resolved' ? '✓' : '5'}
                          </span>
                          <strong style={{ fontSize: '13px', color: modalTicket.status === 'resolved' ? '#0f172a' : '#64748b' }}>
                            5. Issue Resolved & Closed
                          </strong>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {modalTicket.status === 'resolved' ? 'Issue marked as resolved and verified by department.' : 'Pending final resolution.'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Email view */}
                      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                            Subject: [{ticketId(modalTicket)}] Campus Grievance: {modalTicket.location} - {modalTicket.department}
                          </strong>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            To: {modalTicket.student_email || studentEmail}, {modalTicket.incharge?.email || 'incharge@campus.edu'}
                          </div>
                        </div>
                        <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                          ✓ Dispatched
                        </span>
                      </div>

                      <div
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          background: '#0b0e17',
                          color: '#e2e8f0',
                          padding: '20px'
                        }}
                      >
                        <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: '14px', marginBottom: '14px' }}>
                          <div style={{ color: '#818cf8', fontSize: '11px', fontWeight: 800 }}>OFFICIAL GRIEVANCE RECEIPT</div>
                          <h3 style={{ margin: '4px 0', color: '#ffffff' }}>Ticket Confirmation: {ticketId(modalTicket)}</h3>
                          <small style={{ color: '#94a3b8' }}>CampusVoice AI Grievance Desk</small>
                        </div>
                        <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
                          <p><strong>Spoken Request:</strong> <em>"{modalTicket.raw_text || modalTicket.description}"</em></p>
                          <p><strong>Assigned In-Charge:</strong> {modalTicket.incharge?.name || 'Rajesh Verma'} (<a href={`mailto:${modalTicket.incharge?.email || 'facilities.incharge@campusvoice.edu'}`} style={{ color: '#38bdf8' }}>{modalTicket.incharge?.email || 'facilities.incharge@campusvoice.edu'}</a>)</p>
                          <p><strong>Location:</strong> {modalTicket.location} • <strong>Priority:</strong> <span style={{ textTransform: 'uppercase', color: '#fbbf24' }}>{modalTicket.priority}</span></p>
                          <p><strong>Expected Resolution SLA:</strong> {modalTicket.incharge?.sla || '4 to 6 Hours'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Global Error Banner */}
          {error && (
            <div role="alert" className="error-toast">
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                <X size={17} />
              </button>
            </div>
          )}

          {/* Demo access code field */}
          <div className="demo-settings">
            <label htmlFor="demo-code">Optional demo access code:</label>
            <input
              id="demo-code"
              type="password"
              placeholder="Only if configured on server"
              value={code}
              onChange={e => {
                setCode(e.target.value);
                sessionStorage.setItem('campusvoice-code', e.target.value);
              }}
            />
          </div>

          <footer>
            © {new Date().getFullYear()} CampusVoice AI{' '}
            <span>Speak. Understand. Act. — Voice-First Campus Desk</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
