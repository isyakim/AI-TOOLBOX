<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppLayout from './components/layout/AppLayout.vue'
import { useThemeStore } from '@/stores'

const themeStore = useThemeStore()

onMounted(() => {
  themeStore.loadFromStorage()
})
</script>

<template>
  <AppLayout>
    <RouterView />
  </AppLayout>
</template>

<style>
/* 全局样式已在 main.ts 中引入 */
</style>
