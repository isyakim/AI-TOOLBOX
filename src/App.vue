<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppLayout from './components/layout/AppLayout.vue'
</script>

<template>
  <AppLayout>
    <RouterView />
  </AppLayout>
</template>

<style>
/* Global styles are imported by main.ts. */
</style>
