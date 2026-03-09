-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('SABORES', 'SELECT', 'GOURMET', 'CAFE_DA_MANHA');

-- CreateTable
CREATE TABLE "menus" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawText" TEXT,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_days" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "menuDayId" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "dishes" TEXT[],
    "reservationCode" INTEGER,
    "reservationDate" TIMESTAMP(3),

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscribers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "menu_days_menuId_dayOfWeek_key" ON "menu_days"("menuId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_phone_key" ON "subscribers"("phone");

-- AddForeignKey
ALTER TABLE "menu_days" ADD CONSTRAINT "menu_days_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_menuDayId_fkey" FOREIGN KEY ("menuDayId") REFERENCES "menu_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
