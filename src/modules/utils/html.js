export function createHtmlFragment(html) {
  return document.createRange().createContextualFragment(String(html ?? ""));
}

export function replaceElementHtml(element, html) {
  element.replaceChildren(createHtmlFragment(html));
}