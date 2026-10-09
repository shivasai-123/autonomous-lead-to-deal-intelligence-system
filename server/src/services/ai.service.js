import OpenAI from 'openai';
import { env } from '../config/environment.js';
import { getPrismaClient } from '../config/prisma.js';
import {
  AI_CONFIG,
  SUPPORTED_TONES,
  SUPPORTED_OBJECTIVES,
  SUPPORTED_MEETING_TYPES,
  PROMPT_INJECTION_DEFENSE_HEADER
} from '../config/ai.config.js';
import { ScoringService } from './scoring.service.js';
import { AuditService } from './audit.service.js';
import { logger } from '../utils/logger.js';

let mockAiProvider = null;

export class AIService {
  /**
   * Set a mock provider for deterministic offline testing.
   * @param {Function|null} provider - Async function receiving (messages, options) returning JSON string or object
   */
  static setMockProvider(provider) {
    mockAiProvider = provider;
  }

  /**
   * Reset mock provider back to null.
   */
  static resetMockProvider() {
    mockAiProvider = null;
  }

  /**
   * Internal client factory.
   * Throws 503 if OpenAI API key is missing and no mock provider is active.
   */
  static getClient() {
    if (mockAiProvider) {
      return null;
    }

    if (!env.OPENAI_API_KEY || !env.OPENAI_API_KEY.trim()) {
      const error = new Error('AI assistance is currently unavailable: OPENAI_API_KEY is not configured on the server.');
      error.statusCode = 503;
      error.code = 'AI_NOT_CONFIGURED';
      throw error;
    }

    return new OpenAI({
      apiKey: env.OPENAI_API_KEY.trim(),
      timeout: env.OPENAI_TIMEOUT_MS || AI_CONFIG.DEFAULT_TIMEOUT_MS
    });
  }

  /**
   * Execute chat completion with safety guards, token caps, and structured response parsing.
   *
   * @param {Object} params
   * @param {string} params.systemPrompt
   * @param {string} params.userPrompt
   * @param {number} [params.maxTokens]
   * @param {number} [params.temperature]
   * @returns {Promise<Object>} Parsed JSON object
   */
  static async executeCompletion({
    systemPrompt,
    userPrompt,
    maxTokens = 800,
    temperature = AI_CONFIG.DEFAULT_TEMPERATURE
  }) {
    // 1. If mock provider active, dispatch mock call
    if (mockAiProvider) {
      const mockResult = await mockAiProvider({
        systemPrompt,
        userPrompt,
        maxTokens,
        temperature
      });
      if (typeof mockResult === 'string') {
        return JSON.parse(mockResult);
      }
      return mockResult;
    }

    // 2. Live OpenAI client
    const client = this.getClient();

    try {
      const response = await client.chat.completions.create({
        model: env.OPENAI_MODEL || AI_CONFIG.DEFAULT_MODEL,
        messages: [
          { role: 'system', content: `${PROMPT_INJECTION_DEFENSE_HEADER}\n\n${systemPrompt}` },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' }
      });

      const rawContent = response.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new Error('Received empty response from AI provider');
      }

      return JSON.parse(rawContent);
    } catch (err) {
      logger.warn(`AI provider execution error: ${err.message}`);

      if (err.name === 'APIConnectionTimeoutError' || err.message?.includes('timeout')) {
        const error = new Error('AI provider request timed out. Please try again.');
        error.statusCode = 504;
        throw error;
      }

      if (err.status === 429 || err.message?.includes('rate limit')) {
        const error = new Error('AI provider rate limit reached. Please wait a moment before retrying.');
        error.statusCode = 429;
        throw error;
      }

      if (err.status === 401 || err.message?.includes('Incorrect API key')) {
        const error = new Error('AI service configuration error: invalid provider credentials.');
        error.statusCode = 502;
        throw error;
      }

      if (err instanceof SyntaxError) {
        const error = new Error('AI provider returned malformed response.');
        error.statusCode = 502;
        throw error;
      }

      const safeError = new Error(err.message || 'AI service encountered an unexpected error.');
      safeError.statusCode = err.statusCode || 502;
      throw safeError;
    }
  }

