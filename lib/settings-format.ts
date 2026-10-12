/** Подставляет {year} и {name} в шаблон копирайта */
export function renderCopyright(template: string, name: string, year = new Date().getFullYear()): string {
  return template.replace(/\{year\}/g, String(year)).replace(/\{name\}/g, name);
}
