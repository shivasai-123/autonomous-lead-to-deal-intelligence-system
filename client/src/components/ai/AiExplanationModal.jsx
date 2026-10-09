import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { crmService } from '../../services/crm';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';

export function AiExplanationModal({ isOpen, onClose, recommendation }) {
  const [loading, setLoading] = useState(false);
  const [explanationData, setExplanationData] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && recommendation?.id) {
      loadExplanation();
    } else {
      setExplanationData(null);
      setError(null);
    }
  }, [isOpen, recommendation?.id]);

  const loadExplanation = async () => {
    if (!recommendation?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await crmService.explainAiRecommendation(recommendation.id);
      const data = res?.data?.data?.explanation || res?.data?.explanation;
      setExplanationData(data);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to explain recommendation';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!explanationData) return;
    const text = `RECOMMENDATION: ${recommendation.title}\nTYPE: ${recommendation.type}\n\nORIGINAL DETERMINISTIC REASON:\n${recommendation.explanation}\n\nAI CONVERSATIONAL EXPLANATION:\n${explanationData.aiExplanation}\n\nCOMMERCIAL RATIONALE:\n${explanationData.actionRationale}\n\nSUGGESTED PREPARATION:\n${explanationData.suggestedPreparation}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || !recommendation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/80 border border-purple-400/40 flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">AI Recommendation Explanation</h3>
                <Badge variant="primary" className="text-[10px] bg-purple-500/20 text-purple-200 border-purple-400/30">
                  Sales Enablement
                </Badge>
              </div>
              <p className="text-xs text-slate-300">
                Natural-language coaching grounded in deterministic CRM rules.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Target Action Banner */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <span className="font-bold text-slate-900 block truncate">{recommendation.title}</span>
              <span className="text-slate-500 text-[11px]">Type: {recommendation.type.replace(/_/g, ' ')}</span>
            </div>
            {recommendation.confidence && (
              <Badge variant="primary" className="text-[11px] bg-purple-100 text-purple-800 border-purple-200 shrink-0">
                {Math.round(recommendation.confidence * 100)}% Confidence
              </Badge>
            )}
          </div>

          {/* Preserved Deterministic Rule Ground Truth */}
          <div className="p-3.5 bg-purple-50/50 rounded-xl border border-purple-100 text-xs space-y-1">
            <span className="font-bold text-purple-900 block flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              Deterministic Rule Evidence (Source of Truth)
            </span>
            <p className="text-slate-700 leading-relaxed">
              {recommendation.explanation}
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="py-10 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-purple-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">
                Generating conversational explanation and sales rationale...
              </p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>AI Explanation Notice</span>
              </div>
              <p>{error}</p>
              <div className="pt-1">
                <Button variant="outline" size="sm" onClick={loadExplanation} className="text-xs">
                  Retry Explanation
                </Button>
              </div>
            </div>
          )}

          {/* Structured AI Explanation Content */}
          {explanationData && !loading && (
            <div className="space-y-4">
              {/* Conversational Explanation */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-xs font-bold text-slate-900 block">
                  Why This Action Matters Now
                </span>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {explanationData.aiExplanation}
                </p>
              </div>

              {/* Commercial Rationale */}
              <div className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-200/70 space-y-1">
                <span className="text-xs font-bold text-emerald-900 block">
                  Strategic Commercial Rationale
                </span>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  {explanationData.actionRationale}
                </p>
              </div>

              {/* Suggested Prep */}
              <div className="p-3.5 rounded-xl bg-indigo-50/40 border border-indigo-200/70 space-y-1">
                <span className="text-xs font-bold text-indigo-900 block">
                  Suggested Rep Preparation
                </span>
                <p className="text-xs text-indigo-800 leading-relaxed">
                  {explanationData.suggestedPreparation}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Assists decision-making • Never alters status
          </span>

          <div className="flex items-center gap-2">
            {explanationData && (
              <Button
                variant="outline"
                size="sm"
                icon={copied ? Check : Copy}
                onClick={handleCopy}
                className="text-xs"
              >
                {copied ? 'Copied!' : 'Copy Explanation'}
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AiExplanationModal;
