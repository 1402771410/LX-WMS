export const sanitizeReleaseNote = (value: string): string => {
  const decoded = value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  const withoutTags = decoded.replace(/<[^>]*>/g, " ");
  return withoutTags.replace(/\s+/g, " ").trim();
};
