// Локальный календарный день пользователя в формате YYYY-MM-DD — то, что
// recordAnswer принимает как clientDay для честного стрика (день считается по
// часовому поясу клиента, а не по UTC сервера). Локаль en-CA даёт ровно
// YYYY-MM-DD; дата форматируется в ЛОКАЛЬНОЙ таймзоне.
export function localDay(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA");
}