  /**
   * Helper to verify authenticated user has RBAC access to target lead.
   *
   * @param {string} leadId - Lead UUID
   * @param {Object} user - Authenticated user session
   * @returns {Promise<Object>} Loaded lead with relations
   */
  static async verifyLeadAccess(leadId, user) {
    const prisma = getPrismaClient();

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        company: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        activities: {
          orderBy: { occurredAt: 'desc' },
          take: AI_CONFIG.LIMITS.MAX_ACTIVITIES_IN_PROMPT
        },
        deals: {
          include: { pipelineStage: true },
          take: 5
        },
        recommendations: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!lead) {
      const error = new Error(`Lead with ID "${leadId}" was not found`);
      error.statusCode = 404;
      throw error;
    }

    if (lead.isArchived) {
      const error = new Error('Cannot generate AI insights for an archived lead');
      error.statusCode = 400;
      throw error;
    }

    // RBAC: Sales Reps can only access their assigned leads or unassigned leads
    if (user.role === 'SALES_REPRESENTATIVE') {
      const isAssignedToUser = lead.assignedToId === user.id;
      const isUnassigned = !lead.assignedToId;

      if (!isAssignedToUser && !isUnassigned) {
        const error = new Error('Access denied: You do not have permission to access AI features for this lead');
        error.statusCode = 403;
        throw error;
      }
    }

