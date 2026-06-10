/**
 * 图片工具函数单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fileToBase64, isValidImageType, buildVisionContent } from '@/utils/imageUtils'

describe('Image Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isValidImageType', () => {
    it('should accept valid image types', () => {
      expect(isValidImageType('image/jpeg')).toBe(true)
      expect(isValidImageType('image/png')).toBe(true)
      expect(isValidImageType('image/webp')).toBe(true)
      expect(isValidImageType('image/gif')).toBe(true)
    })

    it('should reject invalid image types', () => {
      expect(isValidImageType('text/plain')).toBe(false)
      expect(isValidImageType('application/pdf')).toBe(false)
      expect(isValidImageType('video/mp4')).toBe(false)
    })
  })

  describe('buildVisionContent', () => {
    it('should build text-only content when no images', () => {
      const content = buildVisionContent('Hello', [])

      expect(content).toHaveLength(1)
      expect(content[0]).toEqual({ type: 'text', text: 'Hello' })
    })

    it('should build content with text and images', () => {
      const images = [
        {
          url: 'blob://1',
          base64: 'abc123',
          type: 'image/jpeg',
          file: null as any,
          width: 100,
          height: 100,
          size: 1000
        }
      ]

      const content = buildVisionContent('Describe this', images)

      expect(content).toHaveLength(2)
      expect(content[0]).toEqual({ type: 'text', text: 'Describe this' })
      expect(content[1].type).toBe('image_url')
      expect((content[1] as any).image_url.url).toContain('data:image/jpeg;base64')
    })

    it('should handle multiple images', () => {
      const images = [
        {
          url: 'blob://1',
          base64: 'abc',
          type: 'image/jpeg',
          file: null as any,
          width: 100,
          height: 100,
          size: 1000
        },
        {
          url: 'blob://2',
          base64: 'def',
          type: 'image/png',
          file: null as any,
          width: 200,
          height: 200,
          size: 2000
        }
      ]

      const content = buildVisionContent('Compare', images)

      expect(content).toHaveLength(3) // 1 text + 2 images
    })
  })

  describe('fileToBase64', () => {
    it('should convert file to base64', async () => {
      // Create a mock file
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })

      // Mock FileReader
      const mockReadAsDataURL = vi.fn()
      const mockFileReader = {
        readAsDataURL: mockReadAsDataURL,
        result: 'data:text/plain;base64,dGVzdCBjb250ZW50',
        onload: null as any,
        onerror: null as any
      }

      vi.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any)

      // Trigger the promise
      const promise = fileToBase64(mockFile)

      // Simulate successful read
      setTimeout(() => {
        mockFileReader.onload?.()
      }, 0)

      await promise
      expect(mockReadAsDataURL).toHaveBeenCalledWith(mockFile)
    })
  })
})
