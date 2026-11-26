import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandMark";

export function SiteFooter() {
  const links = [
    ["/about/", "عن المنصة"], ["/resources/", "المواد والملخصات"], ["/encyclopedia/", "موسوعة التجويد"],
    ["/search/", "البحث"], ["/verify/", "التحقق من شهادة"], ["/admin/", "لوحة الإدارة"],
  ];
  return (
    <footer className="mt-12 border-t border-line bg-white text-sm text-muted">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:grid-cols-2">
        <div className="space-y-3">
          <BrandLogo size={36} tagline />
          <p>منصة تعليمية مجانية مستقلة لتعليم أحكام التلاوة والتجويد. كل محتوى منشور مراجَع علميًا.</p>
          <p>
            النص القرآني من <a href="https://tanzil.net" className="underline" rel="noopener" target="_blank">مشروع تنزيل (Tanzil)</a>
            {" "}— النص العثماني، رواية حفص، منسوخ دون تعديل (CC BY 3.0).
          </p>
        </div>
        <nav aria-label="روابط إضافية" className="grid grid-cols-2 content-start gap-1 sm:justify-items-end">
          {links.map(([href, label]) => <Link key={href} href={href!} className="tap inline-flex items-center hover:text-brand-700">{label}</Link>)}
        </nav>
      </div>
    </footer>
  );
}
