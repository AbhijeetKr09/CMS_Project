-- CreateTable
CREATE TABLE "StockCache" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockCache_symbol_date_key" ON "StockCache"("symbol", "date");
