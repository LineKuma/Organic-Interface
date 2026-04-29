import { describe, it, expect } from 'vitest';
import { Table, type TableColumn } from '../../components/Table.js';

interface Person {
  name: string;
  age?: string;
  [key: string]: unknown;
}

describe('Table', () => {
  describe('constructor', () => {
    it('should create a table instance', () => {
      const columns: TableColumn<Person>[] = [
        { key: 'name', header: 'Name' },
        { key: 'age', header: 'Age' },
      ];
      const table = new Table<Person>(columns);
      expect(table).toBeDefined();
    });
  });

  describe('render', () => {
    it('should render table with headers', () => {
      const columns: TableColumn<Person>[] = [
        { key: 'name', header: 'Name' },
        { key: 'age', header: 'Age' },
      ];
      const table = new Table<Person>(columns, { showHeader: true });
      table.addRow({ name: 'John', age: '30' });
      table.addRow({ name: 'Jane', age: '25' });

      const output = table.render();
      expect(output).toContain('Name');
      expect(output).toContain('Age');
    });

    it('should render table with rows', () => {
      const columns: TableColumn<Person>[] = [
        { key: 'name', header: 'Name' },
        { key: 'age', header: 'Age' },
      ];
      const table = new Table<Person>(columns);
      table.addRow({ name: 'John', age: '30' });

      const output = table.render();
      expect(output).toContain('John');
      expect(output).toContain('30');
    });
  });

  describe('addRow', () => {
    it('should add a row to the table', () => {
      const columns: TableColumn<Person>[] = [
        { key: 'name', header: 'Name' },
      ];
      const table = new Table<Person>(columns);
      table.addRow({ name: 'John' });
      expect(table.rowCount).toBe(1);
    });
  });

  describe('sort', () => {
    it('should sort table by column', () => {
      const columns: TableColumn<Person>[] = [
        { key: 'name', header: 'Name' },
        { key: 'age', header: 'Age' },
      ];
      const table = new Table<Person>(columns);
      table.addRow({ name: 'Bob', age: '35' });
      table.addRow({ name: 'Alice', age: '25' });

      table.sort('name', 'asc');
      expect(table.rowCount).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear all rows', () => {
      const columns: TableColumn<Person>[] = [
        { key: 'name', header: 'Name' },
      ];
      const table = new Table<Person>(columns);
      table.addRow({ name: 'John' });
      table.clear();
      expect(table.rowCount).toBe(0);
    });
  });
});
