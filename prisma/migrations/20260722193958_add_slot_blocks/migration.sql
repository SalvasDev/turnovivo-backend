-- CreateEnum
CREATE TYPE "BlockReason" AS ENUM ('CANCELLED', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "slot_blocks" (
    "id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "reason" "BlockReason" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slot_blocks_slot_id_customer_id_key" ON "slot_blocks"("slot_id", "customer_id");

-- AddForeignKey
ALTER TABLE "slot_blocks" ADD CONSTRAINT "slot_blocks_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "appointment_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_blocks" ADD CONSTRAINT "slot_blocks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
