/**
 * Verity Protocol - Voice Commands Integration
 * Production-ready voice interface for hands-free operation
 * 
 * Features:
 * - Speech recognition using Web Speech API / native APIs
 * - Natural language processing for command interpretation
 * - Multi-language support
 * - Voice synthesis for responses
 * - Context-aware command handling
 * - Accessibility compliance (WCAG 2.1)
 */

import { EventEmitter } from 'eventemitter3';
import { logger, logAuditAction } from '../utils/logger.js';
import { generateId } from '../utils/crypto.js';

// SpeechSynthesisVoice interface
interface SpeechSynthesisVoiceInfo {
  default: boolean;
  lang: string;
  localService: boolean;
  name: string;
  voiceURI: string;
}

// Supported languages
export type SupportedLanguage = 
  | 'en-US' | 'en-GB' | 'en-AU'
  | 'es-ES' | 'es-MX'
  | 'fr-FR' | 'fr-CA'
  | 'de-DE'
  | 'it-IT'
  | 'pt-BR' | 'pt-PT'
  | 'ja-JP'
  | 'ko-KR'
  | 'zh-CN' | 'zh-TW'
  | 'ru-RU'
  | 'ar-SA'
  | 'hi-IN'
  | 'nl-NL'
  | 'pl-PL'
  | 'tr-TR';

// Voice command categories
export type CommandCategory = 
  | 'WALLET'
  | 'TRANSACTION'
  | 'BALANCE'
  | 'STAKING'
  | 'GOVERNANCE'
  | 'SIGNALS'
  | 'GUILD'
  | 'TAX'
  | 'SETTINGS'
  | 'HELP'
  | 'NAVIGATION';

// Voice command action types
export type VoiceAction =
  | 'CHECK_BALANCE'
  | 'SEND_PAYMENT'
  | 'SEND_SIGNAL'
  | 'STAKE_TOKENS'
  | 'UNSTAKE_TOKENS'
  | 'VOTE_PROPOSAL'
  | 'CREATE_PROPOSAL'
  | 'VIEW_PORTFOLIO'
  | 'VIEW_TAX_SUMMARY'
  | 'NAVIGATE'
  | 'GET_HELP'
  | 'CONFIRM_ACTION'
  | 'CANCEL_ACTION'
  | 'REPEAT'
  | 'UNKNOWN';

/**
 * Voice recognition result
 */
export interface VoiceRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  alternatives: Array<{
    transcript: string;
    confidence: number;
  }>;
  language: SupportedLanguage;
  timestamp: Date;
}

/**
 * Parsed voice command
 */
export interface ParsedCommand {
  id: string;
  action: VoiceAction;
  category: CommandCategory;
  parameters: Record<string, unknown>;
  rawTranscript: string;
  confidence: number;
  requiresConfirmation: boolean;
  contextRequired?: string[];
  timestamp: Date;
}

/**
 * Voice response to speak
 */
export interface VoiceResponse {
  text: string;
  ssml?: string; // Speech Synthesis Markup Language for advanced control
  language: SupportedLanguage;
  rate?: number; // Speaking rate (0.1 to 10)
  pitch?: number; // Pitch (0 to 2)
  volume?: number; // Volume (0 to 1)
  voice?: string; // Specific voice name
}

/**
 * Voice command handler result
 */
export interface CommandHandlerResult {
  success: boolean;
  response: VoiceResponse;
  action?: VoiceAction;
  data?: Record<string, unknown>;
  requiresFollowUp?: boolean;
  followUpPrompt?: VoiceResponse;
  error?: string;
}

/**
 * Voice session state
 */
export interface VoiceSession {
  sessionId: string;
  isActive: boolean;
  language: SupportedLanguage;
  context: CommandContext;
  lastCommand?: ParsedCommand;
  pendingConfirmation?: ParsedCommand;
  startedAt: Date;
  lastActivityAt: Date;
}

