<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  drop: [file: File];
}>();

const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    emit('drop', files[0]);
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    emit('drop', target.files[0]);
  }
}

function openFilePicker() {
  fileInput.value?.click();
}
</script>

<template>
  <div
    class="flex flex-col items-center justify-center min-h-screen p-8"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div
      class="w-full max-w-2xl p-16 text-center border-4 border-dashed rounded-3xl transition-all duration-300 cursor-pointer"
      :class="[
        isDragging 
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 scale-105' 
          : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'
      ]"
      @click="openFilePicker"
      @keydown.enter="openFilePicker"
      tabindex="0"
      role="button"
      :aria-label="'Drop EPUB file or click to browse'"
    >
      <div class="mb-8">
        <svg
          class="w-24 h-24 mx-auto text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      </div>

      <h1 class="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
        EpubWebReader
      </h1>
      
      <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
        Drag and drop your EPUB file here, or click to browse
      </p>

      <button
        class="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors duration-200"
        @click.stop="openFilePicker"
      >
        Select EPUB File
      </button>
    </div>

    <p class="mt-8 text-sm text-gray-500 dark:text-gray-400">
      All processing happens locally in your browser
    </p>

    <input
      ref="fileInput"
      type="file"
      accept=".epub,.EPUB"
      class="hidden"
      @change="handleFileSelect"
    />
  </div>
</template>
