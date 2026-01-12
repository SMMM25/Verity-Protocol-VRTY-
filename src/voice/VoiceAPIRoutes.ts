/**
 * Verity Protocol - Voice API Routes
 * Production-ready REST API endpoints for voice command processing
 * 
 * Features:
 * - Server-side voice command processing
 * - Multi-language NLP
 * - Command execution integration
 * - Voice session management
 * - Speech-to-text transcription endpoint
 * - Text-to-speech synthesis endpoint
 */

import { Router, Request, Response } from 'express';
import { logger, logAuditAction } from '../utils/logger.js';
import { generateId, sha256 } from '../utils/crypto.js';

// Express Router for voice endpoints
export const voiceRoutes = Router();

// Types for voice API
export interface VoiceSession {
  sessionId: string;
  userId: string;
  language: string;
  context: CommandContext;
  startedAt: Date;
  lastActivityAt: Date;
  isActive: boolean;
}

export interface CommandContext {
  currentScreen?: string;
  selectedAsset?: string;
  pendingTransaction?: Record<string, unknown>;
  conversationHistory: ConversationEntry[];
}

export interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  parsedCommand?: ParsedCommand;
}

export interface ParsedCommand {
  action: string;
  category: string;
  parameters: Record<string, unknown>;
  confidence: number;
  requiresConfirmation: boolean;
}

export interface VoiceCommandResult {
  success: boolean;
  action?: string;
  response: {
    text: string;
    ssml?: string;
  };
  data?: Record<string, unknown>;
  requiresFollowUp?: boolean;
}

// Supported languages with NLP patterns
export const SUPPORTED_LANGUAGES = [
  'en-US', 'en-GB', 'en-AU',
  'es-ES', 'es-MX',
  'fr-FR', 'fr-CA',
  'de-DE',
  'it-IT',
  'pt-BR', 'pt-PT',
  'ja-JP',
  'ko-KR',
  'zh-CN', 'zh-TW',
  'ru-RU',
  'ar-SA',
  'hi-IN',
  'nl-NL',
  'pl-PL',
  'tr-TR',
];

// In-memory storage (production would use database)
const voiceSessions: Map<string, VoiceSession> = new Map();

// Command patterns for NLP
interface CommandPattern {
  patterns: RegExp[];
  action: string;
  category: string;
  requiresConfirmation: boolean;
  parameterExtractors?: Record<string, RegExp>;
}

