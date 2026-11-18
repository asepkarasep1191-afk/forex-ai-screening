import { createServerFn } from "@tanstack/react-start";
import { fetchQuoteBook } from "@/lib/yahoo-quotes";

export const getQuotes = createServerFn({ method: "GET" }).handler(async () => {
  return fetchQuoteBook();
});
