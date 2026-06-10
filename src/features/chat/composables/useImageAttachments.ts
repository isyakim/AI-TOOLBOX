import { onUnmounted, ref } from 'vue'
import { MAX_IMAGES, processImageFile, revokeImageUrls, type ImageInfo } from '@/utils/imageUtils'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Image processing failed.'
}

export function useImageAttachments() {
  const images = ref<ImageInfo[]>([])
  const errorMessage = ref('')

  async function addFiles(files: File[]) {
    errorMessage.value = ''
    for (const file of files) {
      if (images.value.length >= MAX_IMAGES) {
        errorMessage.value = `You can attach up to ${MAX_IMAGES} images.`
        break
      }

      try {
        images.value.push(await processImageFile(file))
      } catch (error: unknown) {
        errorMessage.value = getErrorMessage(error)
      }
    }
  }

  async function handleFileInput(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files) await addFiles(Array.from(input.files))
    input.value = ''
  }

  async function handlePaste(event: ClipboardEvent) {
    const items = event.clipboardData ? Array.from(event.clipboardData.items) : []
    const imageItem = items.find((item) => item.type.startsWith('image/'))
    if (!imageItem) return

    const file = imageItem.getAsFile()
    if (!file) return
    event.preventDefault()
    await addFiles([file])
  }

  function removeImage(index: number) {
    revokeImageUrls(images.value.splice(index, 1))
  }

  function takeImages(): ImageInfo[] {
    const selected = [...images.value]
    images.value = []
    errorMessage.value = ''
    return selected
  }

  onUnmounted(() => revokeImageUrls(images.value))

  return {
    images,
    errorMessage,
    maxImages: MAX_IMAGES,
    handleFileInput,
    handlePaste,
    removeImage,
    takeImages
  }
}
