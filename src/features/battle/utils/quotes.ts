export function pickRandomQuote(quotes?: string[], fallback = ''): string {
  if (quotes && quotes.length > 0) {
    const index = Math.floor(Math.random() * quotes.length);
    return quotes[index];
  }
  return fallback;
}
