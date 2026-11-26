import { Suspense } from "react";
import { Breadcrumbs, PageTitle } from "@/components/ui";
import { VerifyForm } from "./VerifyForm";

export const metadata = { title: "التحقق من شهادة" };

export default function VerifyPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: "التحقق من شهادة" }]} />
      <PageTitle title="التحقق من شهادة" subtitle="أدخل رمز التحقق المطبوع على الشهادة." />
      <Suspense fallback={<p>جارٍ التحميل…</p>}><VerifyForm /></Suspense>
    </>
  );
}
