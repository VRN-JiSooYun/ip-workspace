WITH normalized_reference_image AS (
  SELECT
    id,
    btrim("originalFilename", '[]''"') AS normalized_filename,
    left(
      "legacySourceUrl",
      length("legacySourceUrl") - length("originalFilename")
    ) AS source_directory
  FROM "conference_abstract_asset"
  WHERE
    "kind" = 'REFERENCE_IMAGE'
    AND "legacySourceUrl" IS NOT NULL
    AND "originalFilename" <> btrim("originalFilename", '[]''"')
)
UPDATE "conference_abstract_asset" AS asset
SET
  "originalFilename" = normalized.normalized_filename,
  "legacySourceUrl" = normalized.source_directory || normalized.normalized_filename
FROM normalized_reference_image AS normalized
WHERE
  asset.id = normalized.id
  AND normalized.normalized_filename <> '';
