-- CreateTable
CREATE TABLE "medium" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "state_id" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medium_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "medium" ADD CONSTRAINT "medium_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "state"("id") ON DELETE CASCADE ON UPDATE CASCADE;
