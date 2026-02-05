/**
 * Image Utils - 图片处理工具
 * 用于处理 Vision 模型所需的图片编码和压缩
 */

export interface ImageInfo {
  file: File
  url: string        // Object URL 用于预览
  base64: string     // Base64 编码用于 API
  width: number
  height: number
  size: number       // bytes
  type: string
}

/**
 * 将 File 转换为 Base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // 提取纯 base64 部分（去掉 data:image/xxx;base64, 前缀）
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 将 File 转换为 Data URL
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 获取图片尺寸
 */
export function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = reject
    img.src = src
  })
}

/**
 * 压缩图片
 * @param file 原始图片文件
 * @param options 压缩选项
 */
export async function compressImage(
  file: File,
  options: {
    maxWidth?: number
    maxHeight?: number
    quality?: number
    type?: 'image/jpeg' | 'image/png' | 'image/webp'
  } = {}
): Promise<{ blob: Blob; dataUrl: string }> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.85,
    type = 'image/jpeg'
  } = options

  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      let { naturalWidth: width, naturalHeight: height } = img

      // 计算缩放比例
      const scale = Math.min(
        maxWidth / width,
        maxHeight / height,
        1 // 不放大
      )

      width = Math.round(width * scale)
      height = Math.round(height * scale)

      // 创建 canvas 进行压缩
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // 绘制图片
      ctx.drawImage(img, 0, 0, width, height)

      // 转换为 Blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'))
            return
          }

          const dataUrl = canvas.toDataURL(type, quality)
          URL.revokeObjectURL(objectUrl)
          resolve({ blob, dataUrl })
        },
        type,
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }

    img.src = objectUrl
  })
}

/**
 * 处理上传的图片文件，返回完整的 ImageInfo
 */
export async function processImageFile(
  file: File,
  compress: boolean = true
): Promise<ImageInfo> {
  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择有效的图片文件')
  }

  // 验证文件大小 (最大 20MB)
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('图片大小不能超过 20MB')
  }

  let dataUrl: string
  let blob: Blob = file

  if (compress && file.size > 512 * 1024) {
    // 如果大于 512KB，进行压缩
    const compressed = await compressImage(file)
    dataUrl = compressed.dataUrl
    blob = compressed.blob
  } else {
    dataUrl = await fileToDataUrl(file)
  }

  const dimensions = await getImageDimensions(dataUrl)
  const base64 = dataUrl.split(',')[1]

  return {
    file,
    url: URL.createObjectURL(blob),
    base64,
    width: dimensions.width,
    height: dimensions.height,
    size: blob.size,
    type: file.type
  }
}

/**
 * 从剪贴板读取图片
 */
export async function getImageFromClipboard(): Promise<File | null> {
  try {
    const clipboardItems = await navigator.clipboard.read()
    
    for (const item of clipboardItems) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type)
          return new File([blob], `clipboard-${Date.now()}.png`, { type })
        }
      }
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * 构建 Vision API 消息内容
 */
export function buildVisionContent(
  text: string,
  images: ImageInfo[]
): Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> {
  const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = []

  // 添加文本
  if (text.trim()) {
    content.push({ type: 'text', text: text.trim() })
  }

  // 添加图片
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.type};base64,${img.base64}`
      }
    })
  }

  return content
}

/**
 * 清理 Object URLs
 */
export function revokeImageUrls(images: ImageInfo[]) {
  images.forEach(img => URL.revokeObjectURL(img.url))
}