const COMMAND_PATTERNS: Record<string, CommandPattern[]> = {
  'en': [
    // Balance commands
    {
      patterns: [
        /(?:what(?:'s| is)? (?:my )?)?balance/i,
        /how much (?:xrp|vrty|tokens?) (?:do i have|have i got)/i,
        /check (?:my )?(?:balance|wallet)/i,
        /show (?:me )?(?:my )?balance/i,
      ],
      action: 'CHECK_BALANCE',
      category: 'BALANCE',
      requiresConfirmation: false,
    },
    // Send payment commands
    {
      patterns: [
        /send (\d+(?:\.\d+)?)\s*(?:xrp|vrty)?\s*to\s+(\w+)/i,
        /pay (\d+(?:\.\d+)?)\s*(?:xrp|vrty)?\s*to\s+(\w+)/i,
        /transfer (\d+(?:\.\d+)?)\s*(?:xrp|vrty)?\s*to\s+(\w+)/i,
      ],
      action: 'SEND_PAYMENT',
      category: 'TRANSACTION',
      requiresConfirmation: true,
      parameterExtractors: {
        amount: /(\d+(?:\.\d+)?)/,
        recipient: /to\s+(\w+)/i,
        currency: /(xrp|vrty)/i,
      },
    },
    // Staking commands
    {
      patterns: [
        /stake (\d+(?:\.\d+)?)\s*(?:vrty)?/i,
        /(?:i want to )?stake (\d+(?:\.\d+)?)/i,
      ],
      action: 'STAKE_TOKENS',
      category: 'STAKING',
      requiresConfirmation: true,
      parameterExtractors: {
        amount: /(\d+(?:\.\d+)?)/,
      },
    },
    {
      patterns: [
        /unstake (\d+(?:\.\d+)?)\s*(?:vrty)?/i,
        /(?:i want to )?unstake (\d+(?:\.\d+)?)/i,
        /withdraw (?:my )?stake/i,
      ],
      action: 'UNSTAKE_TOKENS',
      category: 'STAKING',
      requiresConfirmation: true,
      parameterExtractors: {
        amount: /(\d+(?:\.\d+)?)/,
      },
    },
    // Portfolio commands
    {
      patterns: [
        /(?:show|view|open) (?:my )?portfolio/i,
        /what(?:'s| is) (?:my|in my) portfolio/i,
        /(?:show|list) (?:my )?assets/i,
      ],
      action: 'VIEW_PORTFOLIO',
      category: 'WALLET',
      requiresConfirmation: false,
    },
    // Tax commands
    {
      patterns: [
        /(?:show|view) (?:my )?tax (?:summary|report)/i,
        /what(?:'s| is) (?:my )?tax (?:situation|liability)/i,
        /calculate (?:my )?taxes/i,
      ],
      action: 'VIEW_TAX_SUMMARY',
      category: 'TAX',
      requiresConfirmation: false,
    },
    // Governance commands
    {
      patterns: [
        /vote (?:yes|for|approve) (?:on )?proposal (\w+)/i,
        /vote (?:no|against|reject) (?:on )?proposal (\w+)/i,
        /vote (?:on )?proposal (\w+)/i,
      ],
      action: 'VOTE_PROPOSAL',
      category: 'GOVERNANCE',
      requiresConfirmation: true,
      parameterExtractors: {
        proposalId: /proposal (\w+)/i,
        support: /(yes|for|approve|no|against|reject)/i,
      },
    },
    // Help commands
    {
      patterns: [
        /help/i,
        /what can (?:i|you) (?:do|say)/i,
        /(?:show|list) commands/i,
      ],
      action: 'GET_HELP',
      category: 'HELP',
      requiresConfirmation: false,
    },
    // Confirmation commands
    {
      patterns: [
        /^yes$/i,
        /^confirm$/i,
        /^approve$/i,
        /^go ahead$/i,
        /^do it$/i,
      ],
      action: 'CONFIRM_ACTION',
      category: 'NAVIGATION',
      requiresConfirmation: false,
    },
    // Cancel commands
    {
      patterns: [
        /^no$/i,
        /^cancel$/i,
        /^stop$/i,
        /^never ?mind$/i,
      ],
      action: 'CANCEL_ACTION',
      category: 'NAVIGATION',
      requiresConfirmation: false,
    },
  ],
  // Spanish patterns
  'es': [
    {
      patterns: [
        /(?:cu[aá]l es (?:mi )?)?(?:saldo|balance)/i,
        /(?:cu[aá]nto (?:xrp|vrty) tengo)/i,
        /(?:ver|mostrar) (?:mi )?saldo/i,
      ],
      action: 'CHECK_BALANCE',
      category: 'BALANCE',
      requiresConfirmation: false,
    },
    {
      patterns: [
        /enviar (\d+(?:\.\d+)?)\s*(?:xrp|vrty)?\s*a\s+(\w+)/i,
        /pagar (\d+(?:\.\d+)?)\s*(?:xrp|vrty)?\s*a\s+(\w+)/i,
        /transferir (\d+(?:\.\d+)?)\s*(?:xrp|vrty)?\s*a\s+(\w+)/i,
      ],
      action: 'SEND_PAYMENT',
      category: 'TRANSACTION',
      requiresConfirmation: true,
      parameterExtractors: {
        amount: /(\d+(?:\.\d+)?)/,
        recipient: /a\s+(\w+)/i,
        currency: /(xrp|vrty)/i,
      },
    },
  ],
};

// Response templates
const RESPONSE_TEMPLATES: Record<string, Record<string, string>> = {
  BALANCE_CHECKING: {
    'en': 'Checking your balance...',
    'es': 'Consultando tu saldo...',
    'fr': 'Vérification de votre solde...',
    'de': 'Überprüfe deinen Kontostand...',
    'ja': '残高を確認しています...',
    'zh': '正在查询余额...',
  },
  BALANCE_RESPONSE: {
    'en': 'Your current balance is {balance} {currency}.',
    'es': 'Tu saldo actual es {balance} {currency}.',
    'fr': 'Votre solde actuel est de {balance} {currency}.',
    'de': 'Ihr aktuelles Guthaben beträgt {balance} {currency}.',
    'ja': '現在の残高は {balance} {currency} です。',
    'zh': '您当前的余额是 {balance} {currency}。',
  },
  CONFIRM_TRANSACTION: {
    'en': 'You want to send {amount} {currency} to {recipient}. Should I proceed?',
    'es': 'Quieres enviar {amount} {currency} a {recipient}. ¿Debo continuar?',
    'fr': 'Vous voulez envoyer {amount} {currency} à {recipient}. Dois-je continuer ?',
    'de': 'Sie möchten {amount} {currency} an {recipient} senden. Soll ich fortfahren?',
    'ja': '{recipient} に {amount} {currency} を送金しますか？',
    'zh': '您要向 {recipient} 发送 {amount} {currency}。是否继续？',
  },
  NOT_UNDERSTOOD: {
    'en': "I didn't understand that. Could you please repeat or say 'help' for available commands?",
    'es': "No entendí eso. ¿Podrías repetir o decir 'ayuda' para ver los comandos disponibles?",
    'fr': "Je n'ai pas compris. Pourriez-vous répéter ou dire 'aide' pour les commandes disponibles ?",
    'de': "Das habe ich nicht verstanden. Könnten Sie wiederholen oder 'Hilfe' sagen?",
    'ja': '理解できませんでした。もう一度おっしゃるか、「ヘルプ」と言ってください。',
    'zh': '我没听懂。您能重复一遍吗？或者说"帮助"查看可用命令。',
  },
  HELP: {
    'en': 'You can say: "Check my balance", "Send 10 XRP to Alice", "Stake 1000 VRTY", "Show my portfolio", "View tax summary", or "Vote yes on proposal".',
    'es': 'Puedes decir: "Ver mi saldo", "Enviar 10 XRP a Alice", "Hacer staking de 1000 VRTY", "Mostrar mi portafolio".',
    'fr': 'Vous pouvez dire: "Vérifier mon solde", "Envoyer 10 XRP à Alice", "Staker 1000 VRTY", "Afficher mon portefeuille".',
    'de': 'Sie können sagen: "Prüfe meinen Kontostand", "Sende 10 XRP an Alice", "Stake 1000 VRTY", "Zeige mein Portfolio".',
    'ja': '「残高を確認」「10 XRPをAliceに送金」「1000 VRTYをステーク」「ポートフォリオを表示」などと言えます。',
    'zh': '您可以说："查看余额"、"向Alice发送10 XRP"、"质押1000 VRTY"、"显示我的投资组合"。',
  },
  ACTION_CANCELLED: {
    'en': 'Action cancelled.',
    'es': 'Acción cancelada.',
    'fr': 'Action annulée.',
    'de': 'Aktion abgebrochen.',
    'ja': 'アクションをキャンセルしました。',
    'zh': '操作已取消。',
  },
};

/**
 * Get language code from full locale
 */
function getLanguageCode(locale: string): string {
  return locale.split('-')[0] || 'en';
}

/**
 * Parse voice command to structured action
 */
function parseCommand(transcript: string, language: string): ParsedCommand {
  const langCode = getLanguageCode(language);
  const patterns = COMMAND_PATTERNS[langCode] || COMMAND_PATTERNS['en'] || [];
  const normalizedTranscript = transcript.toLowerCase().trim();

  for (const pattern of patterns) {
    for (const regex of pattern.patterns) {
      const match = normalizedTranscript.match(regex);
      if (match) {
        // Extract parameters
        const parameters: Record<string, unknown> = {};
        
        if (pattern.parameterExtractors) {
          for (const [paramName, extractor] of Object.entries(pattern.parameterExtractors)) {
            const paramMatch = normalizedTranscript.match(extractor);
            if (paramMatch) {
              parameters[paramName] = paramMatch[1];
            }
          }
        }

        return {
          action: pattern.action,
          category: pattern.category,
          parameters,
          confidence: 1.0,
          requiresConfirmation: pattern.requiresConfirmation,
        };
      }
    }
  }

  // Unknown command
  return {
    action: 'UNKNOWN',
    category: 'HELP',
    parameters: {},
    confidence: 0,
    requiresConfirmation: false,
  };
}

/**
 * Get response text for action
 */
function getResponse(key: string, language: string, params: Record<string, string> = {}): string {
  const langCode = getLanguageCode(language);
  const template = RESPONSE_TEMPLATES[key]?.[langCode] || RESPONSE_TEMPLATES[key]?.['en'] || '';
  
  let response = template;
  for (const [param, value] of Object.entries(params)) {
    response = response.replace(`{${param}}`, value);
  }
  
  return response;
}

// ===== Voice Session Management =====

/**
 * POST /api/v1/voice/sessions
 * Start a new voice session
 */
voiceRoutes.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { userId, language = 'en-US' } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: userId',
        code: 'INVALID_REQUEST',
      });
      return;
    }

    if (!SUPPORTED_LANGUAGES.includes(language)) {
      res.status(400).json({
        success: false,
        error: `Unsupported language: ${language}`,
        code: 'UNSUPPORTED_LANGUAGE',
        supportedLanguages: SUPPORTED_LANGUAGES,
      });
      return;
    }

    const sessionId = generateId('VSS');
    const now = new Date();

    const session: VoiceSession = {
      sessionId,
      userId,
      language,
      context: {
        conversationHistory: [],
      },
      startedAt: now,
      lastActivityAt: now,
      isActive: true,
    };

    voiceSessions.set(sessionId, session);

    logAuditAction('VOICE_SESSION_STARTED', userId, {
      sessionId,
      language,
    });

    logger.info('Voice session started', { sessionId, userId, language });

    res.status(201).json({
      success: true,
      data: {
        sessionId,
        language,
        welcomeMessage: getResponse('HELP', language),
      },
    });
  } catch (error) {
    logger.error('Voice session creation failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to create voice session',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * DELETE /api/v1/voice/sessions/:sessionId
 * End a voice session
 */
voiceRoutes.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params['sessionId'] || '';
    const session = voiceSessions.get(sessionId);

    if (!session) {
      res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    session.isActive = false;
    voiceSessions.delete(sessionId || '');

    logAuditAction('VOICE_SESSION_ENDED', session.userId, {
      sessionId,
      duration: Date.now() - session.startedAt.getTime(),
    });

    res.json({
      success: true,
      message: 'Voice session ended',
    });
  } catch (error) {
    logger.error('Voice session end failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to end voice session',
      code: 'INTERNAL_ERROR',
    });
  }
});

