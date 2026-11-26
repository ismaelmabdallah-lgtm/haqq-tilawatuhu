import { ShellIdMarker } from "@/components/ShellIdMarker";
import { SHELL_PLACEHOLDER } from "@/lib/shell-route";
import { CertificateShell } from "./CertificateShell";

/** Exported once as /certificates/_/; public/_redirects serves it for every /certificates/:id. */
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ id: SHELL_PLACEHOLDER }];
}

export const metadata = { title: "شهادة إتمام مستوى", robots: { index: false } };

export default function CertificatePage() {
  return <ShellIdMarker route="certificates"><CertificateShell /></ShellIdMarker>;
}
