/**
 * Speech Service - 语音输入与TTS播报
 * 使用 Web Speech API 实现语音识别和语音合成
 */

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

// 扩展 Window 类型以包含 SpeechRecognition
interface SpeechRecognitionType {
  new (): any
  prototype: any
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionType
    webkitSpeechRecognition: SpeechRecognitionType
  }
}

class SpeechService {
  private recognition: any = null
  private synthesis: SpeechSynthesis | null = null
  private isListening = false
  private isSpeaking = false

  constructor() {
    // 初始化语音识别
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognitionAPI) {
        this.recognition = new SpeechRecognitionAPI()
        this.recognition.continuous = false
        this.recognition.interimResults = true
        this.recognition.lang = 'zh-CN'
      }

      // 初始化语音合成
      this.synthesis = window.speechSynthesis || null
    }
  }

  /**
   * 检查是否支持语音识别
   */
  get isRecognitionSupported(): boolean {
    return this.recognition !== null
  }

  /**
   * 检查是否支持语音合成
   */
  get isSynthesisSupported(): boolean {
    return this.synthesis !== null
  }

  /**
   * 获取当前录音状态
   */
  get recording(): boolean {
    return this.isListening
  }

  /**
   * 获取当前播放状态
   */
  get speaking(): boolean {
    return this.isSpeaking
  }

  /**
   * 开始语音识别
   */
  startRecognition(callbacks: SpeechRecognitionCallbacks = {}): boolean {
    if (!this.recognition) {
      callbacks.onError?.('您的浏览器不支持语音识别')
      return false
    }

    if (this.isListening) {
      return false
    }

    const { onResult, onEnd, onError, onStart } = callbacks

    this.recognition.onstart = () => {
      this.isListening = true
      onStart?.()
    }

    this.recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1]
      const transcript = result[0].transcript
      const confidence = result[0].confidence
      const isFinal = result.isFinal

      onResult?.({ transcript, confidence, isFinal })
    }

    this.recognition.onerror = (event: any) => {
      this.isListening = false

      const errorMessages: Record<string, string> = {
        'no-speech': '未检测到语音，请重试',
        aborted: '语音识别已取消',
        'audio-capture': '无法访问麦克风，请检查权限',
        network: '网络错误',
        'not-allowed': '麦克风权限被拒绝',
        'service-not-allowed': '语音服务不可用'
      }

      onError?.(errorMessages[event.error] || `语音识别错误: ${event.error}`)
    }

    this.recognition.onend = () => {
      this.isListening = false
      onEnd?.()
    }

    try {
      this.recognition.start()
      return true
    } catch {
      callbacks.onError?.('启动语音识别失败')
      return false
    }
  }

  /**
   * 停止语音识别
   */
  stopRecognition() {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
      this.isListening = false
    }
  }

  /**
   * 切换语音识别状态
   */
  toggleRecognition(callbacks: SpeechRecognitionCallbacks = {}): boolean {
    if (this.isListening) {
      this.stopRecognition()
      return false
    } else {
      return this.startRecognition(callbacks)
    }
  }

  /**
   * 获取可用的语音列表
   */
  getVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) return []
    return this.synthesis.getVoices()
  }

  /**
   * 获取中文语音
   */
  getChineseVoices(): SpeechSynthesisVoice[] {
    return this.getVoices().filter(
      (v) => v.lang.startsWith('zh') || v.lang.includes('CN') || v.lang.includes('TW')
    )
  }

  /**
   * 朗读文本 (TTS)
   */
  speak(
    text: string,
    options: {
      voice?: SpeechSynthesisVoice
      rate?: number
      pitch?: number
      volume?: number
      onEnd?: () => void
      onError?: (error: string) => void
    } = {}
  ): boolean {
    if (!this.synthesis) {
      options.onError?.('您的浏览器不支持语音合成')
      return false
    }

    // 停止当前播放
    this.stopSpeaking()

    const { voice, rate = 1.0, pitch = 1.0, volume = 1.0, onEnd, onError } = options

    const utterance = new SpeechSynthesisUtterance(text)

    // 设置语音参数
    if (voice) {
      utterance.voice = voice
    } else {
      // 尝试使用中文语音
      const chineseVoices = this.getChineseVoices()
      if (chineseVoices.length > 0) {
        utterance.voice = chineseVoices[0]
      }
    }

    utterance.rate = rate
    utterance.pitch = pitch
    utterance.volume = volume
    utterance.lang = 'zh-CN'

    utterance.onstart = () => {
      this.isSpeaking = true
    }

    utterance.onend = () => {
      this.isSpeaking = false
      onEnd?.()
    }

    utterance.onerror = (event) => {
      this.isSpeaking = false
      onError?.(event.error || '语音播放失败')
    }

    this.synthesis.speak(utterance)
    return true
  }

  /**
   * 停止语音播放
   */
  stopSpeaking() {
    if (this.synthesis && this.isSpeaking) {
      this.synthesis.cancel()
      this.isSpeaking = false
    }
  }

  /**
   * 暂停语音播放
   */
  pauseSpeaking() {
    if (this.synthesis) {
      this.synthesis.pause()
    }
  }

  /**
   * 恢复语音播放
   */
  resumeSpeaking() {
    if (this.synthesis) {
      this.synthesis.resume()
    }
  }
}

// 单例导出
export const speechService = new SpeechService()

// 类型导出
export { SpeechService }