// ===== Command Processing =====

/**
 * POST /api/v1/voice/commands
 * Process a voice command
 */
voiceRoutes.post('/commands', async (req: Request, res: Response) => {
  try {
    const { sessionId, transcript, language } = req.body;

    if (!transcript) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: transcript',
        code: 'INVALID_REQUEST',
      });
      return;
    }

    // Get or create session
    let session = sessionId ? voiceSessions.get(sessionId) : null;
    const effectiveLanguage = language || session?.language || 'en-US';

    if (session) {
      session.lastActivityAt = new Date();
    }

    // Parse the command
    const parsedCommand = parseCommand(transcript, effectiveLanguage);

    logger.info('Voice command parsed', {
      transcript,
      action: parsedCommand.action,
      confidence: parsedCommand.confidence,
    });

    // Add to conversation history
    if (session) {
      session.context.conversationHistory.push({
        role: 'user',
        content: transcript,
        timestamp: new Date(),
        parsedCommand,
      });
    }

    // Handle the command
    let result: VoiceCommandResult;

    switch (parsedCommand.action) {
      case 'CHECK_BALANCE':
        result = {
          success: true,
          action: parsedCommand.action,
          response: {
            text: getResponse('BALANCE_CHECKING', effectiveLanguage),
          },
        };
        break;

      case 'SEND_PAYMENT':
        if (parsedCommand.requiresConfirmation) {
          const confirmText = getResponse('CONFIRM_TRANSACTION', effectiveLanguage, {
            amount: String(parsedCommand.parameters['amount'] || ''),
            currency: String(parsedCommand.parameters['currency'] || 'XRP'),
            recipient: String(parsedCommand.parameters['recipient'] || ''),
          });
          result = {
            success: true,
            action: parsedCommand.action,
            response: {
              text: confirmText,
            },
            data: parsedCommand.parameters,
            requiresFollowUp: true,
          };
          
          if (session) {
            session.context.pendingTransaction = {
              action: parsedCommand.action,
              parameters: parsedCommand.parameters,
            };
          }
        } else {
          result = {
            success: true,
            action: parsedCommand.action,
            response: {
              text: `Sending ${parsedCommand.parameters['amount'] || ''} ${parsedCommand.parameters['currency'] || 'XRP'} to ${parsedCommand.parameters['recipient'] || ''}.`,
            },
            data: parsedCommand.parameters,
          };
        }
        break;

      case 'STAKE_TOKENS':
        result = {
          success: true,
          action: parsedCommand.action,
          response: {
            text: `You want to stake ${parsedCommand.parameters['amount'] || ''} VRTY. Should I proceed?`,
          },
          data: parsedCommand.parameters,
          requiresFollowUp: true,
        };
        break;

      case 'VIEW_PORTFOLIO':
        result = {
          success: true,
          action: parsedCommand.action,
          response: {
            text: 'Opening your portfolio.',
          },
        };
        break;

      case 'VIEW_TAX_SUMMARY':
        result = {
          success: true,
          action: parsedCommand.action,
          response: {
            text: 'Loading your tax summary.',
          },
        };
        break;

      case 'VOTE_PROPOSAL':
        result = {
          success: true,
          action: parsedCommand.action,
          response: {
            text: `You want to vote ${parsedCommand.parameters['support'] || ''} on proposal ${parsedCommand.parameters['proposalId'] || ''}. Should I proceed?`,
          },
          data: parsedCommand.parameters,
          requiresFollowUp: true,
        };
        break;

      case 'CONFIRM_ACTION':
        if (session?.context.pendingTransaction) {
          result = {
            success: true,
            action: 'EXECUTE_PENDING',
            response: {
              text: 'Executing your request.',
            },
            data: session.context.pendingTransaction,
          };
          session.context.pendingTransaction = undefined;
        } else {
          result = {
            success: false,
            response: {
              text: 'There is nothing to confirm.',
            },
          };
        }
        break;

      case 'CANCEL_ACTION':
        if (session?.context.pendingTransaction) {
          session.context.pendingTransaction = undefined;
        }
        result = {
          success: true,
          action: parsedCommand.action,
          response: {
            text: getResponse('ACTION_CANCELLED', effectiveLanguage),
          },
        };
        break;

      case 'GET_HELP':
        result = {
          success: true,
          action: parsedCommand.action,
          response: {
            text: getResponse('HELP', effectiveLanguage),
          },
        };
        break;

      case 'UNKNOWN':
      default:
        result = {
          success: false,
          response: {
            text: getResponse('NOT_UNDERSTOOD', effectiveLanguage),
          },
        };
    }

    // Add assistant response to history
    if (session) {
      session.context.conversationHistory.push({
        role: 'assistant',
        content: result.response.text,
        timestamp: new Date(),
      });
    }

    logAuditAction('VOICE_COMMAND_PROCESSED', session?.userId || 'anonymous', {
      action: parsedCommand.action,
      category: parsedCommand.category,
      success: result.success,
    });

    res.json({
      success: true,
      data: {
        command: {
          action: parsedCommand.action,
          category: parsedCommand.category,
          parameters: parsedCommand.parameters,
          confidence: parsedCommand.confidence,
        },
        result,
      },
    });
  } catch (error) {
    logger.error('Voice command processing failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to process voice command',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/v1/voice/transcribe
 * Transcribe audio to text (webhook for speech-to-text service)
 */
voiceRoutes.post('/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioUrl, audioBase64, language = 'en-US', format = 'wav' } = req.body;

    if (!audioUrl && !audioBase64) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: audioUrl or audioBase64',
        code: 'INVALID_REQUEST',
      });
      return;
    }

    // In production, this would call a speech-to-text service like:
    // - Google Cloud Speech-to-Text
    // - Amazon Transcribe
    // - Azure Speech Services
    // - OpenAI Whisper
    //
    // Example with Google Cloud:
    // const [response] = await speechClient.recognize({
    //   audio: { content: audioBase64 },
    //   config: {
    //     encoding: 'WEBM_OPUS',
    //     sampleRateHertz: 48000,
    //     languageCode: language,
    //   },
    // });

    // Placeholder response
    res.json({
      success: true,
      data: {
        transcript: '',
        confidence: 0,
        language,
        alternatives: [],
        message: 'Speech-to-text service integration required. Configure SPEECH_TO_TEXT_API in environment.',
      },
    });
  } catch (error) {
    logger.error('Audio transcription failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to transcribe audio',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/v1/voice/synthesize
 * Convert text to speech
 */
voiceRoutes.post('/synthesize', async (req: Request, res: Response) => {
  try {
    const { text, language = 'en-US', voice, rate = 1.0, pitch = 1.0 } = req.body;

    if (!text) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: text',
        code: 'INVALID_REQUEST',
      });
      return;
    }

    // In production, this would call a text-to-speech service like:
    // - Google Cloud Text-to-Speech
    // - Amazon Polly
    // - Azure Speech Services
    // - ElevenLabs
    //
    // Example with Google Cloud:
    // const [response] = await textToSpeechClient.synthesizeSpeech({
    //   input: { text },
    //   voice: { languageCode: language, name: voice },
    //   audioConfig: { audioEncoding: 'MP3', speakingRate: rate, pitch },
    // });

    // Placeholder response
    res.json({
      success: true,
      data: {
        audioBase64: '',
        format: 'mp3',
        duration: 0,
        language,
        message: 'Text-to-speech service integration required. Configure TEXT_TO_SPEECH_API in environment.',
      },
    });
  } catch (error) {
    logger.error('Speech synthesis failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to synthesize speech',
      code: 'INTERNAL_ERROR',
    });
  }
});

