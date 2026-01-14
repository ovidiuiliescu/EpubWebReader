import { defineStore } from 'pinia';
import { useStorage } from '@vueuse/core';
import { reactive, ref, watch } from 'vue';
import type { UserPreferences } from '@/types/epub';

interface StoredPrefs {
  theme: 'light' | 'dark' | 'sepia' | 'warm';
  fontSize: number;
  fontFamily: 'georgia' | 'campote' | 'arial' | 'verdana';
  lineHeight: number;
  padding: number;
}

const DEFAULT_STORED_PREFS: StoredPrefs = {
  theme: 'light',
  fontSize: 18,
  fontFamily: 'georgia',
  lineHeight: 1.8,
  padding: 32,
};

export const useSettingsStore = defineStore('settings', () => {
  const storedPrefs = useStorage<StoredPrefs>('reader-preferences', DEFAULT_STORED_PREFS);
  const wideMode = ref(false);

  const preferences = reactive<UserPreferences>({
    theme: storedPrefs.value.theme,
    fontSize: storedPrefs.value.fontSize,
    fontFamily: storedPrefs.value.fontFamily,
    lineHeight: storedPrefs.value.lineHeight,
    padding: storedPrefs.value.padding,
    wideMode: wideMode.value,
  });

  watch(
    () => ({
      theme: preferences.theme,
      fontSize: preferences.fontSize,
      fontFamily: preferences.fontFamily,
      lineHeight: preferences.lineHeight,
      padding: preferences.padding,
    }),
    (newPrefs) => {
      storedPrefs.value = { ...newPrefs };
    },
    { deep: true }
  );

  function setTheme(theme: UserPreferences['theme']): void {
    preferences.theme = theme;
  }

  function setFontSize(size: number): void {
    preferences.fontSize = Math.min(32, Math.max(12, size));
  }

  function setFontFamily(font: UserPreferences['fontFamily']): void {
    preferences.fontFamily = font;
  }

  function setLineHeight(height: number): void {
    preferences.lineHeight = height;
  }

  function setPadding(padding: number): void {
    preferences.padding = padding;
  }

  function toggleWideMode(): void {
    preferences.wideMode = !preferences.wideMode;
    wideMode.value = preferences.wideMode;
  }

  function reset(): void {
    preferences.theme = DEFAULT_STORED_PREFS.theme;
    preferences.fontSize = DEFAULT_STORED_PREFS.fontSize;
    preferences.fontFamily = DEFAULT_STORED_PREFS.fontFamily;
    preferences.lineHeight = DEFAULT_STORED_PREFS.lineHeight;
    preferences.padding = DEFAULT_STORED_PREFS.padding;
    preferences.wideMode = false;
    wideMode.value = false;
  }

  return {
    preferences,
    setTheme,
    setFontSize,
    setFontFamily,
    setLineHeight,
    setPadding,
    toggleWideMode,
    reset,
  };
});
