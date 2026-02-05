/**
 * Plugin Executor Service
 * 插件运行服务 - 包含沙箱执行器
 */

import { getAIClient, type ChatMessage } from './aiClient'
import type { Plugin, PluginField } from '@/stores/plugins'

export interface PluginExecutionContext {
  plugin: Plugin
  inputs: Record<string, any>
  onToken?: (token: string) => void
  onProgress?: (stage: string) => void
}

export interface PluginExecutionResult {
  success: boolean
  rawOutput: string
  processedOutput: string
  error?: string
  executionTime: number
}

/**
 * 构建用户消息
 */
function buildUserMessage(plugin: Plugin, inputs: Record<string, any>): string {
  const parts: string[] = []
  
  plugin.fields.forEach(field => {
    const value = inputs[field.id]
    if (value !== undefined && value !== '') {
      parts.push(`**${field.label}**: ${value}`)
    }
  })
  
  return parts.join('\n\n')
}

/**
 * 沙箱执行 JavaScript 代码
 * 使用 Function 构造器 + 限制作用域实现基础沙箱
 */
function executeSandboxedScript(script: string, context: { result: string; inputs: Record<string, any> }): string {
  try {
    // 创建安全的执行环境
    const safeGlobals = {
      // 允许的全局对象
      JSON,
      Math,
      Date,
      String,
      Number,
      Array,
      Object,
      Boolean,
      RegExp,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURIComponent,
      decodeURIComponent,
      
      // 注入上下文
      result: context.result,
      inputs: context.inputs,
      
      // 禁用的对象 (设为 undefined)
      window: undefined,
      document: undefined,
      fetch: undefined,
      XMLHttpRequest: undefined,
      eval: undefined,
      Function: undefined,
      require: undefined,
      process: undefined,
      global: undefined,
      localStorage: undefined,
      sessionStorage: undefined
    }
    
    // 构建安全的函数体
    const funcBody = `
      "use strict";
      ${Object.keys(safeGlobals).map(key => `const ${key} = __globals__.${key};`).join('\n')}
      ${script}
    `
    
    // 创建并执行函数
    const sandboxedFunc = new Function('__globals__', funcBody)
    const output = sandboxedFunc(safeGlobals)
    
    // 如果没有显式 return，返回原始结果
    return output !== undefined ? String(output) : context.result
    
  } catch (error: any) {
    console.error('Sandbox execution error:', error)
    return `[后处理器错误] ${error.message}\n\n---\n\n${context.result}`
  }
}

/**
 * 执行插件
 */
export async function executePlugin(ctx: PluginExecutionContext): Promise<PluginExecutionResult> {
  const startTime = Date.now()
  const { plugin, inputs, onToken, onProgress } = ctx
  
  const aiClient = getAIClient()
  if (!aiClient) {
    return {
      success: false,
      rawOutput: '',
      processedOutput: '',
      error: '请先在设置中配置 AI API',
      executionTime: 0
    }
  }
  
  try {
    onProgress?.('生成中...')
    
    // 构建消息
    const systemMessage: ChatMessage = {
      role: 'system',
      content: plugin.systemPrompt
    }
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: buildUserMessage(plugin, inputs)
    }
    
    // 执行 AI 调用
    let rawOutput = ''
    await aiClient.chat([systemMessage, userMessage], {
      onToken: (token) => {
        rawOutput += token
        onToken?.(token)
      }
    })
    
    // 后处理
    let processedOutput = rawOutput
    
    if (plugin.postProcessor?.enabled && plugin.postProcessor.script) {
      onProgress?.('后处理中...')
      processedOutput = executeSandboxedScript(
        plugin.postProcessor.script,
        { result: rawOutput, inputs }
      )
    }
    
    return {
      success: true,
      rawOutput,
      processedOutput,
      executionTime: Date.now() - startTime
    }
    
  } catch (error: any) {
    return {
      success: false,
      rawOutput: '',
      processedOutput: '',
      error: error.message || '执行失败',
      executionTime: Date.now() - startTime
    }
  }
}

/**
 * 验证插件配置
 */
export function validatePlugin(plugin: Partial<Plugin>): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!plugin.name?.trim()) {
    errors.push('插件名称不能为空')
  }
  
  if (!plugin.systemPrompt?.trim()) {
    errors.push('系统提示词不能为空')
  }
  
  if (!plugin.fields || plugin.fields.length === 0) {
    errors.push('至少需要定义一个输入字段')
  }
  
  plugin.fields?.forEach((field, index) => {
    if (!field.id?.trim()) {
      errors.push(`字段 ${index + 1}: ID 不能为空`)
    }
    if (!field.label?.trim()) {
      errors.push(`字段 ${index + 1}: 标签不能为空`)
    }
    if (!field.type) {
      errors.push(`字段 ${index + 1}: 类型不能为空`)
    }
    if (field.type === 'select' && (!field.options || field.options.length === 0)) {
      errors.push(`字段 ${index + 1}: 下拉选项不能为空`)
    }
  })
  
  // 验证后处理器脚本语法
  if (plugin.postProcessor?.enabled && plugin.postProcessor.script) {
    try {
      new Function('result', 'inputs', plugin.postProcessor.script)
    } catch (e: any) {
      errors.push(`后处理器脚本语法错误: ${e.message}`)
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * 测试后处理器脚本
 */
export function testPostProcessor(script: string, testResult: string = 'Test output'): { success: boolean; output: string; error?: string } {
  try {
    const output = executeSandboxedScript(script, { 
      result: testResult, 
      inputs: { test: 'value' } 
    })
    return { success: true, output }
  } catch (error: any) {
    return { success: false, output: '', error: error.message }
  }
}
