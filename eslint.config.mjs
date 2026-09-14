import js from "@eslint/js";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

export default [
  {
    // domain-rules/ holds the vendored, byte-identical domain-rule spec JSON
    // (see domain-rules/README.md in compliance_cmis); it is data consumed by
    // the conformance tests, not lintable JavaScript.
    ignores: ["node_modules/", "dist/", ".git/", "coverage/", "*.lock.json", "package-lock.json", "package.json", "src/i18n/locales/*.json", "domain-rules/"]
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser
    },
    rules: {
      ...js.configs.recommended.rules
    }
  },
  {
    files: ["**/*.{mjs,js}"],
    ignores: ["src/**/*.js", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node
    },
    rules: {
      ...js.configs.recommended.rules
    }
  },
  {
    files: ["server/**/*.cjs", "scripts/**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.commonjs,
      }
    },
    rules: {
      ...js.configs.recommended.rules
    }
  },
  {
    files: ["tests/**/*.{js,cjs,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.vitest,
      }
    },
    rules: {
      ...js.configs.recommended.rules
    }
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parser: vueParser
    },
    plugins: {
      vue: pluginVue
    },
    rules: {
      ...pluginVue.configs["essential"].rules,
      "vue/multi-word-component-names": "warn"
    }
  }
];
