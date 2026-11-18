import { createFileRoute } from "@tanstack/react-router";
import { ScreeningDesk } from "@/components/screening-desk";
import { getQuotes } from "@/lib/quotes";

export const Route = createFileRoute("/")({
  loader: () => getQuotes(),
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  return <ScreeningDesk initial={initial} />;
}
