CREATE TABLE "patent_todo" (
    "id" SERIAL NOT NULL,
    "patent_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "source_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patent_todo_pkey" PRIMARY KEY ("id")
);

-- 기존 단일 마감일은 목록형 To-do 한 건으로 보존한다.
INSERT INTO "patent_todo" (
    "patent_id",
    "title",
    "due_date",
    "source_key"
)
SELECT
    "id",
    '기존 To-do',
    "todo_due_date",
    'PATENT_TODO_DUE_DATE:' || "id"
FROM "patent"
WHERE "todo_due_date" IS NOT NULL;

CREATE UNIQUE INDEX "patent_todo_source_key_key"
ON "patent_todo"("source_key");

CREATE INDEX "patent_todo_patent_id_idx"
ON "patent_todo"("patent_id");

CREATE INDEX "patent_todo_completed_due_date_idx"
ON "patent_todo"("completed", "due_date");

ALTER TABLE "patent_todo"
ADD CONSTRAINT "patent_todo_patent_id_fkey"
FOREIGN KEY ("patent_id") REFERENCES "patent"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
