-- CreateTable
CREATE TABLE "stock_insights" (
    "id" SERIAL NOT NULL,
    "insight" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_insights_pkey" PRIMARY KEY ("id")
);
