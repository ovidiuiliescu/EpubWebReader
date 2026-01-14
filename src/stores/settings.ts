import { defineStore } from 'pinia';
import { useStorage } from '@vueuse/core';
import type { UserPreferences } from '@/types/epub';

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  fontSize: 18,
  fontFamily: 'georgia',
  lineHeight: 1.6,
  padding: 24,
};

export const useSettingsStore = defineStore('settings', () => {
  const preferences = useStorage<UserPreferences>('reader-preferences', DEFAULT_PREFERENCES);

  function setTheme(theme: UserPreferences['theme']): void {
    preferences.value.theme = theme;
  }

  function setFontSize(size: number): void {
    preferences.value.fontSize = Math.min(32, Math.max(12, size));
  }

  function setFontFamily(font: UserPreferences['fontFamily']): void {
    preferences.value.fontFamily = font;
  }

  function setLineHeight(height: number): void {
    preferences.value.lineHeight = height;
  }

  function setPadding(padding: number): void {
    preferences.value.padding = padding;
  }

  function reset(): void {
    preferences.value = { ...DEFAULT_PREFERENCES };
  }

  return {
    preferences,
    setTheme,
    setFontSize,
    setFontFamily,
    setLineHeight,
    setPadding,
    reset,
  };
});
