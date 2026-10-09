import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  FileText,
  Mail,
  Video,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Info
} from 'lucide-react';
import { crmService } from '../../services/crm';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';

export function AiAssistantPanel({ lead, onActivityLogged }) {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'draft' | 'prep'
  const [options, setOptions] = useState({
    tones: [
      { id: 'PROFESSIONAL', label: 'Professional & Consultative' },
      { id: 'FRIENDLY', label: 'Warm & Relationship-Driven' },
      { id: 'CONCISE', label: 'Direct & Concise' }
    ],
    objectives: [
      { id: 'FOLLOW_UP_DEMO_REQUEST', label: 'Follow up on demo request' },
      { id: 'REQUEST_MEETING', label: 'Request introductory discovery meeting' },
      { id: 'FOLLOW_UP_PROPOSAL', label: 'Follow up on submitted proposal' },
      { id: 'REENGAGE_INACTIVE', label: 'Re-engage inactive or stalled prospect' },
      { id: 'GENERAL_TOUCHPOINT', label: 'General check-in / value-add touchpoint' }
    ],
    meetingTypes: [
      { id: 'INITIAL_DISCOVERY', label: 'Initial Discovery Call' },
      { id: 'DEMO_WALKTHROUGH', label: 'Product Demo & Walkthrough' },
      { id: 'SOLUTION_PRESENTATION', label: 'Tailored Solution Presentation' },
      { id: 'COMMERCIAL_PROPOSAL_REVIEW', label: 'Commercial & Proposal Review' },
      { id: 'EXECUTIVE_ALIGNMENT', label: 'Executive Stakeholder Alignment' }
    ]
  });

  // State: Executive Summary
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // State: Follow-up Draft
  const [draftTone, setDraftTone] = useState('PROFESSIONAL');
  const [draftObjective, setDraftObjective] = useState('REQUEST_MEETING');
  const [draftContext, setDraftContext] = useState('');
  const [draftResult, setDraftResult] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState(null);
  const [editableBody, setEditableBody] = useState('');

  // State: Meeting Prep
  const [meetingType, setMeetingType] = useState('INITIAL_DISCOVERY');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [prepResult, setPrepResult] = useState(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepError, setPrepError] = useState(null);

  // Copy feedback
  const [copiedKey, setCopiedKey] = useState(null);

  // Load server options if available
  useEffect(() => {
    let isMounted = true;
    crmService.getAiOptions()
      .then((res) => {
        if (isMounted && res?.data?.data) {
          setOptions(res.data.data);
        }
      })
      .catch(() => {
        // Fallback default options already in state
      });
    return () => { isMounted = false; };
  }, []);

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Generate Executive Summary
  const handleGenerateSummary = async () => {
    if (!lead?.id) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await crmService.generateLeadAiSummary(lead.id);
      const data = res?.data?.data?.summary || res?.data?.summary;
      setSummary(data);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to generate AI lead summary';
      setSummaryError(msg);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Generate Follow-up Draft
  const handleGenerateDraft = async (e) => {
    e?.preventDefault();
    if (!lead?.id) return;
    setDraftLoading(true);
    setDraftError(null);
    try {
      const payload = {
        tone: draftTone,
        objective: draftObjective,
        additionalContext: draftContext.trim() || undefined
      };
      const res = await crmService.generateAiFollowUpDraft(lead.id, payload);
      const data = res?.data?.data?.draft || res?.data?.draft;
      setDraftResult(data);
      setEditableBody(data?.body || '');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to generate email draft';
      setDraftError(msg);
    } finally {
      setDraftLoading(false);
    }
  };

  // Generate Meeting Prep
  const handleGeneratePrep = async (e) => {
    e?.preventDefault();
    if (!lead?.id) return;
    setPrepLoading(true);
    setPrepError(null);
    try {
      const payload = {
        meetingType,
        notes: meetingNotes.trim() || undefined
      };
      const res = await crmService.generateAiMeetingPrep(lead.id, payload);
      const data = res?.data?.data?.prep || res?.data?.prep;
      setPrepResult(data);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to generate meeting preparation';
      setPrepError(msg);
    } finally {
      setPrepLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-indigo-200/80 shadow-sm overflow-hidden">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-900/30">
            <Sparkles className="w-6 h-6 text-amber-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-wide">Intelligent Sales Assistant</h2>
              <Badge variant="primary" className="text-[10px] bg-indigo-500/30 text-indigo-200 border-indigo-400/40">
                Grounded AI
              </Badge>
            </div>
            <p className="text-xs text-slate-300">
              Assists with executive briefings, personalized outreach drafts, and meeting discovery prep.
            </p>
          </div>
        </div>

        {/* Safety & Grounding Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Strictly Grounded • Zero Auto-Send Guarantee</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 bg-slate-50/70 px-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'summary'
              ? 'border-indigo-600 text-indigo-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Executive Lead Summary</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('draft')}
          className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'draft'
              ? 'border-indigo-600 text-indigo-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Personalized Follow-Up</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('prep')}
          className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'prep'
              ? 'border-indigo-600 text-indigo-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Call & Meeting Prep</span>
        </button>
      </div>

      {/* Tab 1: Executive Lead Summary */}
      {activeTab === 'summary' && (
        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Executive Account Briefing</h3>
              <p className="text-xs text-slate-500">
                Factual synthesis of {lead.firstName}'s company, activity timeline, and engagement signals.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={summary ? RefreshCw : Sparkles}
              loading={summaryLoading}
              disabled={summaryLoading}
              onClick={handleGenerateSummary}
              className="bg-indigo-600 hover:bg-indigo-700 text-xs shadow-sm"
            >
              {summaryLoading ? 'Analyzing CRM Data...' : summary ? 'Regenerate Summary' : 'Generate AI Summary'}
            </Button>
          </div>

          {summaryError && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block">Notice from AI Service</span>
                <p>{summaryError}</p>
              </div>
            </div>
          )}

          {summaryLoading && (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">
                Synthesizing contact records, recorded engagements, and pipeline opportunities...
              </p>
            </div>
          )}

          {!summary && !summaryLoading && (
            <div className="py-10 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 space-y-2">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">No summary generated yet for this session</p>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                Click "Generate AI Summary" above to build a concise, grounded briefing directly from verified CRM interactions.
              </p>
            </div>
          )}

          {summary && !summaryLoading && (
            <div className="space-y-4">
              {/* Copy all action & timestamp */}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="text-[11px] text-slate-400">
                  Generated {new Date(summary.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      `OVERVIEW:\n${summary.overview}\n\nNOTABLE ENGAGEMENT:\n${summary.notableEngagement}\n\nSALES POSITION:\n${summary.salesPosition}\n\nCONCERNS/GAPS:\n${summary.concernsOrGaps}\n\nSUGGESTED FOCUS:\n${summary.suggestedFocus}`,
                      'summary-all'
                    )
                  }
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  {copiedKey === 'summary-all' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Full Briefing</span>
                    </>
                  )}
                </button>
              </div>

              {/* Overview Box */}
              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 block">
                  Prospect & Account Overview
                </span>
                <p className="text-xs text-slate-800 leading-relaxed font-medium">
                  {summary.overview}
                </p>
              </div>

              {/* 2x2 Grid for Specific Signals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-2xs">
                  <span className="text-xs font-bold text-slate-800 block">Notable Engagement</span>
                  <p className="text-xs text-slate-600 leading-relaxed">{summary.notableEngagement}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-2xs">
                  <span className="text-xs font-bold text-slate-800 block">Commercial Position</span>
                  <p className="text-xs text-slate-600 leading-relaxed">{summary.salesPosition}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-200/70 space-y-1 shadow-2xs">
                  <span className="text-xs font-bold text-amber-900 block">Identified Gaps & Risks</span>
                  <p className="text-xs text-amber-800 leading-relaxed">{summary.concernsOrGaps}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-200/70 space-y-1 shadow-2xs">
                  <span className="text-xs font-bold text-emerald-900 block">Recommended Focus</span>
                  <p className="text-xs text-emerald-800 leading-relaxed">{summary.suggestedFocus}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Personalized Follow-Up Draft */}
      {activeTab === 'draft' && (
        <div className="p-6 space-y-6">
          <form onSubmit={handleGenerateDraft} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Outreach Objective
                </label>
                <select
                  value={draftObjective}
                  onChange={(e) => setDraftObjective(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {options.objectives.map((obj) => (
                    <option key={obj.id} value={obj.id}>{obj.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Communication Tone
                </label>
                <select
                  value={draftTone}
                  onChange={(e) => setDraftTone(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {options.tones.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Additional Context / Rep Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <span className="text-[10px] text-slate-400">{draftContext.length}/500 chars</span>
              </div>
              <textarea
                rows={2}
                maxLength={500}
                placeholder="Mention specific product interest, upcoming industry event, or schedule constraint..."
                value={draftContext}
                onChange={(e) => setDraftContext(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                Channel: Strictly Email. Drafts are never sent automatically.
              </span>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon={Sparkles}
                loading={draftLoading}
                disabled={draftLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-xs shadow-sm"
              >
                {draftLoading ? 'Composing Draft...' : 'Generate Follow-Up Draft'}
              </Button>
            </div>
          </form>

          {draftError && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Unable to generate draft</span>
                <p>{draftError}</p>
              </div>
            </div>
          )}

          {draftResult && (
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Personalized Email Draft</span>
                  <Badge variant="primary" className="text-[10px] bg-slate-100 text-slate-700 border-slate-200">
                    Editable
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={copiedKey === 'draft-all' ? Check : Copy}
                    onClick={() =>
                      copyToClipboard(
                        `Subject: ${draftResult.subject}\n\n${editableBody}`,
                        'draft-all'
                      )
                    }
                    className="text-xs"
                  >
                    {copiedKey === 'draft-all' ? 'Copied Full Email!' : 'Copy Subject & Body'}
                  </Button>
                </div>
              </div>

              {/* Subject Line */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="font-bold text-slate-600 shrink-0">Subject:</span>
                  <span className="font-semibold text-slate-900 truncate">{draftResult.subject}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(draftResult.subject, 'subject')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 shrink-0 font-medium"
                >
                  {copiedKey === 'subject' ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* Editable Body */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-500">
                  Message Body (Review and edit before sending via your email client):
                </label>
                <textarea
                  rows={8}
                  value={editableBody}
                  onChange={(e) => setEditableBody(e.target.value)}
                  className="w-full p-3.5 text-xs font-sans text-slate-800 bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed shadow-inner"
                />
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Ready to send: Copy this draft and send through your corporate email client. Remember to log your outreach activity in the timeline below.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Call & Meeting Preparation */}
      {activeTab === 'prep' && (
        <div className="p-6 space-y-6">
          <form onSubmit={handleGeneratePrep} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Upcoming Meeting Type
                </label>
                <select
                  value={meetingType}
                  onChange={(e) => setMeetingType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {options.meetingTypes.map((mt) => (
                    <option key={mt.id} value={mt.id}>{mt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Specific Discussion Topics / Questions <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={500}
                  placeholder="e.g. Budget confirmation, security review timeline..."
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon={Sparkles}
                loading={prepLoading}
                disabled={prepLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-xs shadow-sm"
              >
                {prepLoading ? 'Preparing Briefing...' : 'Generate Meeting Brief'}
              </Button>
            </div>
          </form>

          {prepError && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Meeting prep unavailable</span>
                <p>{prepError}</p>
              </div>
            </div>
          )}

          {prepResult && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Meeting Preparation Brief
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Tailored discovery guidance for {lead.firstName} {lead.lastName}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  icon={copiedKey === 'prep-all' ? Check : Copy}
                  onClick={() =>
                    copyToClipboard(
                      `MEETING BRIEF: ${lead.firstName} ${lead.lastName}\n\nPROSPECT BRIEF:\n${prepResult.prospectBrief}\n\nKEY INTERESTS:\n${prepResult.keyInterests.join('\n• ')}\n\nDISCOVERY QUESTIONS:\n• ${prepResult.discoveryQuestions.join('\n• ')}\n\nPOTENTIAL CONCERNS:\n• ${prepResult.potentialConcerns.join('\n• ')}\n\nDEAL CONTEXT:\n${prepResult.dealContext}\n\nPRE-CALL CHECKLIST:\n• ${prepResult.checklist.join('\n• ')}`,
                      'prep-all'
                    )
                  }
                  className="text-xs"
                >
                  {copiedKey === 'prep-all' ? 'Copied Brief!' : 'Copy Entire Brief'}
                </Button>
              </div>

              {/* Prospect Brief */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-xs font-bold text-slate-900 block">Prospect Overview</span>
                <p className="text-xs text-slate-700 leading-relaxed">{prepResult.prospectBrief}</p>
              </div>

              {/* 2 Column: Discovery Questions & Pre-Call Checklist */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Questions */}
                <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-100 space-y-2">
                  <span className="text-xs font-bold text-indigo-900 block">
                    High-Value Discovery Questions
                  </span>
                  <ul className="space-y-2 text-xs text-slate-700">
                    {prepResult.discoveryQuestions.map((q, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-indigo-200/80 text-indigo-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-snug">{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Checklist */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2 shadow-2xs">
                  <span className="text-xs font-bold text-slate-900 block">
                    Pre-Call Action Checklist
                  </span>
                  <ul className="space-y-2 text-xs text-slate-600">
                    {prepResult.checklist.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="leading-snug">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Interests & Concerns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                  <span className="text-xs font-bold text-slate-800 block">Key Interests / Triggers</span>
                  <div className="flex flex-wrap gap-1.5">
                    {prepResult.keyInterests.map((interest, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-200/70 space-y-1.5 shadow-2xs">
                  <span className="text-xs font-bold text-amber-900 block">Potential Objections / Concerns</span>
                  <div className="space-y-1">
                    {prepResult.potentialConcerns.map((concern, idx) => (
                      <p key={idx} className="text-xs text-amber-800 leading-snug">
                        • {concern}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AiAssistantPanel;
