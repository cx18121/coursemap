// Mock for next/headers in unit test environment
// The real next/headers is only available in Next.js runtime context

const cookieStore = new Map<string, string>();

export async function cookies() {
  return {
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value ? { name, value } : undefined;
    },
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  };
}
