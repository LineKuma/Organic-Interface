import { describe, it, expect } from 'vitest';
import { Table, type TableColumn, renderTable } from '../../components/Table.js';

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

    it('should render empty table', () => {
      const columns: TableColumn<Person>[] = [
        { key: 'name', header: 'Name' },
      ];
      const table = new Table<Person>(columns);
      const output = table.render();
      expect(output).toContain('No data');
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

  describe('setRows', () => {
    it('should replace all rows', () => {
      const columns: TableColumn<Person>[] = [
        { key: 'name', header: 'Name' },
      ];
      const table = new Table<Person>(columns);
      table.addRow({ name: 'John' });
      table.addRow({ name: 'Jane' });
      table.setRows([{ name: 'Bob' }]);
      expect(table.rowCount).toBe(1);
      expect(table.render()).toContain('Bob');
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

    it('should sort in descending order', () => {
      const columns: TableColumn<Person>[] = [
        { key: 'name', header: 'Name' },
      ];
      const table = new Table<Person>(columns);
      table.addRow({ name: 'Alice' });
      table.addRow({ name: 'Bob' });

      table.sort('name', 'desc');
      expect(table.rowCount).toBe(2);
    });
  });

  describe('filter', () => {
    it('should filter rows based on predicate', () => {
      const columns: TableColumn<Person>[] = [
        { key: 'name', header: 'Name' },
        { key: 'age', header: 'Age' },
      ];
      const table = new Table<Person>(columns);
      table.addRow({ name: 'John', age: '30' });
      table.addRow({ name: 'Jane', age: '25' });
      table.addRow({ name: 'Bob', age: '35' });

      table.filter(row => row.age !== undefined && parseInt(row.age) > 25);
      expect(table.rowCount).toBe(2);
    });
  });

  describe('getSortConfig', () => {
    it('should return sort config after sorting', () => {
      const columns: TableColumn<Person>[] = [
        { key: 'name', header: 'Name' },
      ];
      const table = new Table<Person>(columns);
      table.addRow({ name: 'Bob' });
      table.sort('name', 'asc');

      const config = table.getSortConfig();
      expect(config).toBeDefined();
      expect(config?.column).toBe('name');
      expect(config?.direction).toBe('asc');
    });

    it('should return undefined when not sorted', () => {
      const columns: TableColumn<Person>[] = [
        { key: 'name', header: 'Name' },
      ];
      const table = new Table<Person>(columns);
      table.addRow({ name: 'Bob' });

      const config = table.getSortConfig();
      expect(config).toBeUndefined();
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

  describe('border rendering', () => {
    it('should render border when enabled', () => {
      const columns: TableColumn<Person>[] = [
        { key: 'name', header: 'Name' },
      ];
      const table = new Table<Person>(columns, { border: true, borderStyle: 'single' });
      table.addRow({ name: 'John' });

      const output = table.render();
      expect(output).toContain('+');
      expect(output).toContain('-');
    });

    it('should render without border when disabled', () => {
      const columns: TableColumn<Person>[] = [
        { key: 'name', header: 'Name' },
      ];
      const table = new Table<Person>(columns, { border: false });
      table.addRow({ name: 'John' });

      const output = table.render();
      expect(output).not.toContain('+');
    });
  });

  describe('columnKeyToString', () => {
    it('should convert column key to string', () => {
      const columns: TableColumn<Person>[] = [
        { key: 'name', header: 'Name' },
        { key: 'age', header: 'Age', format: (val) => String(val) },
      ];
      const table = new Table<Person>(columns);
      table.addRow({ name: 'John', age: '30' });

      const output = table.render();
      expect(output).toContain('John');
    });
  });

  describe('renderTable', () => {
    it('should render table using shortcut function', () => {
      const data = [
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
      ];
      const output = renderTable(data, ['name', 'age']);
      expect(output).toContain('John');
      expect(output).toContain('Age');
    });
  });
});