/**
 * Command context for multi-turn conversations
 */
export interface CommandContext {
  currentScreen?: string;
  selectedAsset?: string;
  selectedGuild?: string;
  selectedProposal?: string;
  pendingTransaction?: Record<string, unknown>;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
}

/**
 * Voice configuration
 */
export interface VoiceConfig {
  language: SupportedLanguage;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  wakeWord?: string;
  confirmationRequired: boolean;
  voiceFeedback: boolean;
  speechRate: number;
  speechPitch: number;
  speechVolume: number;
}

/**
 * Command pattern for matching
 */
interface CommandPattern {
  patterns: RegExp[];
  action: VoiceAction;
  category: CommandCategory;
  requiresConfirmation: boolean;
  parameterExtractors?: Record<string, RegExp>;
}

/**
 * Default command patterns for English
 */
const ENGLISH_COMMAND_PATTERNS: CommandPattern[] = [
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
  // Signal commands
  {
    patterns: [
      /send (?:a )?signal (?:to )?(.+)/i,
      /endorse (.+)/i,
      /support (.+)/i,
      /boost (.+)/i,
    ],
    action: 'SEND_SIGNAL',
    category: 'SIGNALS',
    requiresConfirmation: true,
    parameterExtractors: {
      content: /(?:to |endorse |support |boost )(.+)/i,
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
  // Navigation commands
  {
    patterns: [
      /(?:go|navigate) to (.+)/i,
      /open (.+)/i,
      /show (?:me )?(.+) (?:screen|page)/i,
    ],
    action: 'NAVIGATE',
    category: 'NAVIGATION',
    requiresConfirmation: false,
    parameterExtractors: {
      destination: /(?:to |open |show (?:me )?)(.+?)(?:\s+(?:screen|page))?$/i,
    },
  },
  // Help commands
  {
    patterns: [
      /help/i,
      /what can (?:i|you) (?:do|say)/i,
      /(?:show|list) commands/i,
      /how do i (.+)/i,
    ],
    action: 'GET_HELP',
    category: 'HELP',
    requiresConfirmation: false,
  },
  // Confirmation commands
  {
    patterns: [
      /yes/i,
      /confirm/i,
      /(?:that(?:'s)? )?correct/i,
      /approve/i,
      /go ahead/i,
      /do it/i,
    ],
    action: 'CONFIRM_ACTION',
    category: 'NAVIGATION',
    requiresConfirmation: false,
  },
  // Cancel commands
  {
    patterns: [
      /no/i,
      /cancel/i,
      /stop/i,
      /never ?mind/i,
      /abort/i,
    ],
    action: 'CANCEL_ACTION',
    category: 'NAVIGATION',
    requiresConfirmation: false,
  },
  // Repeat commands
  {
    patterns: [
      /repeat (?:that)?/i,
      /say (?:that )?again/i,
      /what(?:'d| did) you say/i,
      /pardon/i,
    ],
    action: 'REPEAT',
    category: 'HELP',
    requiresConfirmation: false,
  },
];

/**
 * Voice response templates
 */
const RESPONSE_TEMPLATES: Record<string, Record<SupportedLanguage, string>> = {
  WELCOME: {
    'en-US': 'Welcome to Verity Protocol. How can I help you today?',
    'en-GB': 'Welcome to Verity Protocol. How may I assist you?',
    'es-ES': 'Bienvenido a Verity Protocol. ¿Cómo puedo ayudarte hoy?',
    'fr-FR': 'Bienvenue sur Verity Protocol. Comment puis-je vous aider ?',
    'de-DE': 'Willkommen bei Verity Protocol. Wie kann ich Ihnen helfen?',
    'ja-JP': 'Verity Protocolへようこそ。本日はどのようなご用件でしょうか？',
    'zh-CN': '欢迎使用 Verity Protocol。我能为您做什么？',
    'ko-KR': 'Verity Protocol에 오신 것을 환영합니다. 무엇을 도와드릴까요?',
    'pt-BR': 'Bem-vindo ao Verity Protocol. Como posso ajudá-lo hoje?',
    'ru-RU': 'Добро пожаловать в Verity Protocol. Чем я могу помочь?',
    'ar-SA': 'مرحبًا بك في Verity Protocol. كيف يمكنني مساعدتك اليوم؟',
    'hi-IN': 'Verity Protocol में आपका स्वागत है। मैं आज आपकी कैसे मदद कर सकता हूं?',
    'nl-NL': 'Welkom bij Verity Protocol. Hoe kan ik u helpen?',
    'pl-PL': 'Witamy w Verity Protocol. Jak mogę pomóc?',
    'tr-TR': 'Verity Protocol\'a hoş geldiniz. Size nasıl yardımcı olabilirim?',
    'it-IT': 'Benvenuto su Verity Protocol. Come posso aiutarti oggi?',
    'es-MX': 'Bienvenido a Verity Protocol. ¿Cómo puedo ayudarte hoy?',
    'fr-CA': 'Bienvenue sur Verity Protocol. Comment puis-je vous aider ?',
    'en-AU': 'Welcome to Verity Protocol. How can I help you today?',
    'pt-PT': 'Bem-vindo ao Verity Protocol. Como posso ajudá-lo hoje?',
    'zh-TW': '歡迎使用 Verity Protocol。我能為您做什麼？',
  },
  BALANCE_RESPONSE: {
    'en-US': 'Your current balance is {balance} {currency}.',
    'en-GB': 'Your current balance is {balance} {currency}.',
    'es-ES': 'Su saldo actual es {balance} {currency}.',
    'fr-FR': 'Votre solde actuel est de {balance} {currency}.',
    'de-DE': 'Ihr aktuelles Guthaben beträgt {balance} {currency}.',
    'ja-JP': '現在の残高は {balance} {currency} です。',
    'zh-CN': '您当前的余额是 {balance} {currency}。',
    'ko-KR': '현재 잔액은 {balance} {currency}입니다.',
    'pt-BR': 'Seu saldo atual é {balance} {currency}.',
    'ru-RU': 'Ваш текущий баланс: {balance} {currency}.',
    'ar-SA': 'رصيدك الحالي هو {balance} {currency}.',
    'hi-IN': 'आपका वर्तमान शेष {balance} {currency} है।',
    'nl-NL': 'Uw huidige saldo is {balance} {currency}.',
    'pl-PL': 'Twój obecny stan konta to {balance} {currency}.',
    'tr-TR': 'Mevcut bakiyeniz {balance} {currency}.',
    'it-IT': 'Il tuo saldo attuale è {balance} {currency}.',
    'es-MX': 'Su saldo actual es {balance} {currency}.',
    'fr-CA': 'Votre solde actuel est de {balance} {currency}.',
    'en-AU': 'Your current balance is {balance} {currency}.',
    'pt-PT': 'O seu saldo atual é {balance} {currency}.',
    'zh-TW': '您當前的餘額是 {balance} {currency}。',
  },
  CONFIRM_TRANSACTION: {
    'en-US': 'You want to send {amount} {currency} to {recipient}. Should I proceed?',
    'en-GB': 'You wish to send {amount} {currency} to {recipient}. Shall I proceed?',
    'es-ES': 'Desea enviar {amount} {currency} a {recipient}. ¿Debo continuar?',
    'fr-FR': 'Vous voulez envoyer {amount} {currency} à {recipient}. Dois-je continuer ?',
    'de-DE': 'Sie möchten {amount} {currency} an {recipient} senden. Soll ich fortfahren?',
    'ja-JP': '{recipient} に {amount} {currency} を送金しますか？続行しますか？',
    'zh-CN': '您要向 {recipient} 发送 {amount} {currency}。我应该继续吗？',
    'ko-KR': '{recipient}에게 {amount} {currency}를 보내시겠습니까? 진행할까요?',
    'pt-BR': 'Você quer enviar {amount} {currency} para {recipient}. Devo continuar?',
    'ru-RU': 'Вы хотите отправить {amount} {currency} на {recipient}. Продолжить?',
    'ar-SA': 'تريد إرسال {amount} {currency} إلى {recipient}. هل أتابع؟',
    'hi-IN': 'आप {recipient} को {amount} {currency} भेजना चाहते हैं। क्या मैं आगे बढ़ूं?',
    'nl-NL': 'U wilt {amount} {currency} naar {recipient} sturen. Zal ik doorgaan?',
    'pl-PL': 'Chcesz wysłać {amount} {currency} do {recipient}. Czy mam kontynuować?',
    'tr-TR': '{recipient} adresine {amount} {currency} göndermek istiyorsunuz. Devam edeyim mi?',
    'it-IT': 'Vuoi inviare {amount} {currency} a {recipient}. Devo procedere?',
    'es-MX': 'Desea enviar {amount} {currency} a {recipient}. ¿Debo continuar?',
    'fr-CA': 'Vous voulez envoyer {amount} {currency} à {recipient}. Dois-je continuer ?',
    'en-AU': 'You want to send {amount} {currency} to {recipient}. Should I proceed?',
    'pt-PT': 'Deseja enviar {amount} {currency} para {recipient}. Devo continuar?',
    'zh-TW': '您要向 {recipient} 發送 {amount} {currency}。我應該繼續嗎？',
  },
  NOT_UNDERSTOOD: {
    'en-US': "I didn't understand that. Could you please repeat or say 'help' for available commands?",
    'en-GB': "I didn't quite catch that. Could you repeat or say 'help' for available commands?",
    'es-ES': "No entendí eso. ¿Podría repetir o decir 'ayuda' para los comandos disponibles?",
    'fr-FR': "Je n'ai pas compris. Pourriez-vous répéter ou dire 'aide' pour les commandes disponibles ?",
    'de-DE': "Das habe ich nicht verstanden. Könnten Sie wiederholen oder 'Hilfe' sagen?",
    'ja-JP': '理解できませんでした。もう一度おっしゃるか、「ヘルプ」と言ってください。',
    'zh-CN': '我没听懂。您能重复一遍吗？或者说"帮助"查看可用命令。',
    'ko-KR': '이해하지 못했습니다. 다시 말씀해 주시거나 "도움말"이라고 말씀해 주세요.',
    'pt-BR': "Não entendi. Você pode repetir ou dizer 'ajuda' para comandos disponíveis?",
    'ru-RU': 'Я не понял. Повторите или скажите «помощь» для списка команд.',
    'ar-SA': 'لم أفهم ذلك. هل يمكنك التكرار أو قول "مساعدة" للأوامر المتاحة؟',
    'hi-IN': "मैं समझ नहीं पाया। कृपया दोहराएं या उपलब्ध कमांड के लिए 'मदद' कहें।",
    'nl-NL': "Ik begreep dat niet. Kunt u herhalen of 'help' zeggen voor beschikbare opdrachten?",
    'pl-PL': "Nie zrozumiałem. Proszę powtórzyć lub powiedzieć 'pomoc' aby zobaczyć dostępne komendy.",
    'tr-TR': "Anlamadım. Tekrar eder misiniz veya mevcut komutlar için 'yardım' der misiniz?",
    'it-IT': "Non ho capito. Potresti ripetere o dire 'aiuto' per i comandi disponibili?",
    'es-MX': "No entendí eso. ¿Podría repetir o decir 'ayuda' para los comandos disponibles?",
    'fr-CA': "Je n'ai pas compris. Pourriez-vous répéter ou dire 'aide' pour les commandes disponibles ?",
    'en-AU': "I didn't understand that. Could you please repeat or say 'help' for available commands?",
    'pt-PT': "Não entendi. Pode repetir ou dizer 'ajuda' para comandos disponíveis?",
    'zh-TW': '我沒聽懂。您能重複一遍嗎？或者說"幫助"查看可用命令。',
  },
};

/**
 * Verity Voice Commands Handler
 * Production-ready voice interface
 */
export class VerityVoiceCommands extends EventEmitter {
  private config: VoiceConfig;
  private session?: VoiceSession;
  private commandPatterns: CommandPattern[];
  private lastResponse?: VoiceResponse;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private synthesis?: any;
  private isListening: boolean = false;

  constructor(config: Partial<VoiceConfig> = {}) {
    super();
    
    this.config = {
      language: config.language || 'en-US',
      continuous: config.continuous ?? true,
      interimResults: config.interimResults ?? true,
      maxAlternatives: config.maxAlternatives || 3,
      wakeWord: config.wakeWord,
      confirmationRequired: config.confirmationRequired ?? true,
      voiceFeedback: config.voiceFeedback ?? true,
      speechRate: config.speechRate || 1.0,
      speechPitch: config.speechPitch || 1.0,
      speechVolume: config.speechVolume || 1.0,
    };

    this.commandPatterns = ENGLISH_COMMAND_PATTERNS;

    // Initialize speech APIs if available
    this.initializeSpeechAPIs();

    logger.info('Voice Commands initialized', {
      language: this.config.language,
      continuous: this.config.continuous,
    });
  }

  /**
   * Initialize Web Speech APIs
   */
  private initializeSpeechAPIs(): void {
    // Check for browser support using globalThis for cross-environment compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalWindow = typeof globalThis !== 'undefined' ? (globalThis as any) : undefined;
    
    if (globalWindow) {
      // Speech Recognition
      const SpeechRecognition = 
        globalWindow.SpeechRecognition || 
        globalWindow.webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = this.config.continuous;
        this.recognition.interimResults = this.config.interimResults;
        this.recognition.maxAlternatives = this.config.maxAlternatives;
        this.recognition.lang = this.config.language;

        this.setupRecognitionHandlers();
      }

      // Speech Synthesis
      if (globalWindow.speechSynthesis) {
        this.synthesis = globalWindow.speechSynthesis;
      }
    }
  }

  /**
   * Set up recognition event handlers
   */
  private setupRecognitionHandlers(): void {
    if (!this.recognition) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const alternatives = Array.from(result).map((alt: any) => ({
        transcript: alt.transcript,
        confidence: alt.confidence,
      }));

      const recognitionResult: VoiceRecognitionResult = {
        transcript: result[0].transcript,
        confidence: result[0].confidence,
        isFinal: result.isFinal,
        alternatives,
        language: this.config.language,
        timestamp: new Date(),
      };

      this.emit('recognition', recognitionResult);

      if (result.isFinal) {
        this.handleRecognitionResult(recognitionResult);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.recognition.onerror = (event: any) => {
      logger.error('Speech recognition error', { error: event.error });
      this.emit('error', { type: 'recognition', error: event.error });
    };

    this.recognition.onend = () => {
      if (this.isListening && this.config.continuous) {
        this.recognition?.start();
      } else {
        this.isListening = false;
        this.emit('stopped');
      }
    };

    this.recognition.onstart = () => {
      this.emit('started');
    };
  }

  /**
   * Handle final recognition result
   */
  private async handleRecognitionResult(result: VoiceRecognitionResult): Promise<void> {
    // Check for wake word if configured
    if (this.config.wakeWord) {
      const lowerTranscript = result.transcript.toLowerCase();
      if (!lowerTranscript.includes(this.config.wakeWord.toLowerCase())) {
        return; // Ignore if wake word not detected
      }
    }

    // Parse the command
    const command = this.parseCommand(result.transcript);
    
    // Handle the command
    const handlerResult = await this.handleCommand(command);

    // Provide voice feedback if enabled
    if (this.config.voiceFeedback && handlerResult.response) {
      await this.speak(handlerResult.response);
    }

    // Emit command handled event
    this.emit('commandHandled', {
      command,
      result: handlerResult,
    });
  }

  /**
   * Start listening for voice commands
   */
  async startListening(): Promise<void> {
    if (!this.recognition) {
      throw new Error('Speech recognition not available');
    }

    if (this.isListening) {
      return;
    }

    // Create new session
    this.session = {
      sessionId: generateId('VSS'),
      isActive: true,
      language: this.config.language,
      context: {
        conversationHistory: [],
      },
      startedAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.isListening = true;
    this.recognition.start();

    // Speak welcome message
    if (this.config.voiceFeedback) {
      const welcomeTemplates = RESPONSE_TEMPLATES['WELCOME'] as Record<string, string> | undefined;
      const welcomeText = (welcomeTemplates && welcomeTemplates[this.config.language]) || 
                          (welcomeTemplates && welcomeTemplates['en-US']) || 
                          'Welcome to Verity Protocol.';
      await this.speak({ text: welcomeText, language: this.config.language });
    }

    logAuditAction('VOICE_SESSION_STARTED', this.session.sessionId, {
      language: this.config.language,
    });

    logger.info('Voice recognition started', {
      sessionId: this.session.sessionId,
    });
  }

  /**
   * Stop listening for voice commands
   */
  stopListening(): void {
    this.isListening = false;
    this.recognition?.stop();
    
    if (this.session) {
      this.session.isActive = false;
      logAuditAction('VOICE_SESSION_ENDED', this.session.sessionId, {});
    }

    logger.info('Voice recognition stopped');
  }

  /**
   * Parse transcript into a command
   */
  parseCommand(transcript: string): ParsedCommand {
    const normalizedTranscript = transcript.toLowerCase().trim();
    
    for (const pattern of this.commandPatterns) {
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

          const command: ParsedCommand = {
            id: generateId('CMD'),
            action: pattern.action,
            category: pattern.category,
            parameters,
            rawTranscript: transcript,
            confidence: 1.0,
            requiresConfirmation: pattern.requiresConfirmation,
            timestamp: new Date(),
          };

          logger.info('Command parsed', {
            action: command.action,
            category: command.category,
            parameters,
          });

          return command;
        }
      }
    }

    // Unknown command
    return {
      id: generateId('CMD'),
      action: 'UNKNOWN',
      category: 'HELP',
      parameters: {},
      rawTranscript: transcript,
      confidence: 0,
      requiresConfirmation: false,
      timestamp: new Date(),
    };
  }

  /**
   * Handle a parsed command
   */
  async handleCommand(command: ParsedCommand): Promise<CommandHandlerResult> {
    // Update session context
    if (this.session) {
      this.session.lastActivityAt = new Date();
      this.session.lastCommand = command;
      this.session.context.conversationHistory.push({
        role: 'user',
        content: command.rawTranscript,
        timestamp: command.timestamp,
      });
    }

    // Handle confirmation/cancellation
    if (command.action === 'CONFIRM_ACTION') {
      return this.handleConfirmation(true);
    }
    if (command.action === 'CANCEL_ACTION') {
      return this.handleConfirmation(false);
    }

    // Handle repeat
    if (command.action === 'REPEAT' && this.lastResponse) {
      return {
        success: true,
        response: this.lastResponse,
      };
    }

    // If command requires confirmation, store it
    if (command.requiresConfirmation && this.config.confirmationRequired) {
      if (this.session) {
        this.session.pendingConfirmation = command;
      }
      return this.generateConfirmationPrompt(command);
    }

    // Execute command
    return this.executeCommand(command);
  }

  /**
   * Handle confirmation/cancellation
   */
  private handleConfirmation(confirmed: boolean): CommandHandlerResult {
    const pendingCommand = this.session?.pendingConfirmation;
    
    if (!pendingCommand) {
      return {
        success: false,
        response: {
          text: 'There is nothing to confirm.',
          language: this.config.language,
        },
      };
    }

    // Clear pending confirmation
    if (this.session) {
      this.session.pendingConfirmation = undefined;
    }

    if (confirmed) {
      // Execute the pending command (note: executeCommand is async but we return synchronous result)
      // The actual execution will be handled via events
      this.executeCommand(pendingCommand).then(result => {
        this.emit('commandExecuted', result);
      }).catch(error => {
        this.emit('commandError', error);
      });
      return {
        success: true,
        response: {
          text: 'Executing your request...',
          language: this.config.language,
        },
      };
    } else {
      return {
        success: true,
        response: {
          text: 'Action cancelled.',
          language: this.config.language,
        },
      };
    }
  }

  /**
   * Generate confirmation prompt
   */
  private generateConfirmationPrompt(command: ParsedCommand): CommandHandlerResult {
    let promptText: string;
    const params = command.parameters;

    switch (command.action) {
      case 'SEND_PAYMENT':
        const confirmTemplates = RESPONSE_TEMPLATES['CONFIRM_TRANSACTION'] as Record<string, string> | undefined;
        const template = (confirmTemplates && confirmTemplates[this.config.language]) ||
                        (confirmTemplates && confirmTemplates['en-US']) || 
                        'You want to send {amount} {currency} to {recipient}. Should I proceed?';
        promptText = template
          .replace('{amount}', String(params['amount'] || ''))
          .replace('{currency}', String(params['currency'] || 'XRP'))
          .replace('{recipient}', String(params['recipient'] || ''));
        break;

      case 'STAKE_TOKENS':
        promptText = `You want to stake ${params['amount'] || ''} VRTY. Should I proceed?`;
        break;

      case 'UNSTAKE_TOKENS':
        promptText = `You want to unstake ${params['amount'] || 'all'} VRTY. Should I proceed?`;
        break;

      case 'VOTE_PROPOSAL':
        promptText = `You want to vote ${params['support'] || ''} on proposal ${params['proposalId'] || ''}. Should I proceed?`;
        break;

      default:
        promptText = 'Should I proceed with this action?';
    }

    return {
      success: true,
      response: {
        text: promptText,
        language: this.config.language,
      },
      requiresFollowUp: true,
    };
  }

  /**
   * Execute a command
   */
  private async executeCommand(command: ParsedCommand): Promise<CommandHandlerResult> {
    // Emit event for external handling
    this.emit('executeCommand', command);

    // Return appropriate response based on action
    switch (command.action) {
      case 'CHECK_BALANCE':
        return {
          success: true,
          response: {
            text: 'Checking your balance...',
            language: this.config.language,
          },
          action: command.action,
        };

      case 'SEND_PAYMENT':
        return {
          success: true,
          response: {
            text: `Sending ${command.parameters['amount'] || ''} ${command.parameters['currency'] || 'XRP'} to ${command.parameters['recipient'] || ''}.`,
            language: this.config.language,
          },
          action: command.action,
          data: command.parameters,
        };

      case 'VIEW_PORTFOLIO':
        return {
          success: true,
          response: {
            text: 'Opening your portfolio.',
            language: this.config.language,
          },
          action: command.action,
        };

      case 'GET_HELP':
        return this.getHelpResponse();

      case 'NAVIGATE':
        return {
          success: true,
          response: {
            text: `Navigating to ${command.parameters['destination'] || ''}.`,
            language: this.config.language,
          },
          action: command.action,
          data: command.parameters,
        };

      case 'UNKNOWN':
      default:
        const notUnderstoodTemplates = RESPONSE_TEMPLATES['NOT_UNDERSTOOD'] as Record<string, string> | undefined;
        const notUnderstood = (notUnderstoodTemplates && notUnderstoodTemplates[this.config.language]) ||
                             (notUnderstoodTemplates && notUnderstoodTemplates['en-US']) || "I didn't understand that.";
        return {
          success: false,
          response: {
            text: notUnderstood,
            language: this.config.language,
          },
        };
    }
  }

  /**
   * Get help response with available commands
   */
  private getHelpResponse(): CommandHandlerResult {
    const helpText = `You can say things like: 
      "Check my balance", 
      "Send 10 XRP to Alice", 
      "Stake 1000 VRTY", 
      "Show my portfolio", 
      "View tax summary", 
      "Vote yes on proposal", 
      or "Go to settings".`;

    return {
      success: true,
      response: {
        text: helpText,
        language: this.config.language,
        rate: 0.9, // Slightly slower for clarity
      },
      action: 'GET_HELP',
    };
  }

  /**
   * Speak a response using text-to-speech
   */
  async speak(response: VoiceResponse): Promise<void> {
    this.lastResponse = response;

    // Add to conversation history
    if (this.session) {
      this.session.context.conversationHistory.push({
        role: 'assistant',
        content: response.text,
        timestamp: new Date(),
      });
    }

    if (!this.synthesis) {
      logger.warn('Speech synthesis not available');
      return;
    }

    return new Promise((resolve, reject) => {
      // Create utterance using browser API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globalWindow = typeof globalThis !== 'undefined' ? (globalThis as any) : undefined;
      const SpeechSynthesisUtteranceClass = globalWindow?.SpeechSynthesisUtterance;
      
      if (!SpeechSynthesisUtteranceClass) {
        logger.warn('SpeechSynthesisUtterance not available');
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtteranceClass(response.text);
      
      utterance.lang = response.language;
      utterance.rate = response.rate || this.config.speechRate;
      utterance.pitch = response.pitch || this.config.speechPitch;
      utterance.volume = response.volume || this.config.speechVolume;

      // Find appropriate voice
      const voices = this.synthesis!.getVoices();
      const langPrefix = response.language.split('-')[0] || '';
      const preferredVoice = voices.find((v: SpeechSynthesisVoiceInfo) => 
        v.lang.startsWith(langPrefix) &&
        (response.voice ? v.name === response.voice : true)
      );
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        this.emit('speechEnded', response);
        resolve();
      };

      utterance.onerror = (event: { error: string }) => {
        logger.error('Speech synthesis error', { error: event.error });
        reject(new Error(event.error));
      };

      this.synthesis!.speak(utterance);
      this.emit('speaking', response);
    });
  }

  /**
   * Set language
   */
  setLanguage(language: SupportedLanguage): void {
    this.config.language = language;
    if (this.recognition) {
      this.recognition.lang = language;
    }
    if (this.session) {
      this.session.language = language;
    }
    logger.info('Voice language changed', { language });
  }

  /**
   * Get available voices
   */
  getAvailableVoices(): SpeechSynthesisVoiceInfo[] {
    if (!this.synthesis) return [];
    return this.synthesis.getVoices() as SpeechSynthesisVoiceInfo[];
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages(): SupportedLanguage[] {
    const welcomeTemplates = RESPONSE_TEMPLATES['WELCOME'];
    return welcomeTemplates ? Object.keys(welcomeTemplates) as SupportedLanguage[] : [];
  }

  /**
   * Check if voice is available
   */
  isVoiceAvailable(): boolean {
    return !!this.recognition && !!this.synthesis;
  }

  /**
   * Get current session
   */
  getSession(): VoiceSession | undefined {
    return this.session;
  }

  /**
   * Get configuration
   */
  getConfig(): VoiceConfig {
    return { ...this.config };
  }

  /**
   * Process text command directly (without voice)
   */
  async processTextCommand(text: string): Promise<CommandHandlerResult> {
    const command = this.parseCommand(text);
    return this.handleCommand(command);
  }
}

export default VerityVoiceCommands;
