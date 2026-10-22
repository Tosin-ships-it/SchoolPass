-- AlterTable
ALTER TABLE "staff_users" ADD COLUMN IF NOT EXISTS "isFrontDesk" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "intending_students" (
    "id" TEXT NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intendedClass" TEXT NOT NULL,
    "sessionYear" TEXT NOT NULL,
    "guardianName" TEXT,
    "guardianPhone" TEXT,
    "guardianEmail" TEXT,
    "notes" TEXT,
    "registeredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intending_students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "student_number_sequences" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "student_number_sequences_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "intending_students_studentNumber_key" ON "intending_students"("studentNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "intending_students_studentNumber_idx" ON "intending_students"("studentNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "intending_students_intendedClass_idx" ON "intending_students"("intendedClass");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "intending_students_sessionYear_idx" ON "intending_students"("sessionYear");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "intending_students_registeredById_idx" ON "intending_students"("registeredById");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'intending_students_registeredById_fkey'
    ) THEN
        ALTER TABLE "intending_students" ADD CONSTRAINT "intending_students_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
