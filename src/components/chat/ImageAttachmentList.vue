<script setup lang="ts">
import type { ImageInfo } from '@/utils/imageUtils'

defineProps<{
  images: ImageInfo[]
}>()

const emit = defineEmits<{
  remove: [index: number]
}>()
</script>

<template>
  <div class="attachment-list" aria-label="Image attachments">
    <div v-for="(image, index) in images" :key="image.url" class="attachment">
      <img :src="image.url" :alt="`Attachment ${index + 1}`" />
      <button type="button" title="Remove image" @click="emit('remove', index)">x</button>
      <span>{{ Math.ceil(image.size / 1024) }} KB</span>
    </div>
  </div>
</template>

<style scoped>
.attachment-list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0;
}

.attachment {
  position: relative;
  width: 72px;
  height: 72px;
  flex: 0 0 72px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #f8fafc;
}

.attachment img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.attachment button {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.82);
  color: #ffffff;
  cursor: pointer;
}

.attachment span {
  position: absolute;
  bottom: 3px;
  left: 3px;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(15, 23, 42, 0.82);
  color: #ffffff;
  font-size: 0.62rem;
}
</style>
