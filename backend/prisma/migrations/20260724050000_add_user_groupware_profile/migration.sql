ALTER TABLE "user"
    ADD COLUMN "team" TEXT,
    ADD COLUMN "fullname" TEXT,
    ADD CONSTRAINT "user_groupware_profile_check" CHECK (
        ("team" IS NULL AND "fullname" IS NULL)
        OR (
            "team" IS NOT NULL
            AND "fullname" IS NOT NULL
            AND length(btrim("team")) BETWEEN 1 AND 200
            AND length(btrim("fullname")) BETWEEN 1 AND 200
        )
    );

CREATE INDEX "user_team_idx" ON "user"("team");
