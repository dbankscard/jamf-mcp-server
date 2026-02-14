/**
 * Lightweight XML builder utility for constructing Jamf Classic API XML payloads.
 * Handles escaping automatically — no external dependencies.
 */

export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class XmlBuilder {
  private parts: string[] = [];
  private indentLevel: number;

  constructor(indentLevel = 0) {
    this.indentLevel = indentLevel;
  }

  private indent(): string {
    return '  '.repeat(this.indentLevel);
  }

  /** Add a raw string (no escaping). */
  raw(content: string): this {
    this.parts.push(content);
    return this;
  }

  /** Add an element with escaped text content. */
  element(tag: string, content: string | number | boolean): this {
    const value = typeof content === 'string' ? escapeXml(content) : String(content);
    this.parts.push(`${this.indent()}<${tag}>${value}</${tag}>\n`);
    return this;
  }

  /** Add an element only if the value is not null/undefined. For booleans, also emits when false. */
  optionalElement(tag: string, content: string | number | boolean | null | undefined): this {
    if (content === null || content === undefined) return this;
    return this.element(tag, content);
  }

  /** Add an element only if the string value is truthy (non-empty). */
  optionalStringElement(tag: string, content: string | null | undefined): this {
    if (!content) return this;
    return this.element(tag, content);
  }

  /** Open a parent element and increase indent. */
  open(tag: string): this {
    this.parts.push(`${this.indent()}<${tag}>\n`);
    this.indentLevel++;
    return this;
  }

  /** Close a parent element and decrease indent. */
  close(tag: string): this {
    this.indentLevel--;
    this.parts.push(`${this.indent()}</${tag}>\n`);
    return this;
  }

  /** Add a nested builder's output at the current indent level. */
  append(builder: XmlBuilder): this {
    this.parts.push(builder.build());
    return this;
  }

  /** Build the final XML string. */
  build(): string {
    return this.parts.join('');
  }
}

/** Create a new XmlBuilder starting with the XML declaration and a root element. */
export function xmlDocument(rootTag: string): XmlBuilder {
  return new XmlBuilder()
    .raw('<?xml version="1.0" encoding="UTF-8"?>\n')
    .open(rootTag);
}
