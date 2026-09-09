import { redirect } from "next/navigation";

/** Retired route kept as a graceful redirect for old bookmarks. */
export default function RetiredMacRoute() {
  redirect("/");
}
