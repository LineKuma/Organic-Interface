import { describe, it, expect } from 'vitest';
import { LanguageRegistry } from '../LanguageRegistry.js';
import { SupportedLanguage } from '../types.js';

describe('LanguageRegistry', () => {
  describe('detect', () => {
    it('should detect TypeScript files', () => {
      expect(LanguageRegistry.detect('file.ts')).toBe(SupportedLanguage.TYPESCRIPT);
      expect(LanguageRegistry.detect('file.tsx')).toBe(SupportedLanguage.TYPESCRIPT);
      expect(LanguageRegistry.detect('file.mts')).toBe(SupportedLanguage.TYPESCRIPT);
      expect(LanguageRegistry.detect('file.cts')).toBe(SupportedLanguage.TYPESCRIPT);
    });

    it('should detect JavaScript files', () => {
      expect(LanguageRegistry.detect('file.js')).toBe(SupportedLanguage.JAVASCRIPT);
      expect(LanguageRegistry.detect('file.jsx')).toBe(SupportedLanguage.JAVASCRIPT);
      expect(LanguageRegistry.detect('file.mjs')).toBe(SupportedLanguage.JAVASCRIPT);
      expect(LanguageRegistry.detect('file.cjs')).toBe(SupportedLanguage.JAVASCRIPT);
    });

    it('should detect Python files', () => {
      expect(LanguageRegistry.detect('file.py')).toBe(SupportedLanguage.PYTHON);
      expect(LanguageRegistry.detect('file.pyi')).toBe(SupportedLanguage.PYTHON);
      expect(LanguageRegistry.detect('file.pyx')).toBe(SupportedLanguage.PYTHON);
    });

    it('should detect Java files', () => {
      expect(LanguageRegistry.detect('file.java')).toBe(SupportedLanguage.JAVA);
    });

    it('should detect Go files', () => {
      expect(LanguageRegistry.detect('file.go')).toBe(SupportedLanguage.GO);
    });

    it('should detect Rust files', () => {
      expect(LanguageRegistry.detect('file.rs')).toBe(SupportedLanguage.RUST);
    });

    it('should detect C/C++ files', () => {
      expect(LanguageRegistry.detect('file.cpp')).toBe(SupportedLanguage.CPP);
      expect(LanguageRegistry.detect('file.cc')).toBe(SupportedLanguage.CPP);
      expect(LanguageRegistry.detect('file.cxx')).toBe(SupportedLanguage.CPP);
      expect(LanguageRegistry.detect('file.c')).toBe(SupportedLanguage.CPP);
      expect(LanguageRegistry.detect('file.h')).toBe(SupportedLanguage.CPP);
      expect(LanguageRegistry.detect('file.hpp')).toBe(SupportedLanguage.CPP);
    });

    it('should detect C# files', () => {
      expect(LanguageRegistry.detect('file.cs')).toBe(SupportedLanguage.CSHARP);
    });

    it('should detect Ruby files', () => {
      expect(LanguageRegistry.detect('file.rb')).toBe(SupportedLanguage.RUBY);
    });

    it('should detect PHP files', () => {
      expect(LanguageRegistry.detect('file.php')).toBe(SupportedLanguage.PHP);
    });

    it('should detect Swift files', () => {
      expect(LanguageRegistry.detect('file.swift')).toBe(SupportedLanguage.SWIFT);
    });

    it('should detect Kotlin files', () => {
      expect(LanguageRegistry.detect('file.kt')).toBe(SupportedLanguage.KOTLIN);
      expect(LanguageRegistry.detect('file.kts')).toBe(SupportedLanguage.KOTLIN);
    });

    it('should detect SQL files', () => {
      expect(LanguageRegistry.detect('file.sql')).toBe(SupportedLanguage.SQL);
    });

    it('should detect YAML files', () => {
      expect(LanguageRegistry.detect('file.yaml')).toBe(SupportedLanguage.YAML);
      expect(LanguageRegistry.detect('file.yml')).toBe(SupportedLanguage.YAML);
    });

    it('should detect JSON files', () => {
      expect(LanguageRegistry.detect('file.json')).toBe(SupportedLanguage.JSON);
      expect(LanguageRegistry.detect('file.jsonc')).toBe(SupportedLanguage.JSON);
    });

    it('should detect Markdown files', () => {
      expect(LanguageRegistry.detect('file.md')).toBe(SupportedLanguage.MARKDOWN);
      expect(LanguageRegistry.detect('file.mdx')).toBe(SupportedLanguage.MARKDOWN);
      expect(LanguageRegistry.detect('file.markdown')).toBe(SupportedLanguage.MARKDOWN);
    });

    it('should return UNKNOWN for unrecognized extensions', () => {
      expect(LanguageRegistry.detect('file.xyz')).toBe(SupportedLanguage.UNKNOWN);
      expect(LanguageRegistry.detect('file')).toBe(SupportedLanguage.UNKNOWN);
      expect(LanguageRegistry.detect('file.bin')).toBe(SupportedLanguage.UNKNOWN);
    });

    it('should be case insensitive', () => {
      expect(LanguageRegistry.detect('FILE.TS')).toBe(SupportedLanguage.TYPESCRIPT);
      expect(LanguageRegistry.detect('File.PY')).toBe(SupportedLanguage.PYTHON);
      expect(LanguageRegistry.detect('File.Java')).toBe(SupportedLanguage.JAVA);
    });

    it('should handle paths with multiple dots', () => {
      expect(LanguageRegistry.detect('file.test.ts')).toBe(SupportedLanguage.TYPESCRIPT);
      expect(LanguageRegistry.detect('file.spec.js')).toBe(SupportedLanguage.JAVASCRIPT);
      expect(LanguageRegistry.detect('file.min.js')).toBe(SupportedLanguage.JAVASCRIPT);
    });
  });

  describe('getConfig', () => {
    it('should return config for TypeScript', () => {
      const config = LanguageRegistry.getConfig(SupportedLanguage.TYPESCRIPT);
      expect(config).toBeDefined();
      expect(config.extensions).toContain('.ts');
      expect(config.commentPatterns.single).toBe('//');
      expect(config.commentPatterns.multi).toEqual(['/*', '*/']);
      expect(config.keywords.length).toBeGreaterThan(0);
      expect(config.operators.length).toBeGreaterThan(0);
    });

    it('should return config for Python', () => {
      const config = LanguageRegistry.getConfig(SupportedLanguage.PYTHON);
      expect(config).toBeDefined();
      expect(config.extensions).toContain('.py');
      expect(config.commentPatterns.single).toBe('#');
      expect(config.keywords).toContain('def');
      expect(config.keywords).toContain('class');
    });

    it('should return config for Java', () => {
      const config = LanguageRegistry.getConfig(SupportedLanguage.JAVA);
      expect(config).toBeDefined();
      expect(config.extensions).toContain('.java');
      expect(config.keywords).toContain('class');
      expect(config.keywords).toContain('public');
    });

    it('should return config for Go', () => {
      const config = LanguageRegistry.getConfig(SupportedLanguage.GO);
      expect(config).toBeDefined();
      expect(config.extensions).toContain('.go');
      expect(config.keywords).toContain('func');
      expect(config.keywords).toContain('package');
    });

    it('should return config for all non-unknown languages', () => {
      const languages = LanguageRegistry.getSupportedLanguages();
      for (const lang of languages) {
        const config = LanguageRegistry.getConfig(lang);
        expect(config).toBeDefined();
        expect(config.keywords).toBeDefined();
        expect(config.operators).toBeDefined();
      }
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return all supported languages except UNKNOWN', () => {
      const languages = LanguageRegistry.getSupportedLanguages();
      expect(languages).not.toContain(SupportedLanguage.UNKNOWN);
      expect(languages.length).toBeGreaterThan(10);
      expect(languages).toContain(SupportedLanguage.TYPESCRIPT);
      expect(languages).toContain(SupportedLanguage.PYTHON);
      expect(languages).toContain(SupportedLanguage.JAVA);
      expect(languages).toContain(SupportedLanguage.GO);
    });
  });

  describe('getSupportedExtensions', () => {
    it('should return all supported extensions', () => {
      const extensions = LanguageRegistry.getSupportedExtensions();
      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.js');
      expect(extensions).toContain('.py');
      expect(extensions).toContain('.java');
      expect(extensions).toContain('.go');
    });
  });

  describe('isExtensionSupported', () => {
    it('should return true for supported extensions', () => {
      expect(LanguageRegistry.isExtensionSupported('.ts')).toBe(true);
      expect(LanguageRegistry.isExtensionSupported('.js')).toBe(true);
      expect(LanguageRegistry.isExtensionSupported('.py')).toBe(true);
    });

    it('should return false for unsupported extensions', () => {
      expect(LanguageRegistry.isExtensionSupported('.xyz')).toBe(false);
      expect(LanguageRegistry.isExtensionSupported('')).toBe(false);
    });
  });
});
