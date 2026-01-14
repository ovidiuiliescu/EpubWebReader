import { defineStore } from 'pinia';
import { useStorage } from '@vueuse/core';
import { reactive, ref } from 'vue';
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
    ...storedPrefs.value,
    wideMode: false,
  });

  storedPrefs.value = DEFAULT_STORED_PREFS;
  wideMode.value = false;

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
    wideMode.value = !wideMode.value;
    preferences.wideMode = wideMode.value;
  }

  function reset(): void {
    storedPrefs.value = { ...DEFAULT_STORED_PREFS };
    wideMode.value = false;
    preferences.theme = DEFAULT_STORED_PREFS.theme;
    preferences.fontSize = DEFAULT_STORED_PREFS.fontSize;
    preferences.fontFamily = DEFAULT_STORED_PREFS.fontFamily;
    preferences.lineHeight = DEFAULT_STORED_PREFS.lineHeight;
    preferences.padding = DEFAULT_STORED_PREFS.padding;
    preferences.wideMode = false;
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
