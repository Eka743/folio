/**
 * Small, bounded XML reader for Office OOXML metadata and content.
 *
 * This intentionally supports the XML subset needed by Folio instead of
 * delegating hostile document input to a browser or server XML stack. DTDs,
 * entities, external identifiers and overly deep/large trees are rejected
 * before any content is interpreted. It never resolves external resources.
 */

export interface SafeXmlElement {
  name: string;
  localName: string;
  attributes: Record<string, string>;
  children: SafeXmlElement[];
  text: string;
}

const MAX_XML_BYTES = 16 * 1024 * 1024;
const MAX_XML_NODES = 250_000;
const MAX_XML_DEPTH = 128;

function decodeEntities(value: string): string {
  if (/&(?!#x[0-9a-f]+;|#\d+;|amp;|lt;|gt;|quot;|apos;)/i.test(value)) {
    throw new Error("XML contains an undeclared entity.");
  }
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    const codePoint = lower.startsWith("#x")
      ? Number.parseInt(lower.slice(2), 16)
      : Number.parseInt(lower.slice(1), 10);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      throw new Error("XML contains an invalid character reference.");
    }
    return String.fromCodePoint(codePoint);
  }).replace(/&[^;\s]{1,80};/g, () => {
    throw new Error("XML contains an undeclared entity.");
  });
}

function localName(name: string): string {
  const separator = name.indexOf(":");
  return separator >= 0 ? name.slice(separator + 1) : name;
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  let index = 0;
  while (index < source.length) {
    while (/\s/.test(source[index] ?? "")) index++;
    if (index >= source.length) break;
    const nameMatch = /^[A-Za-z_][A-Za-z0-9_.:-]*/.exec(source.slice(index));
    if (!nameMatch) throw new Error("XML attribute name is malformed.");
    const name = nameMatch[0];
    index += name.length;
    while (/\s/.test(source[index] ?? "")) index++;
    if (source[index] !== "=") throw new Error("XML attribute is missing its value.");
    index++;
    while (/\s/.test(source[index] ?? "")) index++;
    const quote = source[index];
    if (quote !== '"' && quote !== "'") throw new Error("XML attribute value is not quoted.");
    index++;
    const end = source.indexOf(quote, index);
    if (end < 0) throw new Error("XML attribute value is truncated.");
    if (name in attributes) throw new Error(`XML attribute is duplicated: ${name}.`);
    attributes[name] = decodeEntities(source.slice(index, end));
    index = end + 1;
  }
  return attributes;
}

function elementText(element: SafeXmlElement): string {
  return element.text + element.children.map(elementText).join("");
}

function rejectDangerousXml(source: string): void {
  if (/<!DOCTYPE|<!ENTITY|\b(?:SYSTEM|PUBLIC)\b|\[\s*<!/i.test(source)) {
    throw new Error("XML external entities and DTDs are not supported.");
  }
}

/** Parse bounded XML without resolving DTDs, entities or external URLs. */
export function parseSafeXml(source: string): SafeXmlElement {
  if (source.length > MAX_XML_BYTES) throw new Error("XML content exceeds Folio’s safety limit.");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(source)) throw new Error("XML contains forbidden control characters.");
  rejectDangerousXml(source);

  const roots: SafeXmlElement[] = [];
  const stack: SafeXmlElement[] = [];
  let nodes = 0;
  let cursor = 0;
  let textStart = 0;

  const appendText = (raw: string) => {
    if (!raw || stack.length === 0) return;
    stack[stack.length - 1].text += decodeEntities(raw);
  };

  while (cursor < source.length) {
    const open = source.indexOf("<", cursor);
    if (open < 0) {
      appendText(source.slice(cursor));
      cursor = source.length;
      break;
    }
    appendText(source.slice(textStart, open));

    if (source.startsWith("<!--", open)) {
      const end = source.indexOf("-->", open + 4);
      if (end < 0) throw new Error("XML comment is truncated.");
      cursor = end + 3;
      textStart = cursor;
      continue;
    }
    if (source.startsWith("<![CDATA[", open)) {
      const end = source.indexOf("]]>", open + 9);
      if (end < 0) throw new Error("XML CDATA section is truncated.");
      appendText(source.slice(open + 9, end));
      cursor = end + 3;
      textStart = cursor;
      continue;
    }
    if (source.startsWith("<?", open)) {
      const end = source.indexOf("?>", open + 2);
      if (end < 0) throw new Error("XML processing instruction is truncated.");
      cursor = end + 2;
      textStart = cursor;
      continue;
    }

    const end = source.indexOf(">", open + 1);
    if (end < 0) throw new Error("XML tag is truncated.");
    const rawTag = source.slice(open + 1, end).trim();
    if (!rawTag || rawTag.startsWith("!")) throw new Error("XML declaration is unsupported.");
    if (rawTag.startsWith("/")) {
      const name = rawTag.slice(1).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(name)) throw new Error("XML closing tag is malformed.");
      const current = stack.pop();
      if (!current || current.name !== name) throw new Error("XML closing tag does not match its opening tag.");
    } else {
      const selfClosing = /\/\s*$/.test(rawTag);
      const body = selfClosing ? rawTag.replace(/\/\s*$/, "").trim() : rawTag;
      const nameMatch = /^[A-Za-z_][A-Za-z0-9_.:-]*/.exec(body);
      if (!nameMatch) throw new Error("XML element name is malformed.");
      const name = nameMatch[0];
      const element: SafeXmlElement = {
        name,
        localName: localName(name),
        attributes: parseAttributes(body.slice(name.length)),
        children: [],
        text: "",
      };
      nodes++;
      if (nodes > MAX_XML_NODES) throw new Error("XML contains too many elements.");
      if (stack.length >= MAX_XML_DEPTH) throw new Error("XML nesting is too deep.");
      if (stack.length > 0) stack[stack.length - 1].children.push(element);
      else roots.push(element);
      if (!selfClosing) stack.push(element);
    }
    cursor = end + 1;
    textStart = cursor;
  }
  if (stack.length > 0 || roots.length !== 1) throw new Error("XML document is incomplete.");
  return roots[0];
}

export function xmlChildren(element: SafeXmlElement | undefined, name: string): SafeXmlElement[] {
  return element?.children.filter((child) => child.localName === name) ?? [];
}

export function xmlChild(element: SafeXmlElement | undefined, name: string): SafeXmlElement | undefined {
  return element?.children.find((child) => child.localName === name);
}

export function xmlDescendants(element: SafeXmlElement | undefined, name: string): SafeXmlElement[] {
  if (!element) return [];
  const found: SafeXmlElement[] = [];
  for (const child of element.children) {
    if (child.localName === name) found.push(child);
    found.push(...xmlDescendants(child, name));
  }
  return found;
}

export function xmlAttr(element: SafeXmlElement | undefined, name: string): string | undefined {
  if (!element) return undefined;
  if (element.attributes[name] !== undefined) return element.attributes[name];
  const local = localName(name);
  const match = Object.entries(element.attributes).find(([key]) => localName(key) === local);
  return match?.[1];
}

export function xmlText(element: SafeXmlElement | undefined): string {
  return element ? elementText(element) : "";
}
