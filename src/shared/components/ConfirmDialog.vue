<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="emit('cancel')">
    <section class="dialog" role="dialog" aria-modal="true" :aria-label="title">
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
      <footer>
        <button class="btn" @click="emit('cancel')">Cancel</button>
        <button class="btn primary" :class="{ destructive }" @click="emit('confirm')">
          {{ confirmLabel || 'Confirm' }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.48);
}

.dialog {
  width: min(420px, 100%);
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.2);
}

h3,
p {
  margin: 0;
}

p {
  margin-top: 8px;
  color: var(--text-light);
  line-height: 1.55;
}

footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.btn {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #ffffff;
  color: var(--text);
  cursor: pointer;
}

.btn.primary {
  border-color: var(--primary);
  background: var(--primary);
  color: #ffffff;
}

.btn.destructive {
  border-color: var(--error);
  background: var(--error);
}
</style>