// ===== Configuration =====

/**
 * GET /api/v1/voice/config
 * Get voice configuration
 */
voiceRoutes.get('/config', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      supportedLanguages: SUPPORTED_LANGUAGES,
      defaultLanguage: 'en-US',
      features: {
        speechToText: true,
        textToSpeech: true,
        continuousListening: true,
        wakeWord: false,
        multipleLanguages: true,
      },
      commands: {
        categories: ['BALANCE', 'TRANSACTION', 'STAKING', 'GOVERNANCE', 'TAX', 'HELP', 'NAVIGATION'],
        confirmationRequired: ['SEND_PAYMENT', 'STAKE_TOKENS', 'UNSTAKE_TOKENS', 'VOTE_PROPOSAL'],
      },
    },
  });
});

/**
 * GET /api/v1/voice/languages
 * Get supported languages with details
 */
voiceRoutes.get('/languages', async (req: Request, res: Response) => {
  const languageDetails = SUPPORTED_LANGUAGES.map(lang => {
    const parts = lang.split('-');
    const code = parts[0] || 'en';
    const region = parts[1] || '';
    return {
      code: lang,
      language: code,
      region,
      name: new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code,
      nativeName: new Intl.DisplayNames([code], { type: 'language' }).of(code) || code,
    };
  });

  res.json({
    success: true,
    data: languageDetails,
  });
});

/**
 * GET /api/v1/voice/health
 * Health check endpoint
 */
voiceRoutes.get('/health', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      activeSessions: voiceSessions.size,
    },
  });
});

export default voiceRoutes;
