import { SHELL_PLACEHOLDER } from "@/lib/shell-route";
import { ShellIdMarker } from "@/components/ShellIdMarker";
import { ExamShell } from "./ExamShell";

/** Exported once as /exams/_/; public/_redirects serves it for every /exams/:id. */
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ id: SHELL_PLACEHOLDER }];
}

export const metadata = { title: "اختبار", robots: { index: false } };

export default function ExamPage() {
  return <ShellIdMarker route="exams"><ExamShell /></ShellIdMarker>;
}
