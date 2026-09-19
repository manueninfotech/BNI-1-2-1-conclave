import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Clock,
  Calendar
} from 'lucide-react';
import { downloadOrViewAgendaDocument, extractTextFromPdfDataUrl } from '../../utils/documentUtils';
import { api } from '../../services/api';
import { formatTimeRangeNice } from '../../utils/timeFormat';

export default function CaptainSchedule({ loggedInCaptain, onTabChange, conclaveSyncData: propConclaveSyncData }) {
  const [syncData, setSyncData] = useState(() => {
    if (propConclaveSyncData) return propConclaveSyncData;
    const cached = localStorage.getItem('bni_conclave_sync_data_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { }
    }
    return null;
  });

  useEffect(() => {
    if (propConclaveSyncData) {
      setSyncData(propConclaveSyncData);
      localStorage.setItem('bni_conclave_sync_data_cache', JSON.stringify(propConclaveSyncData));
    }
  }, [propConclaveSyncData]);

  const conclaveSyncData = syncData || propConclaveSyncData;
  const conclaveId = conclaveSyncData?.conclaveStatus?.id || conclaveSyncData?.conclaveId;

  const [fetchedAgendaDoc, setFetchedAgendaDoc] = useState(null);

  useEffect(() => {
    async function fetchConclaveAgendaDoc() {
      if (!conclaveId) {
        setFetchedAgendaDoc(null);
        return;
      }
      try {
        const list = await api.get('/conclaves');
        if (Array.isArray(list)) {
          const currentConclave = list.find(c => c.id === conclaveId);
          if (currentConclave && currentConclave.agendaDocument) {
            setFetchedAgendaDoc(currentConclave.agendaDocument);
            localStorage.setItem(`bni_agenda_doc_${conclaveId}`, JSON.stringify(currentConclave.agendaDocument));
          } else {
            setFetchedAgendaDoc(null);
            localStorage.removeItem(`bni_agenda_doc_${conclaveId}`);
          }
        }
      } catch (err) {
        console.error('Failed to fetch agenda document:', err);
      }
    }
    fetchConclaveAgendaDoc();
  }, [conclaveId]);

  const getUploadedAgendaDoc = () => {
    // Strictly return agenda document for THIS conclave only
    if (conclaveSyncData?.conclaveStatus?.agendaDocument) return conclaveSyncData.conclaveStatus.agendaDocument;
    if (conclaveSyncData?.agendaDocument) return conclaveSyncData.agendaDocument;
    if (fetchedAgendaDoc) return fetchedAgendaDoc;

    if (conclaveId) {
      const cached = localStorage.getItem(`bni_agenda_doc_${conclaveId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.url || parsed.dataUrl)) return parsed;
        } catch (e) { }
      }
    }

    return null;
  };

  const agendaDoc = useMemo(() => {
    return getUploadedAgendaDoc();
  }, [conclaveSyncData, fetchedAgendaDoc, conclaveId]);

  const rawAgendaText = useMemo(() => {
    if (agendaDoc?.rawText) return agendaDoc.rawText;
    if (agendaDoc?.agendaText) return agendaDoc.agendaText;
    if (agendaDoc?.dataUrl) {
      const extracted = extractTextFromPdfDataUrl(agendaDoc.dataUrl);
      if (extracted && extracted.trim().length > 0) return extracted;
    }

    if (conclaveSyncData?.agendaText) return conclaveSyncData.agendaText;
    if (conclaveSyncData?.conclave?.agendaText) return conclaveSyncData.conclave.agendaText;

    const conclaveId = conclaveSyncData?.conclaveStatus?.id || conclaveSyncData?.conclaveId;
    if (conclaveId) {
      const cached = localStorage.getItem(`bni_agenda_text_${conclaveId}`);
      if (cached) return cached;
    }

    if (!agendaDoc) {
      return localStorage.getItem('bni_conclave_agenda_text');
    }

    return null;
  }, [agendaDoc, conclaveSyncData]);

  // Strict timing-based timeline parser: Extracts items ONLY when explicit timings exist, plus description text
  const timelineEvents = useMemo(() => {
    if (!rawAgendaText) return [];
    const lines = rawAgendaText.split('\n').map(l => l.trim()).filter(Boolean);
    const events = [];
    let currentEvent = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match explicit timings e.g. 09:30 AM, 10:00 - 11:00, 10:00 AM – 11:00 AM
      const timeMatch = line.match(/(\d{1,2}:\d{2}(?:\s*(?:AM|PM|am|pm))?(?:\s*[-–—]\s*\d{1,2}:\d{2}(?:\s*(?:AM|PM|am|pm))?)?)/i);

      if (timeMatch && (/(?:AM|PM|am|pm)/i.test(timeMatch[1]) || /^\d{1,2}:\d{2}/.test(line.trim()))) {
        if (currentEvent && currentEvent.title) {
          events.push(currentEvent);
        }

        const timeStr = formatTimeRangeNice(timeMatch[1].trim());
        let titleText = line.replace(timeMatch[0], '').replace(/^[-–—:\s]+/, '').trim();

        currentEvent = {
          time: timeStr,
          title: titleText || '',
          desc: ''
        };
      } else if (currentEvent) {
        const cleanLine = line.replace(/^[-–—:\s]+/, '').trim();
        if (cleanLine) {
          if (!currentEvent.title) {
            currentEvent.title = cleanLine;
          } else {
            currentEvent.desc = currentEvent.desc
              ? `${currentEvent.desc} ${cleanLine}`
              : cleanLine;
          }
        }
      }
    }

    if (currentEvent && currentEvent.title) {
      events.push(currentEvent);
    }

    return events.filter(e => e.title && e.title.toLowerCase() !== 'program');
  }, [rawAgendaText]);

  return (
    <div className="space-y-8 animate-fade-in font-sans pb-16">

      {/* Page Header */}
      <div>
        <h1 className="text-[20px] font-black text-zinc-955 leading-tight">Conclave Program Schedule</h1>
        <p className="text-[11.5px] text-zinc-500 font-semibold mt-0.5">Official timeline and published agenda document uploaded by Admin.</p>
      </div>

      {/* Published Conclave Agenda Dark Banner (if uploaded by Admin) */}
      {agendaDoc && (
        <div className="bg-gradient-to-r from-emerald-950 via-zinc-900 to-zinc-950 text-white rounded-2xl p-6 shadow-md border border-emerald-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-400/30 shrink-0">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9.5px] font-black tracking-wider uppercase text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded border border-emerald-400/30">
                  Published Conclave Agenda
                </span>
                <span className="text-xs text-zinc-300 font-medium">{agendaDoc.size || 'PDF Document'}</span>
              </div>
              <h2 className="text-xl font-black text-white mt-1.5">{agendaDoc.name || 'Official Conclave Agenda.pdf'}</h2>
              <p className="text-xs text-zinc-350 font-medium mt-1">
                Click below to open and view the complete official conclave agenda document.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
            <button
              onClick={() => downloadOrViewAgendaDocument(agendaDoc)}
              type="button"
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-955 font-black text-button rounded-xl transition-smooth shadow-md cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              View / Open Agenda File
            </button>
          </div>
        </div>
      )}

      {/* Pure, Cardless Minimal Vertical Timeline */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-8">

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-150 pb-4">
          <div>
            <h3 className="text-body-md font-black text-zinc-955 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-red" />
              Conclave Program Timeline
            </h3>
            <p className="text-[11.5px] text-zinc-500 font-semibold mt-0.5">
              Chronological timeline extracted directly from the official agenda document
            </p>
          </div>
        </div>

        {timelineEvents.length > 0 ? (
          <div className="relative pl-8 space-y-7 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-200">
            {timelineEvents.map((item, idx) => (
              <div key={idx} className="relative flex items-center justify-between gap-4 py-1 border-b border-zinc-100/80 last:border-0 pb-5 last:pb-0">

                {/* Timeline Red Dot Node */}
                <div className="absolute -left-[37px] top-2.5 w-3 h-3 rounded-full bg-brand-red ring-4 ring-white"></div>

                {/* Minimal Event Title, Description & Time */}
                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[14px] font-bold text-zinc-900 leading-snug">
                      {item.title}
                    </span>
                    <span className="text-[12.5px] font-bold text-brand-red tracking-tight shrink-0 font-mono">
                      {item.time}
                    </span>
                  </div>
                  {item.desc && (
                    <p className="text-[12px] text-zinc-500 font-normal leading-relaxed mt-0.5">
                      {item.desc}
                    </p>
                  )}
                </div>

              </div>
            ))}
          </div>
        ) : rawAgendaText ? (
          <div className="p-6 bg-zinc-50/80 rounded-2xl border border-zinc-200/80 text-[13.5px] font-medium text-zinc-900 leading-relaxed font-sans whitespace-pre-wrap select-text max-h-[700px] overflow-y-auto">
            {rawAgendaText}
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-400 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-zinc-900">No Agenda Document Uploaded Yet</h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto font-medium">
              The official conclave agenda document has not been published by Admin yet.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