    return lead;
  }

  /**
   * Helper to verify authenticated user has RBAC access to target recommendation.
   *
   * @param {string} recommendationId - Recommendation UUID
   * @param {Object} user - Authenticated user session
   * @returns {Promise<Object>} Loaded recommendation with lead relations
   */
  static async verifyRecommendationAccess(recommendationId, user) {
    const prisma = getPrismaClient();

    const recommendation = await prisma.recommendation.findUnique({
      where: { id: recommendationId },
      include: {
        lead: {
          include: {
            company: true,
            assignedTo: {
              select: { id: true, firstName: true, lastName: true, email: true }
            },
            activities: {
              orderBy: { occurredAt: 'desc' },
              take: 5
            },
            deals: {
              include: { pipelineStage: true },
              take: 3
            }
          }
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    if (!recommendation) {
      const error = new Error(`Recommendation with ID "${recommendationId}" was not found`);
      error.statusCode = 404;
      throw error;
    }

    if (recommendation.lead.isArchived) {
      const error = new Error('Cannot explain recommendation for an archived lead');
      error.statusCode = 400;
      throw error;
    }

    // RBAC check
    if (user.role === 'SALES_REPRESENTATIVE') {
      const isAssignedRec = recommendation.assignedToId === user.id;
      const isAssignedLead = recommendation.lead.assignedToId === user.id;
      const isUnassigned = !recommendation.assignedToId && !recommendation.lead.assignedToId;

      if (!isAssignedRec && !isAssignedLead && !isUnassigned) {
        const error = new Error('Access denied: You do not have permission to access this recommendation');
        error.statusCode = 403;
        throw error;
      }
    }

    return recommendation;
  }

  /**
   * FEATURE A: AI Lead Summary
   * Generates grounded, executive briefing of a prospect from actual CRM data.
   *
   * @param {string} leadId - Lead UUID
   * @param {Object} user - Authenticated user
   * @returns {Promise<Object>} { overview, notableEngagement, salesPosition, concernsOrGaps, suggestedFocus }
   */
  static async generateLeadSummary(leadId, user) {
    const lead = await this.verifyLeadAccess(leadId, user);
    const stalledInfo = ScoringService.detectStalledStatus(lead, lead.activities);

    // Build compact factual CRM context
    const crmContext = {
      prospect: {
        name: `${lead.firstName} ${lead.lastName}`,
        jobTitle: lead.jobTitle || 'Unknown / Not provided',
        email: lead.email,
        phone: lead.phone || 'Unknown',
        status: lead.status,
        score: lead.score,
        priority: lead.priority,
        createdAt: lead.createdAt
      },
      company: {
        name: lead.company?.name || 'Unassigned / Independent',
        industry: lead.company?.industry || 'Unknown',
        website: lead.company?.website || 'Unknown'
      },
      engagementStatus: {
        isStalled: stalledInfo.isStalled,
        daysSinceLastActivity: stalledInfo.daysSinceLastActivity,
        lastActivityAt: stalledInfo.lastActivityAt
      },
      recentActivities: lead.activities.map((a) => ({
        type: a.type,
        occurredAt: a.occurredAt,
        description: a.description || 'No description recorded'
      })),
      activeDeals: lead.deals.map((d) => ({
        title: d.title,
        value: Number(d.value),
        currency: d.currency,
        stage: d.pipelineStage?.name || 'Unknown',
        status: d.status
      })),
      pendingRecommendations: lead.recommendations
        .filter((r) => r.status === 'PENDING')
        .map((r) => ({
          type: r.type,
          title: r.title,
          confidence: r.confidence
        }))
    };

    const systemPrompt = `You are a factual B2B sales intelligence assistant.
Analyze the provided CRM facts for this prospect and generate a concise executive summary formatted as a JSON object with EXACTLY these keys:
- "overview": (string) 2-3 sentence overview of prospect and company.
- "notableEngagement": (string) Summary of recorded interactions, digital touchpoints, and demonstrated interest.
- "salesPosition": (string) Current status in sales cycle, score velocity, and active deals.
- "concernsOrGaps": (string) Any missing contact information, inactivity periods, or potential risks.
- "suggestedFocus": (string) 2-3 specific topics or questions the salesperson should explore next.

STRICT GROUNDING RULES:
- State only facts directly supported by the CRM context.
- If information is missing (e.g. no phone, no open deal, or unknown industry), explicitly state that it is unknown.
- Do NOT claim that interactions occurred if they are not listed in recentActivities.`;

    const userPrompt = `CRM Prospect Data:\n${JSON.stringify(crmContext, null, 2)}`;

    const result = await this.executeCompletion({
      systemPrompt,
      userPrompt,
      maxTokens: AI_CONFIG.TOKEN_LIMITS.LEAD_SUMMARY
    });

    // Validate structured response
    const sanitized = {
      overview: String(result.overview || 'Overview unavailable.').trim(),
      notableEngagement: String(result.notableEngagement || 'No notable engagement documented.').trim(),
      salesPosition: String(result.salesPosition || `Lead is currently in ${lead.status} status with score ${lead.score}/100.`).trim(),
      concernsOrGaps: String(result.concernsOrGaps || 'No immediate concerns flagged.').trim(),
      suggestedFocus: String(result.suggestedFocus || 'Review prospect activity timeline.').trim(),
      leadId: lead.id,
      generatedAt: new Date().toISOString()
    };

    await AuditService.log({
      action: 'AI_SUMMARY_GENERATED',
      entityType: 'Lead',
      entityId: lead.id,
      userId: user.id,
      metadata: { leadId: lead.id, model: env.OPENAI_MODEL || AI_CONFIG.DEFAULT_MODEL }
    });

    return sanitized;
  }

  /**
   * FEATURE B: AI Personalized Follow-Up Draft
   * Generates a tailored email draft for sales outreach without sending anything.
   *
   * @param {string} leadId - Lead UUID
   * @param {Object} options - { tone, objective, additionalContext }
   * @param {Object} user - Authenticated user
   * @returns {Promise<Object>} { subject, body, channel, tone, objective }
   */
  static async generateFollowUpDraft(leadId, { tone, objective, additionalContext = '' }, user) {
    const lead = await this.verifyLeadAccess(leadId, user);

    const crmContext = {
      prospectName: `${lead.firstName} ${lead.lastName}`,
      companyName: lead.company?.name || 'their organization',
      industry: lead.company?.industry || null,
      status: lead.status,
      score: lead.score,
      senderName: `${user.firstName} ${user.lastName}`,
      latestActivities: lead.activities.slice(0, 5).map((a) => ({
        type: a.type,
        occurredAt: a.occurredAt,
        description: a.description
      })),
      selectedTone: SUPPORTED_TONES[tone] || tone,
      selectedObjective: SUPPORTED_OBJECTIVES[objective] || objective,
      repNotes: additionalContext ? String(additionalContext).slice(0, AI_CONFIG.LIMITS.MAX_ADDITIONAL_CONTEXT_LENGTH) : null
    };

    const systemPrompt = `You are an expert sales communication assistant.
Write a personalized follow-up email draft based strictly on the provided prospect records.
Return a JSON object with EXACTLY these keys:
- "subject": (string) Compelling, professional email subject line (under 120 chars).
- "body": (string) Complete email body including professional greeting, clear value proposition, concrete next step, and polite closing.

CRITICAL RULES:
- The channel is strictly EMAIL.
- NEVER invent meetings, pricing discussions, or phone conversations that do not appear in latestActivities.
- If prospect requested a demo, reference that. If they downloaded a brochure or visited the site, reference that appropriately.
- Do NOT promise discounts, specific dollar figures, or false deadlines.
- Use the recipient's name "${crmContext.prospectName}" in the greeting.
- Sign off using the sender's name "${crmContext.senderName}".
- Tone must be: ${crmContext.selectedTone}.
- Objective: ${crmContext.selectedObjective}.`;

    const userPrompt = `Prospect Context:\n${JSON.stringify(crmContext, null, 2)}`;

    const result = await this.executeCompletion({
      systemPrompt,
      userPrompt,
      maxTokens: AI_CONFIG.TOKEN_LIMITS.FOLLOW_UP_DRAFT
    });

    const sanitized = {
      subject: String(result.subject || `Following up regarding ${lead.company?.name || 'our platform'}`).trim(),
      body: String(result.body || '').trim(),
      channel: 'EMAIL',
      tone,
      objective,
      leadId: lead.id,
      generatedAt: new Date().toISOString()
    };

    if (!sanitized.body) {
      throw new Error('AI provider failed to generate message body');
    }

    await AuditService.log({
      action: 'AI_DRAFT_GENERATED',
      entityType: 'Lead',
      entityId: lead.id,
      userId: user.id,
      metadata: { leadId: lead.id, tone, objective }
    });

    return sanitized;
  }

  /**
   * FEATURE C: AI Recommendation Explanation
   * Enhances existing deterministic recommendation with natural-language context while preserving underlying rule facts.
   *
   * @param {string} recommendationId - Recommendation UUID
   * @param {Object} user - Authenticated user
   * @returns {Promise<Object>} { recommendationId, type, originalExplanation, aiExplanation, actionRationale, suggestedPreparation }
   */
  static async explainRecommendation(recommendationId, user) {
    const recommendation = await this.verifyRecommendationAccess(recommendationId, user);
    const lead = recommendation.lead;

    const crmContext = {
      recommendation: {
        id: recommendation.id,
        type: recommendation.type,
        title: recommendation.title,
        deterministicExplanation: recommendation.explanation,
        confidence: recommendation.confidence,
        status: recommendation.status,
        metadata: recommendation.metadata || {}
      },
      prospect: {
        name: `${lead.firstName} ${lead.lastName}`,
        company: lead.company?.name || 'Unassigned',
        status: lead.status,
        score: lead.score,
        priority: lead.priority
      },
      recentActivities: lead.activities.map((a) => ({
        type: a.type,
        occurredAt: a.occurredAt
      }))
    };

    const systemPrompt = `You are a sales coaching assistant explaining an algorithmic CRM recommendation to a salesperson.
The CRM recommendation engine is deterministic and grounded in facts. Your job is to make the explanation conversational, clear, and actionable.
Return a JSON object with EXACTLY these keys:
- "aiExplanation": (string) 2-3 sentences explaining why this action is recommended right now.
- "actionRationale": (string) The strategic commercial benefit of taking this action promptly.
- "suggestedPreparation": (string) 1-2 bullet points on what the salesperson should review before taking action.

CRITICAL RULES:
- Do NOT alter or contradict the recommendation type or the stored deterministic explanation.
- Ground your rationale only in the provided CRM facts. Do not invent unrecorded interactions.`;

    const userPrompt = `Recommendation and Prospect Context:\n${JSON.stringify(crmContext, null, 2)}`;

    const result = await this.executeCompletion({
      systemPrompt,
      userPrompt,
      maxTokens: AI_CONFIG.TOKEN_LIMITS.RECOMMENDATION_EXPLANATION
    });

    const sanitized = {
      recommendationId: recommendation.id,
      type: recommendation.type,
      originalExplanation: recommendation.explanation,
      aiExplanation: String(result.aiExplanation || recommendation.explanation).trim(),
      actionRationale: String(result.actionRationale || 'Advance sales relationship based on recent engagement.').trim(),
      suggestedPreparation: String(result.suggestedPreparation || 'Review lead activity timeline and contact details.').trim(),
      generatedAt: new Date().toISOString()
    };

    await AuditService.log({
      action: 'AI_EXPLANATION_GENERATED',
      entityType: 'Recommendation',
      entityId: recommendation.id,
      userId: user.id,
      metadata: { recommendationId: recommendation.id, type: recommendation.type }
    });

    return sanitized;
  }

  /**
   * FEATURE D: AI Sales Call & Meeting Preparation
   * Generates tailored briefing, discovery questions, and checklist for an upcoming conversation.
   *
   * @param {string} leadId - Lead UUID
   * @param {Object} options - { meetingType, notes }
   * @param {Object} user - Authenticated user
   * @returns {Promise<Object>} { prospectBrief, keyInterests, discoveryQuestions, potentialConcerns, dealContext, checklist }
   */
  static async generateMeetingPrep(leadId, { meetingType = 'INITIAL_DISCOVERY', notes = '' } = {}, user) {
    const lead = await this.verifyLeadAccess(leadId, user);

    const crmContext = {
      prospect: {
        name: `${lead.firstName} ${lead.lastName}`,
        jobTitle: lead.jobTitle || 'Unknown',
        company: lead.company?.name || 'Unassigned',
        industry: lead.company?.industry || 'Unknown',
        status: lead.status,
        score: lead.score,
        priority: lead.priority
      },
      meetingType: SUPPORTED_MEETING_TYPES[meetingType] || meetingType,
      repNotes: notes ? String(notes).slice(0, AI_CONFIG.LIMITS.MAX_NOTES_LENGTH) : null,
      recentActivities: lead.activities.map((a) => ({
        type: a.type,
        occurredAt: a.occurredAt,
        description: a.description
      })),
      deals: lead.deals.map((d) => ({
        title: d.title,
        value: Number(d.value),
        stage: d.pipelineStage?.name
      }))
    };

    const systemPrompt = `You are a senior sales enablement coach.
Prepare an executive meeting preparation brief for a salesperson based on the provided prospect records.
Return a JSON object with EXACTLY these keys:
- "prospectBrief": (string) 2-sentence summary of the prospect's background, company, and current situation.
- "keyInterests": (array of strings) 2-3 verified interest areas inferred from activity history (e.g. pricing, demo, specific features).
- "discoveryQuestions": (array of strings) 3-4 high-value open-ended questions tailored to this prospect's stage.
- "potentialConcerns": (array of strings) 2 potential risks, missing facts, or objections to clarify.
- "dealContext": (string) Overview of open pipeline deals or commercial opportunity state.
- "checklist": (array of strings) 3-4 actionable preparation steps before starting the call.

CRITICAL RULES:
- Base questions and interests strictly on the verified CRM data.
- Clearly differentiate recorded facts from suggested discovery questions.
- If deal or industry information is missing, state that clearly in dealContext or prospectBrief.`;

    const userPrompt = `Meeting Preparation Context:\n${JSON.stringify(crmContext, null, 2)}`;

    const result = await this.executeCompletion({
      systemPrompt,
      userPrompt,
      maxTokens: AI_CONFIG.TOKEN_LIMITS.MEETING_PREP
    });

    const sanitized = {
      prospectBrief: String(result.prospectBrief || `${lead.firstName} ${lead.lastName} at ${lead.company?.name || 'prospect company'}.`).trim(),
      keyInterests: Array.isArray(result.keyInterests) ? result.keyInterests.map(String) : [],
      discoveryQuestions: Array.isArray(result.discoveryQuestions) ? result.discoveryQuestions.map(String) : [],
      potentialConcerns: Array.isArray(result.potentialConcerns) ? result.potentialConcerns.map(String) : [],
      dealContext: String(result.dealContext || (lead.deals.length > 0 ? `${lead.deals.length} active deals in pipeline` : 'No active deal opened yet.')).trim(),
      checklist: Array.isArray(result.checklist) ? result.checklist.map(String) : [],
      meetingType,
      leadId: lead.id,
      generatedAt: new Date().toISOString()
    };

    await AuditService.log({
      action: 'AI_PREP_GENERATED',
      entityType: 'Lead',
      entityId: lead.id,
      userId: user.id,
      metadata: { leadId: lead.id, meetingType }
    });

    return sanitized;
  }
}

export default AIService;
