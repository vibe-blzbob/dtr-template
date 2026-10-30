export {};

declare global {
  interface Window {
    electronAPI?: {
      print: () => Promise<{ success: boolean; error?: string }>;
      printToPDF: () => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>;
    };
  }
}
