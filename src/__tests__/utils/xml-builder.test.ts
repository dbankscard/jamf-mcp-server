import { describe, expect, test } from '@jest/globals';
import { escapeXml, XmlBuilder, xmlDocument } from '../../utils/xml-builder.js';

describe('escapeXml', () => {
  test('should escape ampersand', () => {
    expect(escapeXml('AT&T')).toBe('AT&amp;T');
  });

  test('should escape less-than', () => {
    expect(escapeXml('a < b')).toBe('a &lt; b');
  });

  test('should escape greater-than', () => {
    expect(escapeXml('a > b')).toBe('a &gt; b');
  });

  test('should escape double quotes', () => {
    expect(escapeXml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  test('should escape single quotes (apostrophes)', () => {
    expect(escapeXml("it's")).toBe('it&apos;s');
  });

  test('should escape all special characters in one string', () => {
    expect(escapeXml('<tag attr="val" & \'x\'>')).toBe(
      '&lt;tag attr=&quot;val&quot; &amp; &apos;x&apos;&gt;'
    );
  });

  test('should double-escape already escaped strings', () => {
    expect(escapeXml('&amp;')).toBe('&amp;amp;');
    expect(escapeXml('&lt;')).toBe('&amp;lt;');
  });

  test('should return empty string unchanged', () => {
    expect(escapeXml('')).toBe('');
  });

  test('should return plain text unchanged', () => {
    expect(escapeXml('Hello World 123')).toBe('Hello World 123');
  });
});

describe('XmlBuilder', () => {
  describe('element', () => {
    test('should create a basic element with string content', () => {
      const xml = new XmlBuilder().element('name', 'MacBook Pro').build();
      expect(xml).toBe('<name>MacBook Pro</name>\n');
    });

    test('should auto-escape string content', () => {
      const xml = new XmlBuilder().element('query', 'a < b & c > d').build();
      expect(xml).toBe('<query>a &lt; b &amp; c &gt; d</query>\n');
    });

    test('should handle boolean true', () => {
      const xml = new XmlBuilder().element('enabled', true).build();
      expect(xml).toBe('<enabled>true</enabled>\n');
    });

    test('should handle boolean false', () => {
      const xml = new XmlBuilder().element('enabled', false).build();
      expect(xml).toBe('<enabled>false</enabled>\n');
    });

    test('should handle numeric values', () => {
      const xml = new XmlBuilder().element('count', 42).build();
      expect(xml).toBe('<count>42</count>\n');
    });

    test('should handle zero', () => {
      const xml = new XmlBuilder().element('count', 0).build();
      expect(xml).toBe('<count>0</count>\n');
    });

    test('should handle negative numbers', () => {
      const xml = new XmlBuilder().element('offset', -1).build();
      expect(xml).toBe('<offset>-1</offset>\n');
    });

    test('should support method chaining', () => {
      const xml = new XmlBuilder()
        .element('first', 'a')
        .element('second', 'b')
        .build();
      expect(xml).toBe('<first>a</first>\n<second>b</second>\n');
    });
  });

  describe('optionalElement', () => {
    test('should emit element when value is a string', () => {
      const xml = new XmlBuilder().optionalElement('name', 'test').build();
      expect(xml).toBe('<name>test</name>\n');
    });

    test('should skip when value is null', () => {
      const xml = new XmlBuilder().optionalElement('name', null).build();
      expect(xml).toBe('');
    });

    test('should skip when value is undefined', () => {
      const xml = new XmlBuilder().optionalElement('name', undefined).build();
      expect(xml).toBe('');
    });

    test('should emit zero (not skip it)', () => {
      const xml = new XmlBuilder().optionalElement('count', 0).build();
      expect(xml).toBe('<count>0</count>\n');
    });

    test('should emit false (not skip it)', () => {
      const xml = new XmlBuilder().optionalElement('enabled', false).build();
      expect(xml).toBe('<enabled>false</enabled>\n');
    });

    test('should emit empty string (not skip it)', () => {
      const xml = new XmlBuilder().optionalElement('name', '').build();
      expect(xml).toBe('<name></name>\n');
    });
  });

  describe('optionalStringElement', () => {
    test('should emit element for non-empty string', () => {
      const xml = new XmlBuilder().optionalStringElement('name', 'hello').build();
      expect(xml).toBe('<name>hello</name>\n');
    });

    test('should skip null', () => {
      const xml = new XmlBuilder().optionalStringElement('name', null).build();
      expect(xml).toBe('');
    });

    test('should skip undefined', () => {
      const xml = new XmlBuilder().optionalStringElement('name', undefined).build();
      expect(xml).toBe('');
    });

    test('should skip empty string', () => {
      const xml = new XmlBuilder().optionalStringElement('name', '').build();
      expect(xml).toBe('');
    });
  });

  describe('open / close', () => {
    test('should create parent element with open and close', () => {
      const xml = new XmlBuilder()
        .open('parent')
        .close('parent')
        .build();
      expect(xml).toBe('<parent>\n</parent>\n');
    });

    test('should indent nested elements', () => {
      const xml = new XmlBuilder()
        .open('parent')
        .element('child', 'value')
        .close('parent')
        .build();
      expect(xml).toBe('<parent>\n  <child>value</child>\n</parent>\n');
    });

    test('should handle multiple levels of nesting', () => {
      const xml = new XmlBuilder()
        .open('root')
        .open('level1')
        .element('level2', 'deep')
        .close('level1')
        .close('root')
        .build();
      expect(xml).toBe(
        '<root>\n' +
        '  <level1>\n' +
        '    <level2>deep</level2>\n' +
        '  </level1>\n' +
        '</root>\n'
      );
    });

    test('should handle siblings within a parent', () => {
      const xml = new XmlBuilder()
        .open('parent')
        .element('a', '1')
        .element('b', '2')
        .close('parent')
        .build();
      expect(xml).toBe(
        '<parent>\n' +
        '  <a>1</a>\n' +
        '  <b>2</b>\n' +
        '</parent>\n'
      );
    });

    test('should respect initial indent level', () => {
      const xml = new XmlBuilder(2)
        .element('nested', 'value')
        .build();
      expect(xml).toBe('    <nested>value</nested>\n');
    });
  });

  describe('raw', () => {
    test('should pass through content without escaping', () => {
      const xml = new XmlBuilder().raw('<custom>&raw</custom>').build();
      expect(xml).toBe('<custom>&raw</custom>');
    });

    test('should not add newlines or indentation', () => {
      const xml = new XmlBuilder()
        .open('parent')
        .raw('<!-- comment -->')
        .close('parent')
        .build();
      expect(xml).toBe('<parent>\n<!-- comment --></parent>\n');
    });
  });

  describe('append', () => {
    test('should append another builder output', () => {
      const inner = new XmlBuilder(1)
        .element('inner', 'data');
      const xml = new XmlBuilder()
        .open('outer')
        .append(inner)
        .close('outer')
        .build();
      expect(xml).toBe(
        '<outer>\n' +
        '  <inner>data</inner>\n' +
        '</outer>\n'
      );
    });
  });
});

describe('xmlDocument', () => {
  test('should create XML declaration and open root tag', () => {
    const xml = xmlDocument('policy').close('policy').build();
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<policy>\n' +
      '</policy>\n'
    );
  });

  test('should have proper indentation for children', () => {
    const xml = xmlDocument('computer')
      .element('name', 'Test Mac')
      .close('computer')
      .build();
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<computer>\n' +
      '  <name>Test Mac</name>\n' +
      '</computer>\n'
    );
  });
});

describe('End-to-end', () => {
  test('should build a realistic Jamf policy XML document', () => {
    const xml = xmlDocument('policy')
      .open('general')
      .element('name', 'Install Chrome & Firefox')
      .element('enabled', true)
      .element('frequency', 'Once per computer')
      .optionalElement('category', 'Browsers')
      .optionalElement('notes', null)
      .close('general')
      .open('scope')
      .element('all_computers', true)
      .close('scope')
      .close('policy')
      .build();

    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<policy>\n' +
      '  <general>\n' +
      '    <name>Install Chrome &amp; Firefox</name>\n' +
      '    <enabled>true</enabled>\n' +
      '    <frequency>Once per computer</frequency>\n' +
      '    <category>Browsers</category>\n' +
      '  </general>\n' +
      '  <scope>\n' +
      '    <all_computers>true</all_computers>\n' +
      '  </scope>\n' +
      '</policy>\n'
    );
  });

  test('should build a document with mixed optional elements', () => {
    const xml = xmlDocument('computer')
      .element('id', 123)
      .element('name', 'Lab Mac <#5>')
      .optionalElement('asset_tag', 'ASSET-001')
      .optionalStringElement('building', '')
      .optionalStringElement('department', 'Engineering')
      .optionalElement('room', undefined)
      .close('computer')
      .build();

    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<computer>\n' +
      '  <id>123</id>\n' +
      '  <name>Lab Mac &lt;#5&gt;</name>\n' +
      '  <asset_tag>ASSET-001</asset_tag>\n' +
      '  <department>Engineering</department>\n' +
      '</computer>\n'
    );
  });
});
