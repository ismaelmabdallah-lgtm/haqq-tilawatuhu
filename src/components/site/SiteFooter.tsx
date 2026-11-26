import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-line bg-white/60 text-sm text-muted">
      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-6 sm:grid-cols-2">
        <div>
          <p className="font-bold text-ink">حَقَّ تِلَاوَتِهِ</p>
          <p>منصة تعليمية مجانية مستقلة لتعليم أحكام التلاوة والتجويد. كل محتوى منشور مراجَع علميًا.</p>
          <p className="mt-2">
            النص القرآني من{" "}
            <a href="https://tanzil.net" className="underline" rel="noopener" target="_blank">مشروع تنزيل (Tanzil)</a>
            {" "}— النص العثماني، رواية حفص، منسوخ دون تعديل (CC BY 3.0).
          </p>
        </div>
        <nav aria-label="روابط" className="flex flex-wrap content-start gap-x-4 gap-y-1 sm:justify-end">
          <Link href="/about/" className="tap inline-flex items-center">عن المنصة</Link>
          <Link href="/verify/" className="tap inline-flex items-center">التحقق من شهادة</Link>
          <Link href="/account/" className="tap inline-flex items-center">حسابي (اختياري)</Link>
          <Link href="/admin/" className="tap inline-flex items-center">فريق المنصة</Link>
        </nav>
      </div>
    </footer>
  );
}
