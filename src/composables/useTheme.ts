import { computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';

export function useTheme() {
  const settingsStore = useSettingsStore();

  const themeClasses = computed(() => {
    const { theme } = settingsStore.preferences;
    
    switch (theme) {
      case 'dark':
        return {
          bg: 'bg-gray-900',
          text: 'text-gray-100',
          prose: 'prose-invert',
        };
      case 'sepia':
        return {
          bg: 'bg-[#f4ecd8]',
          text: 'text-[#5b4636]',
          prose: 'prose-sepia',
        };
      case 'warm':
        return {
          bg: 'bg-[#faf9f6]',
          text: 'text-[#333333]',
          prose: '',
        };
      default:
        return {
          bg: 'bg-white',
          text: 'text-gray-900',
          prose: '',
        };
    }
  });

  const themeLabel = computed(() => {
    const { theme } = settingsStore.preferences;
    const labels = {
      light: 'Light',
      dark: 'Dark',
      sepia: 'Sepia',
      warm: 'Warm',
    };
    return labels[theme];
  });

  function cycleTheme(): void {
    const themes: Array<'light' | 'dark' | 'sepia' | 'warm'> = ['light', 'dark', 'sepia', 'warm'];
    const currentIndex = themes.indexOf(settingsStore.preferences.theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    settingsStore.setTheme(themes[nextIndex]);
  }

  return {
    themeClasses,
    themeLabel,
    cycleTheme,
  };
}
