'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  ShieldAlert,
  FileText,
  Clock,
  RotateCcw,
  X,
  ChevronDown,
  Info,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { medimateService, type MediMateMessage } from '@/services/medimateService';

interface MediMateChatProps {
  isOpen?: boolean;
  onClose?: () => void;
  isFloating?: boolean;
}

const QUICK_PROMPTS = [
  'Explain my recent HbA1c test',
  'What are my active medications?',
  'Summarize my last doctor visit',
  'Questions to ask my doctor at next visit',
  'Check my allergy warnings'
];

export function MediMateChat({
  isOpen = true,
  onClose,
  isFloating = false
}: MediMateChatProps) {
  const [messages, setMessages] = useState<MediMateMessage[]>(() =>
    medimateService.getInitialMessages()
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: MediMateMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const response = await medimateService.generateResponse(text);
      setMessages((prev) => [...prev, response]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: 'medimate',
          text: 'I encountered an error retrieving that record. Please try again or rephrase your inquiry.',
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages(medimateService.getInitialMessages());
  };

  if (!isOpen) return null;

  return (
    <div
      className={`medimate-container flex flex-col bg-white border border-[#DFE7E4] shadow-xl ${
        isFloating
          ? 'fixed bottom-6 right-6 w-[420px] max-w-[92vw] h-[640px] max-h-[85vh] rounded-2xl z-50 overflow-hidden'
          : 'w-full h-[620px] rounded-2xl overflow-hidden'
      }`}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-[#133840] to-[#1C4D57] px-4 py-3.5 text-white flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
            <Sparkles size={18} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm tracking-wide text-white">MediMate</h3>
              <span className="text-[10px] font-medium tracking-wider uppercase bg-teal-800/80 text-teal-200 px-1.5 py-0.5 rounded border border-teal-600/40">
                Personal AI
              </span>
            </div>
            <p className="text-[11px] text-teal-200/80">
              Grounded in Ananya Deshmukh (UHID-MH-902144)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            title="Reset conversation"
            className="p-1.5 text-teal-200/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <RotateCcw size={15} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Close assistant"
              className="p-1.5 text-teal-200/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={17} />
            </button>
          )}
        </div>
      </div>

      {/* Grounding Status Bar */}
      <div className="bg-[#F4F9F6] border-b border-[#DFE7E4] px-4 py-1.5 flex items-center justify-between text-[11px] text-[#476057] shrink-0">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 size={13} className="text-teal-600" />
          <span>Patient records verified & synchronized</span>
        </span>
        <span className="text-[10px] font-mono text-[#607582]">Strict Clinical Guardrails Active</span>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF9F6]">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
            >
              <div
                className={`flex gap-2.5 max-w-[88%] ${
                  isUser ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    isUser
                      ? 'bg-[#133840] text-white text-xs font-semibold'
                      : 'bg-teal-100 text-teal-800 border border-teal-200'
                  }`}
                >
                  {isUser ? <User size={13} /> : <Bot size={14} />}
                </div>

                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-sm ${
                    isUser
                      ? 'bg-[#133840] text-white rounded-tr-none'
                      : 'bg-white border border-[#E3ECE7] text-[#193238] rounded-tl-none'
                  }`}
                >
                  {/* Message formatted text */}
                  <div className="whitespace-pre-wrap space-y-2">
                    {msg.text.split('\n\n').map((paragraph, i) => (
                      <p key={i}>
                        {paragraph.split('**').map((chunk, j) =>
                          j % 2 === 1 ? (
                            <strong key={j} className="font-semibold text-teal-950">
                              {chunk}
                            </strong>
                          ) : (
                            chunk
                          )
                        )}
                      </p>
                    ))}
                  </div>

                  {/* Citations Footer */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-[#6A8179] flex items-center gap-1">
                        <FileText size={11} />
                        Citations & Source Records:
                      </div>
                      <div className="space-y-0.5">
                        {msg.citations.map((cite, cIdx) => (
                          <div
                            key={cIdx}
                            className="bg-[#F0F6F3] rounded px-2 py-0.5 text-[11px] text-[#244A42] flex items-center justify-between border border-[#DFEAE4]"
                          >
                            <span className="font-medium truncate mr-2">{cite.source}</span>
                            <span className="text-[10px] text-[#6A8179] shrink-0 font-mono">
                              {cite.date}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className={`text-[9px] mt-1 text-right ${
                      isUser ? 'text-teal-200/70' : 'text-slate-400'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-2.5 max-w-[85%]">
            <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 border border-teal-200 flex items-center justify-center shrink-0">
              <Bot size={14} />
            </div>
            <div className="bg-white border border-[#E3ECE7] rounded-2xl rounded-tl-none px-4 py-3 text-xs text-[#607582] flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-teal-600 animate-ping" />
              <span>MediMate is reviewing your clinical records...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar */}
      <div className="bg-[#FAF9F6] border-t border-[#E8ECE9] px-3 py-2 overflow-x-auto no-scrollbar flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-[#71867E] uppercase tracking-wider font-semibold shrink-0 flex items-center gap-1 pl-1">
          <HelpCircle size={11} /> Suggested:
        </span>
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            disabled={loading}
            onClick={() => handleSend(prompt)}
            className="text-[11px] whitespace-nowrap bg-white hover:bg-[#EEF5F1] text-[#204940] px-2.5 py-1 rounded-full border border-[#D5E2DC] transition-all hover:border-teal-500 shrink-0 font-medium disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-3 bg-white border-t border-[#DFE7E4] shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about test results, medications, doctor advice..."
            disabled={loading}
            className="flex-1 bg-[#F7F9F8] border border-[#D5E0DC] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#133840] placeholder:text-[#8CA09A] focus:outline-none focus:border-teal-600 focus:bg-white transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl bg-[#133840] hover:bg-[#0E7068] text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:hover:bg-[#133840] shrink-0"
            title="Send query"
          >
            <Send size={16} />
          </button>
        </form>

        <p className="text-[10px] text-[#768D84] text-center mt-1.5 flex items-center justify-center gap-1">
          <Info size={10} />
          MediMate explains your verified records. For emergencies, call 112 / 108.
        </p>
      </div>
    </div>
  );
}
