export interface SpeechRecognitionResult {
  transcript: string
  confidence: number
  isFinal: boolean
}

export interface SpeechRecognitionCallbacks {
  onResult?: (result: SpeechRecognitionResult) => void
  onEnd?: () => void
  onError?: (error: string) => void
  onStart?: () => void
}

interface BrowserSpeechAlternative {
  transcript: string
  confidence: number
}

interface BrowserSpeechResult {
  readonly isFinal: boolean
  readonly length: number
  readonly [index: number]: BrowserSpeechAlternative
}

interface BrowserSpeechResultList {
  readonly length: number
  readonly [index: number]: BrowserSpeechResult
}

interface BrowserSpeechResultEvent extends Event {
  readonly results: BrowserSpeechResultList
}

interface BrowserSpeechErrorEvent extends Event {
  readonly error: string
}

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onresult: ((event: BrowserSpeechResultEvent) => void) | null
  onerror: ((event: BrowserSpeechErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

interface BrowserSpeechRecognitionConstructor {
  new (): BrowserSpeechRecognition
}

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  }
}

interface SpeakOptions {
  voice?: SpeechSynthesisVoice
  rate?: number
  pitch?: number
  volume?: number
  onEnd?: () => void
  onError?: (error: string) => void
}

class SpeechService {
  private recognition: BrowserSpeechRecognition | null = null
  private synthesis: SpeechSynthesis | null = null
  private isListening = false
  private isSpeaking = false

  constructor() {
    if (typeof window === 'undefined') return
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (Recognition) {
      this.recognition = new Recognition()
      this.recognition.continuous = false
      this.recognition.interimResults = true
      this.recognition.lang = 'zh-CN'
    }
    this.synthesis = window.speechSynthesis || null
  }

  get isRecognitionSupported(): boolean {
    return this.recognition !== null
  }

  get isSynthesisSupported(): boolean {
    return this.synthesis !== null
  }

  get recording(): boolean {
    return this.isListening
  }

  get speaking(): boolean {
    return this.isSpeaking
  }

  startRecognition(callbacks: SpeechRecognitionCallbacks = {}): boolean {
    const recognition = this.recognition
    if (!recognition) {
      callbacks.onError?.('Speech recognition is not supported by this browser.')
      return false
    }
    if (this.isListening) return false

    recognition.onstart = () => {
      this.isListening = true
      callbacks.onStart?.()
    }
    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1]
      const alternative = result?.[0]
      if (!result || !alternative) return
      callbacks.onResult?.({
        transcript: alternative.transcript,
        confidence: alternative.confidence,
        isFinal: result.isFinal
      })
    }
    recognition.onerror = (event) => {
      this.isListening = false
      const messages: Record<string, string> = {
        'no-speech': 'No speech was detected. Please try again.',
        aborted: 'Speech recognition was cancelled.',
        'audio-capture': 'The microphone is unavailable. Check its permissions.',
        network: 'A network error interrupted speech recognition.',
        'not-allowed': 'Microphone permission was denied.',
        'service-not-allowed': 'Speech recognition service is unavailable.'
      }
      callbacks.onError?.(messages[event.error] || `Speech recognition failed: ${event.error}`)
    }
    recognition.onend = () => {
      this.isListening = false
      callbacks.onEnd?.()
    }

    try {
      recognition.start()
      return true
    } catch (error: unknown) {
      callbacks.onError?.(error instanceof Error ? error.message : 'Speech recognition failed.')
      return false
    }
  }

  stopRecognition(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
      this.isListening = false
    }
  }

  toggleRecognition(callbacks: SpeechRecognitionCallbacks = {}): boolean {
    if (!this.isListening) return this.startRecognition(callbacks)
    this.stopRecognition()
    return false
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.synthesis?.getVoices() || []
  }

  getChineseVoices(): SpeechSynthesisVoice[] {
    return this.getVoices().filter(
      (voice) =>
        voice.lang.startsWith('zh') || voice.lang.includes('CN') || voice.lang.includes('TW')
    )
  }

  speak(text: string, options: SpeakOptions = {}): boolean {
    if (!this.synthesis) {
      options.onError?.('Speech synthesis is not supported by this browser.')
      return false
    }

    this.stopSpeaking()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = options.voice || this.getChineseVoices()[0] || null
    utterance.rate = options.rate ?? 1
    utterance.pitch = options.pitch ?? 1
    utterance.volume = options.volume ?? 1
    utterance.lang = 'zh-CN'
    utterance.onstart = () => {
      this.isSpeaking = true
    }
    utterance.onend = () => {
      this.isSpeaking = false
      options.onEnd?.()
    }
    utterance.onerror = (event) => {
      this.isSpeaking = false
      options.onError?.(event.error || 'Speech playback failed.')
    }
    this.synthesis.speak(utterance)
    return true
  }

  stopSpeaking(): void {
    if (this.synthesis && this.isSpeaking) {
      this.synthesis.cancel()
      this.isSpeaking = false
    }
  }

  pauseSpeaking(): void {
    this.synthesis?.pause()
  }

  resumeSpeaking(): void {
    this.synthesis?.resume()
  }
}

export const speechService = new SpeechService()
export { SpeechService }
