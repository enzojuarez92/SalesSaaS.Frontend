import type { Config } from "tailwindcss";

export default {
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#EC4899", dark: "#E11D48", neon: "#FF007A" },
      },
    },
  },
} satisfies Config;
