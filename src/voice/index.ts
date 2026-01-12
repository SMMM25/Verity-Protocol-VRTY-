/**
 * Verity Protocol - Voice Commands Module
 * Production-ready voice interface for hands-free operation
 * 
 * Features:
 * - Client-side speech recognition (Web Speech API)
 * - Server-side command processing (REST API)
 * - Multi-language NLP support (20+ languages)
 * - Natural language command parsing
 * - Voice synthesis for responses
 * - Context-aware conversation handling
 * - Accessibility compliance (WCAG 2.1)
 */

// Client-side Voice Commands SDK
export {
  VerityVoiceCommands,
  type SupportedLanguage,
  type CommandCategory,
  type VoiceAction,
  type VoiceRecognitionResult,
  type ParsedCommand,
  type VoiceResponse,
  type CommandHandlerResult,
  type VoiceSession,
  type CommandContext,
  type VoiceConfig,
} from './VoiceCommands.js';

// Server-side Voice API Routes
export {
  voiceRoutes,
  SUPPORTED_LANGUAGES,
  type VoiceSession as VoiceAPISession,
  type CommandContext as VoiceAPIContext,
  type ConversationEntry,
  type ParsedCommand as APICommand,
  type VoiceCommandResult,
} from './VoiceAPIRoutes.js';

// Default exports
export { default as VoiceCommands } from './VoiceCommands.js';
export { default as VoiceAPIRoutes } from './VoiceAPIRoutes.js';
