import { describe, it, expect, vi } from 'vitest';
import { FileParser } from '../FileParser.js';
import { SupportedLanguage, SymbolKind } from '../types.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('FileParser', () => {
  let parser: FileParser;

  beforeEach(() => {
    parser = new FileParser();
  });

  describe('parseContent', () => {
    it('should parse TypeScript content', () => {
      const tsCode = `
import { foo } from './bar';
import type { Baz } from './baz';

export interface User {
  id: number;
  name: string;
}

export type UserId = string;

export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export const MAX_USERS = 100;

export function createUser(name: string): User {
  return { id: 1, name };
}

export class UserService {
  private users: User[] = [];

  getUser(id: number): User | undefined {
    return this.users.find(u => u.id === id);
  }

  addUser(user: User): void {
    this.users.push(user);
  }
}

const DEFAULT_NAME = 'anonymous';
let counter = 0;
`;

      const result = parser.parseContent(tsCode, SupportedLanguage.TYPESCRIPT, 'test.ts');

      expect(result).toBeDefined();
      expect(result.path).toBe('test.ts');
      expect(result.language).toBe(SupportedLanguage.TYPESCRIPT);
      expect(result.lines).toBeGreaterThan(0);
      expect(result.size).toBeGreaterThan(0);
      expect(result.hash).toBeDefined();
      expect(result.hash.length).toBe(64); // SHA-256 hex

      // Symbols
      expect(result.symbols.length).toBeGreaterThan(0);

      const interfaceSymbol = result.symbols.find(s => s.name === 'User' && s.kind === SymbolKind.INTERFACE);
      expect(interfaceSymbol).toBeDefined();

      const typeSymbol = result.symbols.find(s => s.name === 'UserId' && s.kind === SymbolKind.TYPE);
      expect(typeSymbol).toBeDefined();

      const enumSymbol = result.symbols.find(s => s.name === 'Status' && s.kind === SymbolKind.ENUM);
      expect(enumSymbol).toBeDefined();

      const classSymbol = result.symbols.find(s => s.name === 'UserService' && s.kind === SymbolKind.CLASS);
      expect(classSymbol).toBeDefined();

      const funcSymbol = result.symbols.find(s => s.name === 'createUser' && s.kind === SymbolKind.FUNCTION);
      expect(funcSymbol).toBeDefined();

      // Imports
      expect(result.imports).toContain('./bar');
      expect(result.imports).toContain('./baz');

      // Exports
      expect(result.exports.length).toBeGreaterThan(0);
    });

    it('should parse JavaScript content', () => {
      const jsCode = `
const express = require('express');
const path = require('path');

class Calculator {
  add(a, b) {
    return a + b;
  }

  subtract(a, b) {
    return a - b;
  }
}

function multiply(a, b) {
  return a * b;
}

const PI = 3.14159;

module.exports = { Calculator, multiply, PI };
`;

      const result = parser.parseContent(jsCode, SupportedLanguage.JAVASCRIPT, 'test.js');

      expect(result).toBeDefined();
      expect(result.language).toBe(SupportedLanguage.JAVASCRIPT);

      const classSymbol = result.symbols.find(s => s.name === 'Calculator' && s.kind === SymbolKind.CLASS);
      expect(classSymbol).toBeDefined();

      const funcSymbol = result.symbols.find(s => s.name === 'multiply' && s.kind === SymbolKind.FUNCTION);
      expect(funcSymbol).toBeDefined();

      // require() imports
      expect(result.imports).toContain('express');
      expect(result.imports).toContain('path');
    });

    it('should parse Python content', () => {
      const pyCode = `
import os
import sys
from typing import List, Optional
from dataclasses import dataclass

PI = 3.14159
MAX_RETRIES = 3

@dataclass
class User:
    name: str
    age: int

    def greet(self) -> str:
        return f"Hello, {self.name}"

def calculate_total(items: List[float]) -> float:
    total = 0.0
    for item in items:
        total += item
    return total

def main():
    user = User("Alice", 30)
    print(user.greet())

__all__ = ['User', 'calculate_total', 'PI']
`;

      const result = parser.parseContent(pyCode, SupportedLanguage.PYTHON, 'test.py');

      expect(result).toBeDefined();
      expect(result.language).toBe(SupportedLanguage.PYTHON);

      const classSymbol = result.symbols.find(s => s.name === 'User' && s.kind === SymbolKind.CLASS);
      expect(classSymbol).toBeDefined();

      const funcSymbol = result.symbols.find(s => s.name === 'calculate_total' && s.kind === SymbolKind.FUNCTION);
      expect(funcSymbol).toBeDefined();

      const methodSymbol = result.symbols.find(s => s.name === 'greet' && s.kind === SymbolKind.FUNCTION);
      expect(methodSymbol).toBeDefined();

      // Imports
      expect(result.imports).toContain('os');
      expect(result.imports).toContain('sys');
      expect(result.imports).toContain('typing');
      expect(result.imports).toContain('dataclasses');

      // Exports from __all__
      expect(result.exports).toContain('User');
      expect(result.exports).toContain('calculate_total');
      expect(result.exports).toContain('PI');
    });

    it('should parse Java content', () => {
      const javaCode = `
package com.example.app;

import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;

public class UserService {
    private List<User> users;

    public UserService() {
        this.users = new ArrayList<>();
    }

    public void addUser(User user) {
        users.add(user);
    }

    public User findById(int id) {
        return users.stream()
            .filter(u -> u.getId() == id)
            .findFirst()
            .orElse(null);
    }
}

public interface Repository<T> {
    T findById(int id);
    void save(T entity);
    void delete(int id);
}

public enum UserRole {
    ADMIN,
    USER,
    GUEST
}
`;

      const result = parser.parseContent(javaCode, SupportedLanguage.JAVA, 'test.java');

      expect(result).toBeDefined();
      expect(result.language).toBe(SupportedLanguage.JAVA);

      const classSymbol = result.symbols.find(s => s.name === 'UserService' && s.kind === SymbolKind.CLASS);
      expect(classSymbol).toBeDefined();

      const interfaceSymbol = result.symbols.find(s => s.name === 'Repository' && s.kind === SymbolKind.INTERFACE);
      expect(interfaceSymbol).toBeDefined();

      const enumSymbol = result.symbols.find(s => s.name === 'UserRole' && s.kind === SymbolKind.ENUM);
      expect(enumSymbol).toBeDefined();

      // Imports
      expect(result.imports.some(i => i.includes('java.util.List'))).toBe(true);
      expect(result.imports.some(i => i.includes('java.util.ArrayList'))).toBe(true);
    });

    it('should parse Go content', () => {
      const goCode = `
package main

import (
    "fmt"
    "strings"
)

type User struct {
    Name string
    Age  int
}

type Greeter interface {
    Greet() string
}

func (u *User) Greet() string {
    return fmt.Sprintf("Hello, %s", u.Name)
}

func NewUser(name string, age int) *User {
    return &User{Name: name, Age: age}
}

const MaxUsers = 100

var defaultName = "anonymous"
`;

      const result = parser.parseContent(goCode, SupportedLanguage.GO, 'test.go');

      expect(result).toBeDefined();
      expect(result.language).toBe(SupportedLanguage.GO);

      const structSymbol = result.symbols.find(s => s.name === 'User' && s.kind === SymbolKind.CLASS);
      expect(structSymbol).toBeDefined();

      const interfaceSymbol = result.symbols.find(s => s.name === 'Greeter' && s.kind === SymbolKind.INTERFACE);
      expect(interfaceSymbol).toBeDefined();

      const funcSymbol = result.symbols.find(s => s.name === 'NewUser' && s.kind === SymbolKind.FUNCTION);
      expect(funcSymbol).toBeDefined();

      // Imports
      expect(result.imports).toContain('fmt');
      expect(result.imports).toContain('strings');

      // Exports (uppercase)
      expect(result.exports).toContain('User');
      expect(result.exports).toContain('Greeter');
      expect(result.exports).toContain('NewUser');
      expect(result.exports).toContain('MaxUsers');
    });

    it('should handle options - includeSymbols false', () => {
      const code = 'function hello() {} class Foo {}';
      const result = parser.parseContent(code, SupportedLanguage.JAVASCRIPT, 'test.js', {
        includeSymbols: false,
      });

      expect(result.symbols).toHaveLength(0);
    });

    it('should handle options - includeDependencies false', () => {
      const code = "import { foo } from './bar'; export function test() {}";
      const result = parser.parseContent(code, SupportedLanguage.TYPESCRIPT, 'test.ts', {
        includeDependencies: false,
      });

      expect(result.imports).toHaveLength(0);
      expect(result.exports).toHaveLength(0);
    });
  });

  describe('extractSymbols', () => {
    it('should extract symbols from TypeScript', () => {
      const code = `
function hello() {}
class Foo {}
interface Bar {}
type Baz = string;
enum Status { A, B }
const x = 1;
`;
      const symbols = parser.extractSymbols(code, SupportedLanguage.TYPESCRIPT, 'test.ts');

      const kinds = symbols.map(s => s.kind);
      expect(kinds).toContain(SymbolKind.FUNCTION);
      expect(kinds).toContain(SymbolKind.CLASS);
      expect(kinds).toContain(SymbolKind.INTERFACE);
      expect(kinds).toContain(SymbolKind.TYPE);
      expect(kinds).toContain(SymbolKind.ENUM);
    });

    it('should extract symbols from Python', () => {
      const code = `
def foo():
    pass

class Bar:
    def method(self):
        pass
`;
      const symbols = parser.extractSymbols(code, SupportedLanguage.PYTHON, 'test.py');

      const funcSymbol = symbols.find(s => s.name === 'foo');
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol?.kind).toBe(SymbolKind.FUNCTION);

      const classSymbol = symbols.find(s => s.name === 'Bar');
      expect(classSymbol).toBeDefined();
      expect(classSymbol?.kind).toBe(SymbolKind.CLASS);
    });

    it('should extract symbols from Rust', () => {
      const code = `
fn main() {}
struct Point { x: i32, y: i32 }
enum Color { Red, Green, Blue }
trait Drawable {}
type Meters = i32;
mod utils;
const MAX: i32 = 100;
static NAME: &str = "app";
`;
      const symbols = parser.extractSymbols(code, SupportedLanguage.RUST, 'test.rs');

      const kinds = symbols.map(s => s.kind);
      expect(kinds).toContain(SymbolKind.FUNCTION);
      expect(kinds).toContain(SymbolKind.CLASS);
      expect(kinds).toContain(SymbolKind.ENUM);
      expect(kinds).toContain(SymbolKind.INTERFACE);
      expect(kinds).toContain(SymbolKind.TYPE);
      expect(kinds).toContain(SymbolKind.MODULE);
      expect(kinds).toContain(SymbolKind.CONSTANT);
      expect(kinds).toContain(SymbolKind.VARIABLE);
    });

    it('should extract symbols from C++', () => {
      const code = `
class MyClass {};
struct MyStruct {};
enum Color { RED, GREEN, BLUE };
namespace my_namespace {}
void myFunction() {}
`;
      const symbols = parser.extractSymbols(code, SupportedLanguage.CPP, 'test.cpp');

      const kinds = symbols.map(s => s.kind);
      expect(kinds).toContain(SymbolKind.CLASS);
      expect(kinds).toContain(SymbolKind.ENUM);
      expect(kinds).toContain(SymbolKind.MODULE);
    });

    it('should extract symbols from C#', () => {
      const code = `
public class MyClass {}
public interface IMyInterface {}
public enum MyEnum { A, B }
namespace MyApp {}
public void MyMethod() {}
`;
      const symbols = parser.extractSymbols(code, SupportedLanguage.CSHARP, 'test.cs');

      const kinds = symbols.map(s => s.kind);
      expect(kinds).toContain(SymbolKind.CLASS);
      expect(kinds).toContain(SymbolKind.INTERFACE);
      expect(kinds).toContain(SymbolKind.ENUM);
      expect(kinds).toContain(SymbolKind.MODULE);
    });

    it('should handle unknown language gracefully', () => {
      const code = 'some random text';
      const symbols = parser.extractSymbols(code, SupportedLanguage.UNKNOWN, 'test.txt');

      expect(Array.isArray(symbols)).toBe(true);
    });
  });

  describe('extractImports', () => {
    it('should extract imports from TypeScript', () => {
      const code = `
import { foo } from './foo';
import bar from './bar';
import * as baz from './baz';
import type { Qux } from './qux';
const x = require('lodash');
`;
      const imports = parser.extractImports(code, SupportedLanguage.TYPESCRIPT);

      expect(imports).toContain('./foo');
      expect(imports).toContain('./bar');
      expect(imports).toContain('./baz');
      expect(imports).toContain('./qux');
      expect(imports).toContain('lodash');
    });

    it('should extract imports from Python', () => {
      const code = `
import os
import sys
from typing import List
from pathlib import Path
`;
      const imports = parser.extractImports(code, SupportedLanguage.PYTHON);

      expect(imports).toContain('os');
      expect(imports).toContain('sys');
      expect(imports).toContain('typing');
      expect(imports).toContain('pathlib');
    });

    it('should extract imports from Go', () => {
      const code = `
import "fmt"
import (
    "strings"
    "net/http"
)
`;
      const imports = parser.extractImports(code, SupportedLanguage.GO);

      expect(imports).toContain('fmt');
      expect(imports).toContain('strings');
      expect(imports).toContain('net/http');
    });

    it('should extract imports from Rust', () => {
      const code = `
use std::collections::HashMap;
use crate::my_module::MyStruct;
use std::io::{self, Read};
`;
      const imports = parser.extractImports(code, SupportedLanguage.RUST);

      expect(imports).toContain('std::collections::HashMap');
      expect(imports).toContain('crate::my_module::MyStruct');
      expect(imports).toContain('std::io::{self, Read}');
    });

    it('should extract imports from C#', () => {
      const code = `
using System;
using System.Collections.Generic;
using System.Linq;
`;
      const imports = parser.extractImports(code, SupportedLanguage.CSHARP);

      expect(imports).toContain('System');
      expect(imports).toContain('System.Collections.Generic');
      expect(imports).toContain('System.Linq');
    });
  });

  describe('extractExports', () => {
    it('should extract exports from TypeScript', () => {
      const code = `
export function foo() {}
export class Bar {}
export const BAZ = 1;
export type Qux = string;
export interface Quux {}
export { foo as default, bar };
`;
      const exports = parser.extractExports(code, SupportedLanguage.TYPESCRIPT);

      expect(exports).toContain('foo');
      expect(exports).toContain('Bar');
      expect(exports).toContain('BAZ');
      expect(exports).toContain('Qux');
      expect(exports).toContain('Quux');
    });

    it('should extract exports from Go', () => {
      const code = `
func PublicFunc() {}
type PublicType struct {}
var PublicVar int
const PublicConst = 1
func privateFunc() {}
type privateType struct {}
`;
      const exports = parser.extractExports(code, SupportedLanguage.GO);

      expect(exports).toContain('PublicFunc');
      expect(exports).toContain('PublicType');
      expect(exports).toContain('PublicVar');
      expect(exports).toContain('PublicConst');
      expect(exports).not.toContain('privateFunc');
      expect(exports).not.toContain('privateType');
    });

    it('should extract exports from Rust', () => {
      const code = `
pub fn my_func() {}
pub struct MyStruct {}
pub enum MyEnum {}
pub trait MyTrait {}
pub type MyType = i32;
pub const MY_CONST: i32 = 1;
pub static MY_STATIC: &str = "hello";
pub mod my_module {}
`;
      const exports = parser.extractExports(code, SupportedLanguage.RUST);

      expect(exports).toContain('my_func');
      expect(exports).toContain('MyStruct');
      expect(exports).toContain('MyEnum');
      expect(exports).toContain('MyTrait');
      expect(exports).toContain('MyType');
      expect(exports).toContain('MY_CONST');
      expect(exports).toContain('MY_STATIC');
      expect(exports).toContain('my_module');
    });
  });

  describe('computeHash', () => {
    it('should compute consistent hash', () => {
      const hash1 = parser.computeHash('hello world');
      const hash2 = parser.computeHash('hello world');
      expect(hash1).toBe(hash2);
    });

    it('should compute different hash for different content', () => {
      const hash1 = parser.computeHash('hello world');
      const hash2 = parser.computeHash('hello world!');
      expect(hash1).not.toBe(hash2);
    });

    it('should return 64-character hex string', () => {
      const hash = parser.computeHash('test');
      expect(hash.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });
  });

  describe('symbol properties', () => {
    it('should include line and column information', () => {
      const code = 'function hello() {\n  return "world";\n}\n\nclass Foo {}\n';
      const symbols = parser.extractSymbols(code, SupportedLanguage.TYPESCRIPT, 'test.ts');

      for (const symbol of symbols) {
        expect(symbol.name).toBeTruthy();
        expect(symbol.kind).toBeDefined();
        expect(symbol.line).toBeGreaterThan(0);
        expect(symbol.column).toBeGreaterThan(0);
        expect(symbol.endLine).toBeGreaterThanOrEqual(symbol.line);
        expect(symbol.endColumn).toBeGreaterThan(symbol.column);
        expect(symbol.path).toBe('test.ts');
      }
    });
  });

  describe('keywords filtering', () => {
    it('should not extract language keywords as symbols', () => {
      const code = 'if (true) { return; } else { throw new Error(); }';
      const symbols = parser.extractSymbols(code, SupportedLanguage.TYPESCRIPT, 'test.ts');

      const names = symbols.map(s => s.name);
      expect(names).not.toContain('if');
      expect(names).not.toContain('else');
      expect(names).not.toContain('return');
      expect(names).not.toContain('throw');
      expect(names).not.toContain('new');
    });
  });
});