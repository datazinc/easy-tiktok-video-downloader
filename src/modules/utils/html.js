const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const ALLOWED_HTML_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "details",
  "div",
  "em",
  "h2",
  "h3",
  "li",
  "ol",
  "p",
  "section",
  "span",
  "strong",
  "summary",
  "ul",
]);

const ALLOWED_SVG_TAGS = new Set([
  "svg",
  "g",
  "path",
  "line",
  "polyline",
  "polygon",
  "rect",
  "circle",
]);

const VOID_TAGS = new Set(["br"]);
const GLOBAL_ATTRIBUTES = new Set(["class", "id", "role", "style", "title"]);
const LINK_ATTRIBUTES = new Set(["href", "target", "rel"]);
const SVG_ATTRIBUTES = new Set([
  "aria-hidden",
  "cx",
  "cy",
  "d",
  "fill",
  "focusable",
  "height",
  "points",
  "r",
  "rect",
  "rx",
  "stroke",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-width",
  "viewbox",
  "width",
  "x",
  "x1",
  "x2",
  "xmlns",
  "y",
  "y1",
  "y2",
]);

const HTML_ENTITY_MAP = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: "\u00A0",
  quot: '"',
};

function decodeHtmlEntities(value) {
  return String(value ?? "").replace(
    /&(#39|#x27|#x2f|#47|#x3d|#61|[a-z]+);/gi,
    (match, entity) => {
      const normalized = entity.toLowerCase();

      if (normalized.startsWith("#x")) {
        const codePoint = Number.parseInt(normalized.slice(2), 16);
        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : match;
      }

      if (normalized.startsWith("#")) {
        const codePoint = Number.parseInt(normalized.slice(1), 10);
        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : match;
      }

      return HTML_ENTITY_MAP[normalized] ?? match;
    },
  );
}

function isAllowedTag(tagName) {
  return ALLOWED_HTML_TAGS.has(tagName) || ALLOWED_SVG_TAGS.has(tagName);
}

function isSvgTag(tagName) {
  return ALLOWED_SVG_TAGS.has(tagName);
}

function isAllowedAttribute(tagName, attrName) {
  if (attrName.startsWith("on")) {
    return false;
  }

  if (attrName.startsWith("aria-") || attrName.startsWith("data-")) {
    return true;
  }

  if (GLOBAL_ATTRIBUTES.has(attrName)) {
    return true;
  }

  if (tagName === "a" && LINK_ATTRIBUTES.has(attrName)) {
    return true;
  }

  if (isSvgTag(tagName) && SVG_ATTRIBUTES.has(attrName)) {
    return true;
  }

  return false;
}

function isSafeHref(value) {
  if (!value) {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("#") ||
    normalized.startsWith("/") ||
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("mailto:") ||
    normalized.startsWith("tel:")
  );
}

function parseAttributes(rawAttributes) {
  const attributes = [];
  const attrPattern =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match = null;

  while ((match = attrPattern.exec(rawAttributes))) {
    attributes.push({
      name: match[1],
      value: match[2] ?? match[3] ?? match[4] ?? "",
    });
  }

  return attributes;
}

function createElementForTag(tagName, parentNode) {
  const insideSvg = parentNode?.namespaceURI === SVG_NAMESPACE;
  if (insideSvg || isSvgTag(tagName)) {
    return document.createElementNS(SVG_NAMESPACE, tagName);
  }

  return document.createElement(tagName);
}

function normalizeAttributeName(attrName) {
  return attrName.toLowerCase() === "viewbox" ? "viewBox" : attrName;
}

export function createHtmlFragment(html) {
  const fragment = document.createDocumentFragment();
  const nodeStack = [fragment];
  const tagStack = [];
  const tokens = String(html ?? "").match(/<[^>]+>|[^<]+/g) || [];

  for (const token of tokens) {
    if (!token) {
      continue;
    }

    if (token.startsWith("</")) {
      const closeMatch = token.match(/^<\s*\/\s*([a-zA-Z0-9:-]+)/);
      if (!closeMatch) {
        continue;
      }

      const closingTag = closeMatch[1].toLowerCase();
      while (tagStack.length > 0) {
        const lastTag = tagStack.pop();
        nodeStack.pop();
        if (lastTag === closingTag) {
          break;
        }
      }
      continue;
    }

    if (token.startsWith("<")) {
      const openMatch = token.match(/^<\s*([a-zA-Z0-9:-]+)([^>]*)>/);
      if (!openMatch) {
        continue;
      }

      const tagName = openMatch[1].toLowerCase();
      if (!isAllowedTag(tagName)) {
        continue;
      }

      const currentParent = nodeStack[nodeStack.length - 1];
      const element = createElementForTag(tagName, currentParent);
      const rawAttributes = openMatch[2] || "";

      for (const attribute of parseAttributes(rawAttributes)) {
        const attrName = attribute.name.toLowerCase();
        if (!isAllowedAttribute(tagName, attrName)) {
          continue;
        }

        const decodedValue = decodeHtmlEntities(attribute.value);
        if (attrName === "href" && !isSafeHref(decodedValue)) {
          continue;
        }

        element.setAttribute(
          normalizeAttributeName(attribute.name),
          decodedValue,
        );
      }

      currentParent.appendChild(element);

      const selfClosing = VOID_TAGS.has(tagName) || /\/\s*>$/.test(token);
      if (!selfClosing) {
        nodeStack.push(element);
        tagStack.push(tagName);
      }
      continue;
    }

    nodeStack[nodeStack.length - 1].appendChild(
      document.createTextNode(decodeHtmlEntities(token)),
    );
  }

  return fragment;
}

export function replaceElementHtml(element, html) {
  element.replaceChildren(createHtmlFragment(html));
}
