<script setup lang="ts">
import type { PluginField } from '@/stores/plugins'

export type PluginInputValues = Record<string, string | number | boolean>

const props = defineProps<{
  fields: PluginField[]
  modelValue: PluginInputValues
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: PluginInputValues]
}>()

function updateField(fieldId: string, value: string | number | boolean) {
  emit('update:modelValue', { ...props.modelValue, [fieldId]: value })
}
</script>

<template>
  <div class="plugin-fields">
    <div v-for="field in fields" :key="field.id" class="field-group">
      <label :for="field.id" class="field-label">
        {{ field.label }}
        <span v-if="field.required" class="required-star">*</span>
      </label>

      <input
        v-if="field.type === 'text'"
        :id="field.id"
        :value="String(modelValue[field.id] ?? '')"
        type="text"
        :placeholder="field.placeholder"
        :disabled="disabled"
        class="field-control"
        @input="updateField(field.id, ($event.target as HTMLInputElement).value)"
      />
      <textarea
        v-else-if="field.type === 'textarea'"
        :id="field.id"
        :value="String(modelValue[field.id] ?? '')"
        :placeholder="field.placeholder"
        :rows="field.rows || 4"
        :disabled="disabled"
        class="field-control textarea"
        @input="updateField(field.id, ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
      <select
        v-else-if="field.type === 'select'"
        :id="field.id"
        :value="String(modelValue[field.id] ?? '')"
        :disabled="disabled"
        class="field-control"
        @change="updateField(field.id, ($event.target as HTMLSelectElement).value)"
      >
        <option value="" disabled>Select an option</option>
        <option v-for="option in field.options || []" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <input
        v-else-if="field.type === 'number'"
        :id="field.id"
        :value="Number(modelValue[field.id] ?? 0)"
        type="number"
        :placeholder="field.placeholder"
        :disabled="disabled"
        class="field-control"
        @input="updateField(field.id, ($event.target as HTMLInputElement).valueAsNumber)"
      />
      <label v-else-if="field.type === 'toggle'" class="toggle-control">
        <input
          type="checkbox"
          :checked="Boolean(modelValue[field.id])"
          :disabled="disabled"
          @change="updateField(field.id, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ modelValue[field.id] ? 'Enabled' : 'Disabled' }}</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.plugin-fields {
  display: grid;
  gap: 16px;
}

.field-group {
  display: grid;
  gap: 6px;
}

.field-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text);
}

.required-star {
  color: var(--error);
}

.field-control {
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #ffffff;
  color: var(--text);
  font: inherit;
}

.field-control:focus {
  outline: none;
  border-color: var(--primary);
}

.field-control.textarea {
  min-height: 120px;
  resize: vertical;
  line-height: 1.55;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 0.84rem;
}

.toggle-control {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.84rem;
  color: var(--text-light);
}
</style>
