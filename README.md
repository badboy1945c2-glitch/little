# Little Eng - المهندس الصغير

## تشغيل المشروع
```bash
npm install      # مرة واحدة فقط (ينزّل الأدوات)
npm run dev      # تشغيل للتجربة، افتح الرابط اللي يطلع
npm run build    # يسوي مجلد dist فيه الموقع الجاهز للرفع
npm run preview  # تجربة نسخة dist محلياً قبل الرفع
```

## وين كل شي
- `index.html`: صفحات الموقع (الترحيب، المواد، الخرسانة، الإنشائات).
- `src/main.js`: قائمة المواد (الكروت) والتنقل بين الصفحات.
- `src/concrete.js`: حاسبة الخرسانة.
- `src/style.css`: كل التنسيقات (Tailwind بآخرها، لا تغيّر ترتيبها).
- `public/structures/`: موقع الإنشائات كما هو بدون أي تعديل.
- `soil.html` + `src/soil-main.js`: صفحة ميكانيك التربة المستقلة (تُعرض داخل iframe بتبويب التربة).
- `src/modules/soil-mechanics/`: كود مادة التربة (منقول من المشروع القديم بدون تغيير ما عدا `index.js`).
- `src/soil-styles/`: تنسيقات التربة (نفس ملفات المشروع القديم، معزولة عن تنسيقات الموقع الرئيسي).

## مهم قبل الرفع على GitHub
بعد أي تغيير بـ `package.json` شغّل `npm install` وارفع ملف `package-lock.json` الجديد مع التغيير، وإلا يفشل الرفع التلقائي (`npm ci`).

## إضافة مادة جديدة لاحقاً
1. كارت جديد بمصفوفة `subjects` داخل `src/main.js`.
2. صفحة جديدة `<div id="page-xxx" class="page">` داخل `index.html`.
3. فرع جديد `else if (hash === '#/xxx')` داخل `handleRoute` بنفس الملف `src/main.js`.
