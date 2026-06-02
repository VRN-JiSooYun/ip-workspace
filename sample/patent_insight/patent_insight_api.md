# patent insight API

## API endpoint
- POST 172.16.1.210:8000/patent_statistics_refresh/
  - 하루 1번 refresh 필요
- GET 172.16.1.210:8000/get_all_statistics/
  - 아래 params으로 필터 가능
    - "applicant": applicant,
    - "from_date": from_date,
    - "to_date": to_date,
    - "top_n_applicant": top_n_applicant,
    - "top_n_target": top_n_target,
  - request 예시:
    ```json
    {
      "applicant": "Novartis AG",
      "from_date": "2000-01-01",
      "to_date": "2023-12-31",
      "top_n_applicant": 10,
      "top_n_target": 10
    }
    ```
  - output 값
    - total_count
    - filtered_count
    - count_across_time
    - patent_per_office
    - filling_language_counts
    - patent_type_counts
    - patent_count_by_applicant
    - patent_count_by_target_and_applicant
    - response 예시:
      ```json
      {
      "data": {
          "count_across_time": [
              {
                  "count": 1,
                  "year": 1978
              },
              {
                  "count": 27,
                  "year": 1979
              },
              {
                  "count": 66,
                  "year": 1980
              },
              {
                  "count": 73,
                  "year": 1981
              },
              {
                  "count": 111,
                  "year": 1982
              },
              {
                  "count": 144,
                  "year": 1983
              },
              {
                  "count": 189,
                  "year": 1984
              },
              {
                  "count": 233,
                  "year": 1985
              },
              {
                  "count": 329,
                  "year": 1986
              },
              {
                  "count": 411,
                  "year": 1987
              },
              {
                  "count": 638,
                  "year": 1988
              },
              {
                  "count": 831,
                  "year": 1989
              },
              {
                  "count": 1050,
                  "year": 1990
              },
              {
                  "count": 1420,
                  "year": 1991
              },
              {
                  "count": 2025,
                  "year": 1992
              },
              {
                  "count": 2290,
                  "year": 1993
              },
              {
                  "count": 3124,
                  "year": 1994
              },
              {
                  "count": 3636,
                  "year": 1995
              },
              {
                  "count": 4449,
                  "year": 1996
              },
              {
                  "count": 4707,
                  "year": 1997
              },
              {
                  "count": 5796,
                  "year": 1998
              },
              {
                  "count": 6810,
                  "year": 1999
              },
              {
                  "count": 8696,
                  "year": 2000
              },
              {
                  "count": 10276,
                  "year": 2001
              },
              {
                  "count": 11604,
                  "year": 2002
              },
              {
                  "count": 12640,
                  "year": 2003
              },
              {
                  "count": 12860,
                  "year": 2004
              },
              {
                  "count": 14119,
                  "year": 2005
              },
              {
                  "count": 15765,
                  "year": 2006
              },
              {
                  "count": 16896,
                  "year": 2007
              },
              {
                  "count": 17450,
                  "year": 2008
              },
              {
                  "count": 16826,
                  "year": 2009
              },
              {
                  "count": 15329,
                  "year": 2010
              },
              {
                  "count": 13942,
                  "year": 2011
              },
              {
                  "count": 13608,
                  "year": 2012
              },
              {
                  "count": 12464,
                  "year": 2013
              },
              {
                  "count": 13463,
                  "year": 2014
              },
              {
                  "count": 12241,
                  "year": 2015
              },
              {
                  "count": 13057,
                  "year": 2016
              },
              {
                  "count": 13962,
                  "year": 2017
              },
              {
                  "count": 14131,
                  "year": 2018
              },
              {
                  "count": 14809,
                  "year": 2019
              },
              {
                  "count": 16713,
                  "year": 2020
              },
              {
                  "count": 19079,
                  "year": 2021
              },
              {
                  "count": 20363,
                  "year": 2022
              },
              {
                  "count": 20591,
                  "year": 2023
              },
              {
                  "count": 18809,
                  "year": 2024
              },
              {
                  "count": 14695,
                  "year": 2025
              },
              {
                  "count": 3281,
                  "year": 2026
              }
          ],
          "filling_language_counts": [
              {
                  "count": 310660,
                  "filling_language": "English"
              },
              {
                  "count": 23397,
                  "filling_language": "中文"
              },
              {
                  "count": 22237,
                  "filling_language": "Japanese"
              },
              {
                  "count": 10902,
                  "filling_language": "Korean"
              },
              {
                  "count": 8839,
                  "filling_language": "Deutsch"
              },
              {
                  "count": 7482,
                  "filling_language": "US/US"
              },
              {
                  "count": 6662,
                  "filling_language": "français"
              },
              {
                  "count": 6128,
                  "filling_language": "US"
              },
              {
                  "count": 4695,
                  "filling_language": "日本語"
              },
              {
                  "count": 3931,
                  "filling_language": "Chinese"
              },
              {
                  "count": 2814,
                  "filling_language": "한국어"
              },
              {
                  "count": 2707,
                  "filling_language": "español"
              },
              {
                  "count": 2098,
                  "filling_language": "French"
              },
              {
                  "count": 1875,
                  "filling_language": "Italian"
              },
              {
                  "count": 1495,
                  "filling_language": "German"
              },
              {
                  "count": 1155,
                  "filling_language": "DE"
              },
              {
                  "count": 1097,
                  "filling_language": "Russian"
              },
              {
                  "count": 557,
                  "filling_language": "Português"
              },
              {
                  "count": 478,
                  "filling_language": "IT"
              },
              {
                  "count": 454,
                  "filling_language": "Русский"
              },
              {
                  "count": 444,
                  "filling_language": "Turkish"
              },
              {
                  "count": 376,
                  "filling_language": "SE"
              },
              {
                  "count": 311,
                  "filling_language": "JP"
              },
              {
                  "count": 244,
                  "filling_language": "Polish"
              },
              {
                  "count": 242,
                  "filling_language": "KR"
              },
              {
                  "count": 171,
                  "filling_language": "FR"
              },
              {
                  "count": 151,
                  "filling_language": "HU"
              },
              {
                  "count": 140,
                  "filling_language": "Hungarian"
              },
              {
                  "count": 123,
                  "filling_language": "ES"
              },
              {
                  "count": 113,
                  "filling_language": "SE/SE"
              },
              {
                  "count": 110,
                  "filling_language": "русский"
              },
              {
                  "count": 105,
                  "filling_language": "AU"
              },
              {
                  "count": 87,
                  "filling_language": "Czech"
              },
              {
                  "count": 85,
                  "filling_language": "Dutch"
              },
              {
                  "count": 83,
                  "filling_language": "CN"
              },
              {
                  "count": 80,
                  "filling_language": "FI"
              },
              {
                  "count": 77,
                  "filling_language": "RU"
              },
              {
                  "count": 76,
                  "filling_language": "fr"
              },
              {
                  "count": 58,
                  "filling_language": "DK"
              },
              {
                  "count": 44,
                  "filling_language": "IT/IT"
              },
              {
                  "count": 34,
                  "filling_language": "Portuguese"
              },
              {
                  "count": 32,
                  "filling_language": "Finnish"
              },
              {
                  "count": 28,
                  "filling_language": "ES/ES"
              },
              {
                  "count": 27,
                  "filling_language": "Spanish"
              },
              {
                  "count": 26,
                  "filling_language": "Swedish"
              },
              {
                  "count": 22,
                  "filling_language": "IN"
              },
              {
                  "count": 21,
                  "filling_language": "NL"
              },
              {
                  "count": 21,
                  "filling_language": "FI/FI"
              },
              {
                  "count": 18,
                  "filling_language": "SI"
              },
              {
                  "count": 16,
                  "filling_language": "Danish"
              },
              {
                  "count": 16,
                  "filling_language": "Croatian"
              },
              {
                  "count": 14,
                  "filling_language": "Norwegian"
              },
              {
                  "count": 14,
                  "filling_language": "GB/GB"
              },
              {
                  "count": 14,
                  "filling_language": "IE"
              },
              {
                  "count": 10,
                  "filling_language": "Slovak"
              },
              {
                  "count": 10,
                  "filling_language": "PL"
              },
              {
                  "count": 9,
                  "filling_language": "Arabic"
              },
              {
                  "count": 9,
                  "filling_language": "HR"
              },
              {
                  "count": 8,
                  "filling_language": "AU/AU"
              },
              {
                  "count": 8,
                  "filling_language": "Slovenian"
              },
              {
                  "count": 7,
                  "filling_language": "GB"
              },
              {
                  "count": 7,
                  "filling_language": "CA/CA"
              },
              {
                  "count": 7,
                  "filling_language": "Thai"
              },
              {
                  "count": 7,
                  "filling_language": "BG"
              },
              {
                  "count": 6,
                  "filling_language": "RO"
              },
              {
                  "count": 6,
                  "filling_language": "PT"
              },
              {
                  "count": 6,
                  "filling_language": "IS"
              },
              {
                  "count": 6,
                  "filling_language": "FR/FR"
              },
              {
                  "count": 5,
                  "filling_language": "DE/DE"
              },
              {
                  "count": 5,
                  "filling_language": "russian"
              },
              {
                  "count": 4,
                  "filling_language": "FI/EN"
              },
              {
                  "count": 4,
                  "filling_language": "Ukrainian"
              },
              {
                  "count": 4,
                  "filling_language": "EN"
              },
              {
                  "count": 4,
                  "filling_language": "Bulgarian"
              },
              {
                  "count": 4,
                  "filling_language": "NO"
              },
              {
                  "count": 3,
                  "filling_language": "CA"
              },
              {
                  "count": 3,
                  "filling_language": "IN/IN"
              },
              {
                  "count": 3,
                  "filling_language": "DK/EN"
              },
              {
                  "count": 3,
                  "filling_language": "CS"
              },
              {
                  "count": 3,
                  "filling_language": "ES/US"
              },
              {
                  "count": 3,
                  "filling_language": "UA"
              },
              {
                  "count": 3,
                  "filling_language": "IE/US"
              },
              {
                  "count": 2,
                  "filling_language": "SE/FR"
              },
              {
                  "count": 2,
                  "filling_language": "CH/CH"
              },
              {
                  "count": 2,
                  "filling_language": "en"
              },
              {
                  "count": 2,
                  "filling_language": "IT/TT"
              },
              {
                  "count": 2,
                  "filling_language": "zh"
              },
              {
                  "count": 2,
                  "filling_language": "US/US; JP/JP"
              },
              {
                  "count": 2,
                  "filling_language": "FI/US"
              },
              {
                  "count": 2,
                  "filling_language": "BE/BE"
              },
              {
                  "count": 2,
                  "filling_language": "ES/SE"
              },
              {
                  "count": 2,
                  "filling_language": "GE"
              },
              {
                  "count": 2,
                  "filling_language": "US/US; FR/FR"
              },
              {
                  "count": 2,
                  "filling_language": "AT/AT"
              },
              {
                  "count": 2,
                  "filling_language": "SK"
              },
              {
                  "count": 2,
                  "filling_language": "DK/DK"
              },
              {
                  "count": 2,
                  "filling_language": "DE/US"
              },
              {
                  "count": 2,
                  "filling_language": "CZ"
              },
              {
                  "count": 2,
                  "filling_language": "LV"
              },
              {
                  "count": 2,
                  "filling_language": "US/ES"
              },
              {
                  "count": 2,
                  "filling_language": "Romanian"
              },
              {
                  "count": 2,
                  "filling_language": "Estonian"
              },
              {
                  "count": 1,
                  "filling_language": "US/US; CA/CA"
              },
              {
                  "count": 1,
                  "filling_language": "SE/FT"
              },
              {
                  "count": 1,
                  "filling_language": "ro:en?"
              },
              {
                  "count": 1,
                  "filling_language": "العربية"
              },
              {
                  "count": 1,
                  "filling_language": "Lithuanian"
              },
              {
                  "count": 1,
                  "filling_language": "Greek"
              },
              {
                  "count": 1,
                  "filling_language": "CH"
              },
              {
                  "count": 1,
                  "filling_language": "de"
              },
              {
                  "count": 1,
                  "filling_language": "US/US; GB/GB"
              },
              {
                  "count": 1,
                  "filling_language": "Georgian"
              },
              {
                  "count": 1,
                  "filling_language": "Latvian"
              },
              {
                  "count": 1,
                  "filling_language": "US/US; GB/GB; FR/FR"
              },
              {
                  "count": 1,
                  "filling_language": "US/CA"
              },
              {
                  "count": 1,
                  "filling_language": "LT"
              },
              {
                  "count": 1,
                  "filling_language": "DE/CH"
              },
              {
                  "count": 1,
                  "filling_language": "CU/CU"
              },
              {
                  "count": 1,
                  "filling_language": "DK/English"
              },
              {
                  "count": 1,
                  "filling_language": "HR/HR"
              },
              {
                  "count": 1,
                  "filling_language": "FR/DE"
              },
              {
                  "count": 1,
                  "filling_language": "US/US; GB/GB; GB"
              },
              {
                  "count": 1,
                  "filling_language": "MX"
              },
              {
                  "count": 1,
                  "filling_language": "DK/US"
              },
              {
                  "count": 1,
                  "filling_language": "DE/ES"
              },
              {
                  "count": 1,
                  "filling_language": "US/AU"
              },
              {
                  "count": 1,
                  "filling_language": "IE/IE"
              },
              {
                  "count": 1,
                  "filling_language": "US/SE"
              },
              {
                  "count": 1,
                  "filling_language": "FI/FL"
              },
              {
                  "count": 1,
                  "filling_language": "ZW"
              },
              {
                  "count": 1,
                  "filling_language": "NL/NL"
              },
              {
                  "count": 1,
                  "filling_language": "FI/ FI"
              },
              {
                  "count": 1,
                  "filling_language": "BRÉSIL"
              },
              {
                  "count": 1,
                  "filling_language": "B本語"
              },
              {
                  "count": 1,
                  "filling_language": "IN/US"
              },
              {
                  "count": 1,
                  "filling_language": "US/IE"
              },
              {
                  "count": 1,
                  "filling_language": "FR/FR; FR; FR; [US/US]"
              },
              {
                  "count": 1,
                  "filling_language": "HU/HU"
              },
              {
                  "count": 1,
                  "filling_language": "FI/FT"
              }
          ],
          "filtered_count": 426029,
          "patent_count_by_applicant": [
              {
                  "applicant": "Novartis AG",
                  "count": 3776
              },
              {
                  "applicant": "The Regents Of The University Of California",
                  "count": 3541
              },
              {
                  "applicant": "Merck & Co., Inc.",
                  "count": 2589
              },
              {
                  "applicant": "Astrazeneca Ab",
                  "count": 2452
              },
              {
                  "applicant": "Bristol-myers Squibb Company",
                  "count": 2395
              },
              {
                  "applicant": "F. Hoffmann-la Roche AG",
                  "count": 2338
              },
              {
                  "applicant": "Eli Lilly And Company",
                  "count": 1991
              },
              {
                  "applicant": "Glaxo Group Ltd.",
                  "count": 1751
              },
              {
                  "applicant": "Boehringer Ingelheim International GmbH",
                  "count": 1703
              },
              {
                  "applicant": "Smithkline Beecham Corp.",
                  "count": 1674
              },
              {
                  "applicant": "Janssen Pharmaceutica N.V.",
                  "count": 1590
              },
              {
                  "applicant": "Genentech, Inc.",
                  "count": 1572
              },
              {
                  "applicant": "Merck Sharp & Dohme Corp.",
                  "count": 1508
              },
              {
                  "applicant": "Pfizer Inc.",
                  "count": 1410
              },
              {
                  "applicant": "Abbott Laboratories",
                  "count": 1399
              },
              {
                  "applicant": "Schering Corp.",
                  "count": 1375
              },
              {
                  "applicant": "Merck Patent GmbH",
                  "count": 1342
              },
              {
                  "applicant": "The Johns Hopkins University",
                  "count": 1217
              },
              {
                  "applicant": "Board Of Regents, The University Of Texas System",
                  "count": 1192
              },
              {
                  "applicant": "Wyeth",
                  "count": 1191
              }
          ],
          "patent_count_by_target_and_applicant": [
              {
                  "count": 108,
                  "target": "KRAS",
                  "year": 2026
              },
              {
                  "count": 79,
                  "target": "EGFR",
                  "year": 2026
              },
              {
                  "count": 44,
                  "target": "HER2",
                  "year": 2026
              },
              {
                  "count": 21,
                  "target": "CD3",
                  "year": 2026
              },
              {
                  "count": 19,
                  "target": "MET",
                  "year": 2026
              },
              {
                  "count": 15,
                  "target": "PD-1",
                  "year": 2026
              },
              {
                  "count": 13,
                  "target": "PD-L1",
                  "year": 2026
              },
              {
                  "count": 13,
                  "target": "TNF",
                  "year": 2026
              },
              {
                  "count": 12,
                  "target": "BTK",
                  "year": 2026
              },
              {
                  "count": 11,
                  "target": "TP53",
                  "year": 2026
              },
              {
                  "count": 9,
                  "target": "CD19",
                  "year": 2026
              },
              {
                  "count": 8,
                  "target": "AR",
                  "year": 2026
              },
              {
                  "count": 8,
                  "target": "CD20",
                  "year": 2026
              },
              {
                  "count": 8,
                  "target": "IL6",
                  "year": 2026
              },
              {
                  "count": 7,
                  "target": "PI3K",
                  "year": 2026
              },
              {
                  "count": 6,
                  "target": "VEGF",
                  "year": 2026
              },
              {
                  "count": 3,
                  "target": "COX-2",
                  "year": 2026
              },
              {
                  "count": 3,
                  "target": "PDE4",
                  "year": 2026
              },
              {
                  "count": 2,
                  "target": "DPP4",
                  "year": 2026
              },
              {
                  "count": 1,
                  "target": "HDAC",
                  "year": 2026
              },
              {
                  "count": 214,
                  "target": "KRAS",
                  "year": 2025
              },
              {
                  "count": 198,
                  "target": "EGFR",
                  "year": 2025
              },
              {
                  "count": 182,
                  "target": "PD-1",
                  "year": 2025
              },
              {
                  "count": 140,
                  "target": "HER2",
                  "year": 2025
              },
              {
                  "count": 130,
                  "target": "CD3",
                  "year": 2025
              },
              {
                  "count": 120,
                  "target": "PD-L1",
                  "year": 2025
              },
              {
                  "count": 69,
                  "target": "CD19",
                  "year": 2025
              },
              {
                  "count": 59,
                  "target": "TNF",
                  "year": 2025
              },
              {
                  "count": 55,
                  "target": "VEGF",
                  "year": 2025
              },
              {
                  "count": 54,
                  "target": "AR",
                  "year": 2025
              },
              {
                  "count": 54,
                  "target": "CD20",
                  "year": 2025
              },
              {
                  "count": 53,
                  "target": "TP53",
                  "year": 2025
              },
              {
                  "count": 51,
                  "target": "MET",
                  "year": 2025
              },
              {
                  "count": 41,
                  "target": "IL6",
                  "year": 2025
              },
              {
                  "count": 31,
                  "target": "PI3K",
                  "year": 2025
              },
              {
                  "count": 30,
                  "target": "BTK",
                  "year": 2025
              },
              {
                  "count": 15,
                  "target": "COX-2",
                  "year": 2025
              },
              {
                  "count": 15,
                  "target": "PDE4",
                  "year": 2025
              },
              {
                  "count": 14,
                  "target": "DPP4",
                  "year": 2025
              },
              {
                  "count": 12,
                  "target": "HDAC",
                  "year": 2025
              },
              {
                  "count": 281,
                  "target": "KRAS",
                  "year": 2024
              },
              {
                  "count": 258,
                  "target": "EGFR",
                  "year": 2024
              },
              {
                  "count": 210,
                  "target": "PD-1",
                  "year": 2024
              },
              {
                  "count": 204,
                  "target": "HER2",
                  "year": 2024
              },
              {
                  "count": 181,
                  "target": "PD-L1",
                  "year": 2024
              },
              {
                  "count": 171,
                  "target": "CD3",
                  "year": 2024
              },
              {
                  "count": 105,
                  "target": "CD19",
                  "year": 2024
              },
              {
                  "count": 97,
                  "target": "TNF",
                  "year": 2024
              },
              {
                  "count": 85,
                  "target": "VEGF",
                  "year": 2024
              },
              {
                  "count": 61,
                  "target": "CD20",
                  "year": 2024
              },
              {
                  "count": 61,
                  "target": "IL6",
                  "year": 2024
              },
              {
                  "count": 60,
                  "target": "AR",
                  "year": 2024
              },
              {
                  "count": 54,
                  "target": "MET",
                  "year": 2024
              },
              {
                  "count": 50,
                  "target": "BTK",
                  "year": 2024
              },
              {
                  "count": 49,
                  "target": "PI3K",
                  "year": 2024
              },
              {
                  "count": 49,
                  "target": "TP53",
                  "year": 2024
              },
              {
                  "count": 23,
                  "target": "PDE4",
                  "year": 2024
              },
              {
                  "count": 20,
                  "target": "DPP4",
                  "year": 2024
              },
              {
                  "count": 16,
                  "target": "COX-2",
                  "year": 2024
              },
              {
                  "count": 15,
                  "target": "HDAC",
                  "year": 2024
              },
              {
                  "count": 300,
                  "target": "KRAS",
                  "year": 2023
              },
              {
                  "count": 298,
                  "target": "EGFR",
                  "year": 2023
              },
              {
                  "count": 232,
                  "target": "PD-1",
                  "year": 2023
              },
              {
                  "count": 223,
                  "target": "PD-L1",
                  "year": 2023
              },
              {
                  "count": 195,
                  "target": "CD3",
                  "year": 2023
              },
              {
                  "count": 194,
                  "target": "HER2",
                  "year": 2023
              },
              {
                  "count": 119,
                  "target": "TNF",
                  "year": 2023
              },
              {
                  "count": 99,
                  "target": "CD19",
                  "year": 2023
              },
              {
                  "count": 89,
                  "target": "VEGF",
                  "year": 2023
              },
              {
                  "count": 74,
                  "target": "IL6",
                  "year": 2023
              },
              {
                  "count": 67,
                  "target": "BTK",
                  "year": 2023
              },
              {
                  "count": 67,
                  "target": "CD20",
                  "year": 2023
              },
              {
                  "count": 58,
                  "target": "AR",
                  "year": 2023
              },
              {
                  "count": 50,
                  "target": "PI3K",
                  "year": 2023
              },
              {
                  "count": 48,
                  "target": "MET",
                  "year": 2023
              },
              {
                  "count": 37,
                  "target": "TP53",
                  "year": 2023
              },
              {
                  "count": 27,
                  "target": "HDAC",
                  "year": 2023
              },
              {
                  "count": 24,
                  "target": "COX-2",
                  "year": 2023
              },
              {
                  "count": 16,
                  "target": "DPP4",
                  "year": 2023
              },
              {
                  "count": 10,
                  "target": "PDE4",
                  "year": 2023
              },
              {
                  "count": 297,
                  "target": "EGFR",
                  "year": 2022
              },
              {
                  "count": 278,
                  "target": "PD-1",
                  "year": 2022
              },
              {
                  "count": 257,
                  "target": "KRAS",
                  "year": 2022
              },
              {
                  "count": 251,
                  "target": "PD-L1",
                  "year": 2022
              },
              {
                  "count": 190,
                  "target": "HER2",
                  "year": 2022
              },
              {
                  "count": 164,
                  "target": "CD3",
                  "year": 2022
              },
              {
                  "count": 128,
                  "target": "TNF",
                  "year": 2022
              },
              {
                  "count": 110,
                  "target": "CD19",
                  "year": 2022
              },
              {
                  "count": 76,
                  "target": "BTK",
                  "year": 2022
              },
              {
                  "count": 76,
                  "target": "CD20",
                  "year": 2022
              },
              {
                  "count": 73,
                  "target": "VEGF",
                  "year": 2022
              },
              {
                  "count": 59,
                  "target": "IL6",
                  "year": 2022
              },
              {
                  "count": 54,
                  "target": "AR",
                  "year": 2022
              },
              {
                  "count": 50,
                  "target": "MET",
                  "year": 2022
              },
              {
                  "count": 37,
                  "target": "PI3K",
                  "year": 2022
              },
              {
                  "count": 35,
                  "target": "TP53",
                  "year": 2022
              },
              {
                  "count": 21,
                  "target": "HDAC",
                  "year": 2022
              },
              {
                  "count": 16,
                  "target": "DPP4",
                  "year": 2022
              },
              {
                  "count": 15,
                  "target": "COX-2",
                  "year": 2022
              },
              {
                  "count": 13,
                  "target": "PDE4",
                  "year": 2022
              },
              {
                  "count": 243,
                  "target": "PD-L1",
                  "year": 2021
              },
              {
                  "count": 237,
                  "target": "EGFR",
                  "year": 2021
              },
              {
                  "count": 229,
                  "target": "PD-1",
                  "year": 2021
              },
              {
                  "count": 159,
                  "target": "KRAS",
                  "year": 2021
              },
              {
                  "count": 150,
                  "target": "HER2",
                  "year": 2021
              },
              {
                  "count": 120,
                  "target": "CD3",
                  "year": 2021
              },
              {
                  "count": 103,
                  "target": "TNF",
                  "year": 2021
              },
              {
                  "count": 99,
                  "target": "CD19",
                  "year": 2021
              },
              {
                  "count": 94,
                  "target": "VEGF",
                  "year": 2021
              },
              {
                  "count": 66,
                  "target": "BTK",
                  "year": 2021
              },
              {
                  "count": 65,
                  "target": "IL6",
                  "year": 2021
              },
              {
                  "count": 53,
                  "target": "CD20",
                  "year": 2021
              },
              {
                  "count": 48,
                  "target": "AR",
                  "year": 2021
              },
              {
                  "count": 45,
                  "target": "TP53",
                  "year": 2021
              },
              {
                  "count": 34,
                  "target": "MET",
                  "year": 2021
              },
              {
                  "count": 26,
                  "target": "PI3K",
                  "year": 2021
              },
              {
                  "count": 21,
                  "target": "HDAC",
                  "year": 2021
              },
              {
                  "count": 18,
                  "target": "DPP4",
                  "year": 2021
              },
              {
                  "count": 15,
                  "target": "COX-2",
                  "year": 2021
              },
              {
                  "count": 15,
                  "target": "PDE4",
                  "year": 2021
              },
              {
                  "count": 204,
                  "target": "PD-1",
                  "year": 2020
              },
              {
                  "count": 188,
                  "target": "PD-L1",
                  "year": 2020
              },
              {
                  "count": 167,
                  "target": "EGFR",
                  "year": 2020
              },
              {
                  "count": 128,
                  "target": "HER2",
                  "year": 2020
              },
              {
                  "count": 98,
                  "target": "CD19",
                  "year": 2020
              },
              {
                  "count": 94,
                  "target": "CD3",
                  "year": 2020
              },
              {
                  "count": 74,
                  "target": "TNF",
                  "year": 2020
              },
              {
                  "count": 73,
                  "target": "KRAS",
                  "year": 2020
              },
              {
                  "count": 48,
                  "target": "AR",
                  "year": 2020
              },
              {
                  "count": 45,
                  "target": "BTK",
                  "year": 2020
              },
              {
                  "count": 44,
                  "target": "VEGF",
                  "year": 2020
              },
              {
                  "count": 41,
                  "target": "PI3K",
                  "year": 2020
              },
              {
                  "count": 39,
                  "target": "MET",
                  "year": 2020
              },
              {
                  "count": 38,
                  "target": "CD20",
                  "year": 2020
              },
              {
                  "count": 35,
                  "target": "TP53",
                  "year": 2020
              },
              {
                  "count": 32,
                  "target": "IL6",
                  "year": 2020
              },
              {
                  "count": 23,
                  "target": "HDAC",
                  "year": 2020
              },
              {
                  "count": 16,
                  "target": "COX-2",
                  "year": 2020
              },
              {
                  "count": 12,
                  "target": "DPP4",
                  "year": 2020
              },
              {
                  "count": 12,
                  "target": "PDE4",
                  "year": 2020
              },
              {
                  "count": 188,
                  "target": "PD-1",
                  "year": 2019
              },
              {
                  "count": 160,
                  "target": "EGFR",
                  "year": 2019
              },
              {
                  "count": 144,
                  "target": "PD-L1",
                  "year": 2019
              },
              {
                  "count": 77,
                  "target": "HER2",
                  "year": 2019
              },
              {
                  "count": 74,
                  "target": "CD3",
                  "year": 2019
              },
              {
                  "count": 56,
                  "target": "TNF",
                  "year": 2019
              },
              {
                  "count": 51,
                  "target": "CD19",
                  "year": 2019
              },
              {
                  "count": 51,
                  "target": "VEGF",
                  "year": 2019
              },
              {
                  "count": 45,
                  "target": "KRAS",
                  "year": 2019
              },
              {
                  "count": 42,
                  "target": "BTK",
                  "year": 2019
              },
              {
                  "count": 37,
                  "target": "PI3K",
                  "year": 2019
              },
              {
                  "count": 32,
                  "target": "TP53",
                  "year": 2019
              },
              {
                  "count": 26,
                  "target": "CD20",
                  "year": 2019
              },
              {
                  "count": 26,
                  "target": "IL6",
                  "year": 2019
              },
              {
                  "count": 25,
                  "target": "HDAC",
                  "year": 2019
              },
              {
                  "count": 22,
                  "target": "AR",
                  "year": 2019
              },
              {
                  "count": 20,
                  "target": "MET",
                  "year": 2019
              },
              {
                  "count": 19,
                  "target": "COX-2",
                  "year": 2019
              },
              {
                  "count": 17,
                  "target": "PDE4",
                  "year": 2019
              },
              {
                  "count": 10,
                  "target": "DPP4",
                  "year": 2019
              },
              {
                  "count": 192,
                  "target": "PD-1",
                  "year": 2018
              },
              {
                  "count": 134,
                  "target": "PD-L1",
                  "year": 2018
              },
              {
                  "count": 123,
                  "target": "EGFR",
                  "year": 2018
              },
              {
                  "count": 93,
                  "target": "HER2",
                  "year": 2018
              },
              {
                  "count": 79,
                  "target": "TNF",
                  "year": 2018
              },
              {
                  "count": 69,
                  "target": "CD3",
                  "year": 2018
              },
              {
                  "count": 66,
                  "target": "VEGF",
                  "year": 2018
              },
              {
                  "count": 60,
                  "target": "BTK",
                  "year": 2018
              },
              {
                  "count": 56,
                  "target": "CD19",
                  "year": 2018
              },
              {
                  "count": 50,
                  "target": "KRAS",
                  "year": 2018
              },
              {
                  "count": 43,
                  "target": "CD20",
                  "year": 2018
              },
              {
                  "count": 36,
                  "target": "MET",
                  "year": 2018
              },
              {
                  "count": 32,
                  "target": "PI3K",
                  "year": 2018
              },
              {
                  "count": 30,
                  "target": "AR",
                  "year": 2018
              },
              {
                  "count": 24,
                  "target": "IL6",
                  "year": 2018
              },
              {
                  "count": 24,
                  "target": "TP53",
                  "year": 2018
              },
              {
                  "count": 16,
                  "target": "HDAC",
                  "year": 2018
              },
              {
                  "count": 15,
                  "target": "PDE4",
                  "year": 2018
              },
              {
                  "count": 10,
                  "target": "DPP4",
                  "year": 2018
              },
              {
                  "count": 9,
                  "target": "COX-2",
                  "year": 2018
              },
              {
                  "count": 174,
                  "target": "EGFR",
                  "year": 2017
              },
              {
                  "count": 150,
                  "target": "PD-1",
                  "year": 2017
              },
              {
                  "count": 109,
                  "target": "PD-L1",
                  "year": 2017
              },
              {
                  "count": 108,
                  "target": "HER2",
                  "year": 2017
              },
              {
                  "count": 86,
                  "target": "TNF",
                  "year": 2017
              },
              {
                  "count": 79,
                  "target": "CD3",
                  "year": 2017
              },
              {
                  "count": 68,
                  "target": "PI3K",
                  "year": 2017
              },
              {
                  "count": 62,
                  "target": "BTK",
                  "year": 2017
              },
              {
                  "count": 55,
                  "target": "VEGF",
                  "year": 2017
              },
              {
                  "count": 52,
                  "target": "CD19",
                  "year": 2017
              },
              {
                  "count": 45,
                  "target": "KRAS",
                  "year": 2017
              },
              {
                  "count": 38,
                  "target": "TP53",
                  "year": 2017
              },
              {
                  "count": 34,
                  "target": "CD20",
                  "year": 2017
              },
              {
                  "count": 28,
                  "target": "HDAC",
                  "year": 2017
              },
              {
                  "count": 27,
                  "target": "AR",
                  "year": 2017
              },
              {
                  "count": 27,
                  "target": "DPP4",
                  "year": 2017
              },
              {
                  "count": 25,
                  "target": "MET",
                  "year": 2017
              },
              {
                  "count": 21,
                  "target": "IL6",
                  "year": 2017
              },
              {
                  "count": 13,
                  "target": "PDE4",
                  "year": 2017
              },
              {
                  "count": 8,
                  "target": "COX-2",
                  "year": 2017
              },
              {
                  "count": 168,
                  "target": "EGFR",
                  "year": 2016
              },
              {
                  "count": 102,
                  "target": "PD-1",
                  "year": 2016
              },
              {
                  "count": 101,
                  "target": "BTK",
                  "year": 2016
              },
              {
                  "count": 96,
                  "target": "HER2",
                  "year": 2016
              },
              {
                  "count": 84,
                  "target": "TNF",
                  "year": 2016
              },
              {
                  "count": 80,
                  "target": "PD-L1",
                  "year": 2016
              },
              {
                  "count": 64,
                  "target": "PI3K",
                  "year": 2016
              },
              {
                  "count": 59,
                  "target": "CD3",
                  "year": 2016
              },
              {
                  "count": 59,
                  "target": "VEGF",
                  "year": 2016
              },
              {
                  "count": 56,
                  "target": "CD19",
                  "year": 2016
              },
              {
                  "count": 37,
                  "target": "KRAS",
                  "year": 2016
              },
              {
                  "count": 36,
                  "target": "MET",
                  "year": 2016
              },
              {
                  "count": 31,
                  "target": "CD20",
                  "year": 2016
              },
              {
                  "count": 28,
                  "target": "AR",
                  "year": 2016
              },
              {
                  "count": 23,
                  "target": "TP53",
                  "year": 2016
              },
              {
                  "count": 22,
                  "target": "HDAC",
                  "year": 2016
              },
              {
                  "count": 22,
                  "target": "IL6",
                  "year": 2016
              },
              {
                  "count": 18,
                  "target": "DPP4",
                  "year": 2016
              },
              {
                  "count": 14,
                  "target": "PDE4",
                  "year": 2016
              },
              {
                  "count": 13,
                  "target": "COX-2",
                  "year": 2016
              },
              {
                  "count": 151,
                  "target": "EGFR",
                  "year": 2015
              },
              {
                  "count": 112,
                  "target": "HER2",
                  "year": 2015
              },
              {
                  "count": 89,
                  "target": "PI3K",
                  "year": 2015
              },
              {
                  "count": 74,
                  "target": "BTK",
                  "year": 2015
              },
              {
                  "count": 72,
                  "target": "TNF",
                  "year": 2015
              },
              {
                  "count": 55,
                  "target": "VEGF",
                  "year": 2015
              },
              {
                  "count": 46,
                  "target": "PD-1",
                  "year": 2015
              },
              {
                  "count": 39,
                  "target": "KRAS",
                  "year": 2015
              },
              {
                  "count": 35,
                  "target": "MET",
                  "year": 2015
              },
              {
                  "count": 34,
                  "target": "CD20",
                  "year": 2015
              },
              {
                  "count": 33,
                  "target": "CD19",
                  "year": 2015
              },
              {
                  "count": 31,
                  "target": "CD3",
                  "year": 2015
              },
              {
                  "count": 30,
                  "target": "TP53",
                  "year": 2015
              },
              {
                  "count": 28,
                  "target": "AR",
                  "year": 2015
              },
              {
                  "count": 27,
                  "target": "PDE4",
                  "year": 2015
              },
              {
                  "count": 26,
                  "target": "IL6",
                  "year": 2015
              },
              {
                  "count": 25,
                  "target": "PD-L1",
                  "year": 2015
              },
              {
                  "count": 23,
                  "target": "DPP4",
                  "year": 2015
              },
              {
                  "count": 23,
                  "target": "HDAC",
                  "year": 2015
              },
              {
                  "count": 4,
                  "target": "COX-2",
                  "year": 2015
              },
              {
                  "count": 141,
                  "target": "EGFR",
                  "year": 2014
              },
              {
                  "count": 92,
                  "target": "HER2",
                  "year": 2014
              },
              {
                  "count": 85,
                  "target": "PI3K",
                  "year": 2014
              },
              {
                  "count": 63,
                  "target": "BTK",
                  "year": 2014
              },
              {
                  "count": 63,
                  "target": "TNF",
                  "year": 2014
              },
              {
                  "count": 58,
                  "target": "VEGF",
                  "year": 2014
              },
              {
                  "count": 46,
                  "target": "MET",
                  "year": 2014
              },
              {
                  "count": 35,
                  "target": "AR",
                  "year": 2014
              },
              {
                  "count": 32,
                  "target": "HDAC",
                  "year": 2014
              },
              {
                  "count": 30,
                  "target": "CD20",
                  "year": 2014
              },
              {
                  "count": 30,
                  "target": "IL6",
                  "year": 2014
              },
              {
                  "count": 29,
                  "target": "CD3",
                  "year": 2014
              },
              {
                  "count": 29,
                  "target": "DPP4",
                  "year": 2014
              },
              {
                  "count": 29,
                  "target": "KRAS",
                  "year": 2014
              },
              {
                  "count": 25,
                  "target": "TP53",
                  "year": 2014
              },
              {
                  "count": 20,
                  "target": "CD19",
                  "year": 2014
              },
              {
                  "count": 19,
                  "target": "COX-2",
                  "year": 2014
              },
              {
                  "count": 19,
                  "target": "PDE4",
                  "year": 2014
              },
              {
                  "count": 15,
                  "target": "PD-1",
                  "year": 2014
              },
              {
                  "count": 11,
                  "target": "PD-L1",
                  "year": 2014
              },
              {
                  "count": 108,
                  "target": "EGFR",
                  "year": 2013
              },
              {
                  "count": 74,
                  "target": "PI3K",
                  "year": 2013
              },
              {
                  "count": 69,
                  "target": "VEGF",
                  "year": 2013
              },
              {
                  "count": 65,
                  "target": "TNF",
                  "year": 2013
              },
              {
                  "count": 58,
                  "target": "HER2",
                  "year": 2013
              },
              {
                  "count": 53,
                  "target": "MET",
                  "year": 2013
              },
              {
                  "count": 36,
                  "target": "AR",
                  "year": 2013
              },
              {
                  "count": 35,
                  "target": "BTK",
                  "year": 2013
              },
              {
                  "count": 31,
                  "target": "HDAC",
                  "year": 2013
              },
              {
                  "count": 28,
                  "target": "DPP4",
                  "year": 2013
              },
              {
                  "count": 26,
                  "target": "KRAS",
                  "year": 2013
              },
              {
                  "count": 24,
                  "target": "CD3",
                  "year": 2013
              },
              {
                  "count": 22,
                  "target": "IL6",
                  "year": 2013
              },
              {
                  "count": 20,
                  "target": "PDE4",
                  "year": 2013
              },
              {
                  "count": 20,
                  "target": "TP53",
                  "year": 2013
              },
              {
                  "count": 15,
                  "target": "CD20",
                  "year": 2013
              },
              {
                  "count": 11,
                  "target": "COX-2",
                  "year": 2013
              },
              {
                  "count": 10,
                  "target": "CD19",
                  "year": 2013
              },
              {
                  "count": 7,
                  "target": "PD-1",
                  "year": 2013
              },
              {
                  "count": 7,
                  "target": "PD-L1",
                  "year": 2013
              },
              {
                  "count": 136,
                  "target": "EGFR",
                  "year": 2012
              },
              {
                  "count": 89,
                  "target": "PI3K",
                  "year": 2012
              },
              {
                  "count": 78,
                  "target": "TNF",
                  "year": 2012
              },
              {
                  "count": 69,
                  "target": "HER2",
                  "year": 2012
              },
              {
                  "count": 63,
                  "target": "VEGF",
                  "year": 2012
              },
              {
                  "count": 55,
                  "target": "MET",
                  "year": 2012
              },
              {
                  "count": 27,
                  "target": "CD20",
                  "year": 2012
              },
              {
                  "count": 27,
                  "target": "IL6",
                  "year": 2012
              },
              {
                  "count": 27,
                  "target": "KRAS",
                  "year": 2012
              },
              {
                  "count": 25,
                  "target": "DPP4",
                  "year": 2012
              },
              {
                  "count": 24,
                  "target": "HDAC",
                  "year": 2012
              },
              {
                  "count": 21,
                  "target": "COX-2",
                  "year": 2012
              },
              {
                  "count": 20,
                  "target": "TP53",
                  "year": 2012
              },
              {
                  "count": 19,
                  "target": "AR",
                  "year": 2012
              },
              {
                  "count": 19,
                  "target": "CD3",
                  "year": 2012
              },
              {
                  "count": 18,
                  "target": "CD19",
                  "year": 2012
              },
              {
                  "count": 15,
                  "target": "PDE4",
                  "year": 2012
              },
              {
                  "count": 9,
                  "target": "BTK",
                  "year": 2012
              },
              {
                  "count": 3,
                  "target": "PD-1",
                  "year": 2012
              },
              {
                  "count": 90,
                  "target": "EGFR",
                  "year": 2011
              },
              {
                  "count": 78,
                  "target": "TNF",
                  "year": 2011
              },
              {
                  "count": 67,
                  "target": "VEGF",
                  "year": 2011
              },
              {
                  "count": 66,
                  "target": "PI3K",
                  "year": 2011
              },
              {
                  "count": 56,
                  "target": "HER2",
                  "year": 2011
              },
              {
                  "count": 49,
                  "target": "MET",
                  "year": 2011
              },
              {
                  "count": 31,
                  "target": "IL6",
                  "year": 2011
              },
              {
                  "count": 27,
                  "target": "DPP4",
                  "year": 2011
              },
              {
                  "count": 25,
                  "target": "AR",
                  "year": 2011
              },
              {
                  "count": 24,
                  "target": "HDAC",
                  "year": 2011
              },
              {
                  "count": 23,
                  "target": "COX-2",
                  "year": 2011
              },
              {
                  "count": 21,
                  "target": "CD20",
                  "year": 2011
              },
              {
                  "count": 17,
                  "target": "KRAS",
                  "year": 2011
              },
              {
                  "count": 15,
                  "target": "CD3",
                  "year": 2011
              },
              {
                  "count": 15,
                  "target": "PDE4",
                  "year": 2011
              },
              {
                  "count": 14,
                  "target": "TP53",
                  "year": 2011
              },
              {
                  "count": 11,
                  "target": "BTK",
                  "year": 2011
              },
              {
                  "count": 7,
                  "target": "PD-1",
                  "year": 2011
              },
              {
                  "count": 4,
                  "target": "PD-L1",
                  "year": 2011
              },
              {
                  "count": 1,
                  "target": "CD19",
                  "year": 2011
              },
              {
                  "count": 114,
                  "target": "EGFR",
                  "year": 2010
              },
              {
                  "count": 91,
                  "target": "PI3K",
                  "year": 2010
              },
              {
                  "count": 81,
                  "target": "VEGF",
                  "year": 2010
              },
              {
                  "count": 75,
                  "target": "TNF",
                  "year": 2010
              },
              {
                  "count": 70,
                  "target": "HER2",
                  "year": 2010
              },
              {
                  "count": 51,
                  "target": "MET",
                  "year": 2010
              },
              {
                  "count": 34,
                  "target": "DPP4",
                  "year": 2010
              },
              {
                  "count": 26,
                  "target": "TP53",
                  "year": 2010
              },
              {
                  "count": 25,
                  "target": "PDE4",
                  "year": 2010
              },
              {
                  "count": 24,
                  "target": "HDAC",
                  "year": 2010
              },
              {
                  "count": 20,
                  "target": "CD20",
                  "year": 2010
              },
              {
                  "count": 18,
                  "target": "COX-2",
                  "year": 2010
              },
              {
                  "count": 18,
                  "target": "IL6",
                  "year": 2010
              },
              {
                  "count": 17,
                  "target": "AR",
                  "year": 2010
              },
              {
                  "count": 16,
                  "target": "BTK",
                  "year": 2010
              },
              {
                  "count": 16,
                  "target": "KRAS",
                  "year": 2010
              },
              {
                  "count": 13,
                  "target": "CD3",
                  "year": 2010
              },
              {
                  "count": 10,
                  "target": "PD-1",
                  "year": 2010
              },
              {
                  "count": 8,
                  "target": "CD19",
                  "year": 2010
              },
              {
                  "count": 4,
                  "target": "PD-L1",
                  "year": 2010
              },
              {
                  "count": 116,
                  "target": "TNF",
                  "year": 2009
              },
              {
                  "count": 96,
                  "target": "EGFR",
                  "year": 2009
              },
              {
                  "count": 79,
                  "target": "PI3K",
                  "year": 2009
              },
              {
                  "count": 60,
                  "target": "HDAC",
                  "year": 2009
              },
              {
                  "count": 56,
                  "target": "HER2",
                  "year": 2009
              },
              {
                  "count": 54,
                  "target": "MET",
                  "year": 2009
              },
              {
                  "count": 45,
                  "target": "VEGF",
                  "year": 2009
              },
              {
                  "count": 36,
                  "target": "DPP4",
                  "year": 2009
              },
              {
                  "count": 34,
                  "target": "PDE4",
                  "year": 2009
              },
              {
                  "count": 32,
                  "target": "AR",
                  "year": 2009
              },
              {
                  "count": 26,
                  "target": "TP53",
                  "year": 2009
              },
              {
                  "count": 23,
                  "target": "CD20",
                  "year": 2009
              },
              {
                  "count": 22,
                  "target": "COX-2",
                  "year": 2009
              },
              {
                  "count": 20,
                  "target": "IL6",
                  "year": 2009
              },
              {
                  "count": 10,
                  "target": "KRAS",
                  "year": 2009
              },
              {
                  "count": 8,
                  "target": "BTK",
                  "year": 2009
              },
              {
                  "count": 5,
                  "target": "CD3",
                  "year": 2009
              },
              {
                  "count": 4,
                  "target": "PD-1",
                  "year": 2009
              },
              {
                  "count": 4,
                  "target": "PD-L1",
                  "year": 2009
              },
              {
                  "count": 3,
                  "target": "CD19",
                  "year": 2009
              },
              {
                  "count": 89,
                  "target": "EGFR",
                  "year": 2008
              },
              {
                  "count": 68,
                  "target": "PI3K",
                  "year": 2008
              },
              {
                  "count": 65,
                  "target": "VEGF",
                  "year": 2008
              },
              {
                  "count": 64,
                  "target": "HDAC",
                  "year": 2008
              },
              {
                  "count": 51,
                  "target": "TNF",
                  "year": 2008
              },
              {
                  "count": 45,
                  "target": "MET",
                  "year": 2008
              },
              {
                  "count": 43,
                  "target": "HER2",
                  "year": 2008
              },
              {
                  "count": 42,
                  "target": "DPP4",
                  "year": 2008
              },
              {
                  "count": 38,
                  "target": "PDE4",
                  "year": 2008
              },
              {
                  "count": 32,
                  "target": "AR",
                  "year": 2008
              },
              {
                  "count": 30,
                  "target": "COX-2",
                  "year": 2008
              },
              {
                  "count": 19,
                  "target": "TP53",
                  "year": 2008
              },
              {
                  "count": 17,
                  "target": "CD20",
                  "year": 2008
              },
              {
                  "count": 16,
                  "target": "IL6",
                  "year": 2008
              },
              {
                  "count": 13,
                  "target": "CD3",
                  "year": 2008
              },
              {
                  "count": 10,
                  "target": "BTK",
                  "year": 2008
              },
              {
                  "count": 9,
                  "target": "KRAS",
                  "year": 2008
              },
              {
                  "count": 5,
                  "target": "CD19",
                  "year": 2008
              },
              {
                  "count": 3,
                  "target": "PD-1",
                  "year": 2008
              },
              {
                  "count": 1,
                  "target": "PD-L1",
                  "year": 2008
              },
              {
                  "count": 90,
                  "target": "EGFR",
                  "year": 2007
              },
              {
                  "count": 81,
                  "target": "HDAC",
                  "year": 2007
              },
              {
                  "count": 73,
                  "target": "TNF",
                  "year": 2007
              },
              {
                  "count": 61,
                  "target": "DPP4",
                  "year": 2007
              },
              {
                  "count": 60,
                  "target": "VEGF",
                  "year": 2007
              },
              {
                  "count": 43,
                  "target": "COX-2",
                  "year": 2007
              },
              {
                  "count": 43,
                  "target": "MET",
                  "year": 2007
              },
              {
                  "count": 43,
                  "target": "PI3K",
                  "year": 2007
              },
              {
                  "count": 39,
                  "target": "HER2",
                  "year": 2007
              },
              {
                  "count": 37,
                  "target": "PDE4",
                  "year": 2007
              },
              {
                  "count": 36,
                  "target": "AR",
                  "year": 2007
              },
              {
                  "count": 17,
                  "target": "CD3",
                  "year": 2007
              },
              {
                  "count": 15,
                  "target": "CD20",
                  "year": 2007
              },
              {
                  "count": 11,
                  "target": "TP53",
                  "year": 2007
              },
              {
                  "count": 9,
                  "target": "IL6",
                  "year": 2007
              },
              {
                  "count": 8,
                  "target": "CD19",
                  "year": 2007
              },
              {
                  "count": 6,
                  "target": "KRAS",
                  "year": 2007
              },
              {
                  "count": 5,
                  "target": "BTK",
                  "year": 2007
              },
              {
                  "count": 3,
                  "target": "PD-L1",
                  "year": 2007
              },
              {
                  "count": 1,
                  "target": "PD-1",
                  "year": 2007
              },
              {
                  "count": 88,
                  "target": "TNF",
                  "year": 2006
              },
              {
                  "count": 81,
                  "target": "EGFR",
                  "year": 2006
              },
              {
                  "count": 72,
                  "target": "DPP4",
                  "year": 2006
              },
              {
                  "count": 69,
                  "target": "VEGF",
                  "year": 2006
              },
              {
                  "count": 65,
                  "target": "HER2",
                  "year": 2006
              },
              {
                  "count": 55,
                  "target": "HDAC",
                  "year": 2006
              },
              {
                  "count": 52,
                  "target": "COX-2",
                  "year": 2006
              },
              {
                  "count": 47,
                  "target": "PDE4",
                  "year": 2006
              },
              {
                  "count": 38,
                  "target": "AR",
                  "year": 2006
              },
              {
                  "count": 31,
                  "target": "MET",
                  "year": 2006
              },
              {
                  "count": 20,
                  "target": "CD20",
                  "year": 2006
              },
              {
                  "count": 17,
                  "target": "PI3K",
                  "year": 2006
              },
              {
                  "count": 14,
                  "target": "TP53",
                  "year": 2006
              },
              {
                  "count": 13,
                  "target": "IL6",
                  "year": 2006
              },
              {
                  "count": 7,
                  "target": "CD3",
                  "year": 2006
              },
              {
                  "count": 5,
                  "target": "BTK",
                  "year": 2006
              },
              {
                  "count": 5,
                  "target": "CD19",
                  "year": 2006
              },
              {
                  "count": 3,
                  "target": "KRAS",
                  "year": 2006
              },
              {
                  "count": 2,
                  "target": "PD-1",
                  "year": 2006
              },
              {
                  "count": 86,
                  "target": "COX-2",
                  "year": 2005
              },
              {
                  "count": 85,
                  "target": "EGFR",
                  "year": 2005
              },
              {
                  "count": 81,
                  "target": "DPP4",
                  "year": 2005
              },
              {
                  "count": 73,
                  "target": "TNF",
                  "year": 2005
              },
              {
                  "count": 70,
                  "target": "PDE4",
                  "year": 2005
              },
              {
                  "count": 69,
                  "target": "VEGF",
                  "year": 2005
              },
              {
                  "count": 58,
                  "target": "HER2",
                  "year": 2005
              },
              {
                  "count": 52,
                  "target": "AR",
                  "year": 2005
              },
              {
                  "count": 43,
                  "target": "HDAC",
                  "year": 2005
              },
              {
                  "count": 26,
                  "target": "MET",
                  "year": 2005
              },
              {
                  "count": 25,
                  "target": "CD20",
                  "year": 2005
              },
              {
                  "count": 16,
                  "target": "TP53",
                  "year": 2005
              },
              {
                  "count": 15,
                  "target": "CD3",
                  "year": 2005
              },
              {
                  "count": 14,
                  "target": "IL6",
                  "year": 2005
              },
              {
                  "count": 12,
                  "target": "PI3K",
                  "year": 2005
              },
              {
                  "count": 5,
                  "target": "KRAS",
                  "year": 2005
              },
              {
                  "count": 2,
                  "target": "BTK",
                  "year": 2005
              },
              {
                  "count": 2,
                  "target": "PD-L1",
                  "year": 2005
              },
              {
                  "count": 1,
                  "target": "CD19",
                  "year": 2005
              },
              {
                  "count": 125,
                  "target": "COX-2",
                  "year": 2004
              },
              {
                  "count": 75,
                  "target": "PDE4",
                  "year": 2004
              },
              {
                  "count": 72,
                  "target": "TNF",
                  "year": 2004
              },
              {
                  "count": 57,
                  "target": "EGFR",
                  "year": 2004
              },
              {
                  "count": 52,
                  "target": "DPP4",
                  "year": 2004
              },
              {
                  "count": 41,
                  "target": "HER2",
                  "year": 2004
              },
              {
                  "count": 38,
                  "target": "AR",
                  "year": 2004
              },
              {
                  "count": 37,
                  "target": "VEGF",
                  "year": 2004
              },
              {
                  "count": 34,
                  "target": "HDAC",
                  "year": 2004
              },
              {
                  "count": 16,
                  "target": "TP53",
                  "year": 2004
              },
              {
                  "count": 15,
                  "target": "CD3",
                  "year": 2004
              },
              {
                  "count": 15,
                  "target": "PI3K",
                  "year": 2004
              },
              {
                  "count": 9,
                  "target": "MET",
                  "year": 2004
              },
              {
                  "count": 8,
                  "target": "CD20",
                  "year": 2004
              },
              {
                  "count": 6,
                  "target": "IL6",
                  "year": 2004
              },
              {
                  "count": 3,
                  "target": "CD19",
                  "year": 2004
              },
              {
                  "count": 2,
                  "target": "KRAS",
                  "year": 2004
              },
              {
                  "count": 1,
                  "target": "BTK",
                  "year": 2004
              },
              {
                  "count": 1,
                  "target": "PD-1",
                  "year": 2004
              },
              {
                  "count": 1,
                  "target": "PD-L1",
                  "year": 2004
              },
              {
                  "count": 89,
                  "target": "TNF",
                  "year": 2003
              },
              {
                  "count": 86,
                  "target": "COX-2",
                  "year": 2003
              },
              {
                  "count": 47,
                  "target": "EGFR",
                  "year": 2003
              },
              {
                  "count": 46,
                  "target": "VEGF",
                  "year": 2003
              },
              {
                  "count": 45,
                  "target": "PDE4",
                  "year": 2003
              },
              {
                  "count": 39,
                  "target": "HER2",
                  "year": 2003
              },
              {
                  "count": 37,
                  "target": "DPP4",
                  "year": 2003
              },
              {
                  "count": 32,
                  "target": "AR",
                  "year": 2003
              },
              {
                  "count": 28,
                  "target": "HDAC",
                  "year": 2003
              },
              {
                  "count": 22,
                  "target": "TP53",
                  "year": 2003
              },
              {
                  "count": 17,
                  "target": "IL6",
                  "year": 2003
              },
              {
                  "count": 12,
                  "target": "CD3",
                  "year": 2003
              },
              {
                  "count": 8,
                  "target": "MET",
                  "year": 2003
              },
              {
                  "count": 8,
                  "target": "PI3K",
                  "year": 2003
              },
              {
                  "count": 7,
                  "target": "CD20",
                  "year": 2003
              },
              {
                  "count": 4,
                  "target": "KRAS",
                  "year": 2003
              },
              {
                  "count": 2,
                  "target": "CD19",
                  "year": 2003
              },
              {
                  "count": 1,
                  "target": "BTK",
                  "year": 2003
              },
              {
                  "count": 1,
                  "target": "PD-1",
                  "year": 2003
              },
              {
                  "count": 1,
                  "target": "PD-L1",
                  "year": 2003
              },
              {
                  "count": 63,
                  "target": "COX-2",
                  "year": 2002
              },
              {
                  "count": 61,
                  "target": "TNF",
                  "year": 2002
              },
              {
                  "count": 50,
                  "target": "EGFR",
                  "year": 2002
              },
              {
                  "count": 42,
                  "target": "VEGF",
                  "year": 2002
              },
              {
                  "count": 38,
                  "target": "PDE4",
                  "year": 2002
              },
              {
                  "count": 35,
                  "target": "HER2",
                  "year": 2002
              },
              {
                  "count": 28,
                  "target": "TP53",
                  "year": 2002
              },
              {
                  "count": 20,
                  "target": "AR",
                  "year": 2002
              },
              {
                  "count": 20,
                  "target": "HDAC",
                  "year": 2002
              },
              {
                  "count": 18,
                  "target": "IL6",
                  "year": 2002
              },
              {
                  "count": 16,
                  "target": "DPP4",
                  "year": 2002
              },
              {
                  "count": 9,
                  "target": "MET",
                  "year": 2002
              },
              {
                  "count": 5,
                  "target": "CD20",
                  "year": 2002
              },
              {
                  "count": 5,
                  "target": "CD3",
                  "year": 2002
              },
              {
                  "count": 4,
                  "target": "CD19",
                  "year": 2002
              },
              {
                  "count": 4,
                  "target": "PD-1",
                  "year": 2002
              },
              {
                  "count": 3,
                  "target": "BTK",
                  "year": 2002
              },
              {
                  "count": 3,
                  "target": "PI3K",
                  "year": 2002
              },
              {
                  "count": 1,
                  "target": "KRAS",
                  "year": 2002
              },
              {
                  "count": 1,
                  "target": "PD-L1",
                  "year": 2002
              },
              {
                  "count": 79,
                  "target": "TNF",
                  "year": 2001
              },
              {
                  "count": 62,
                  "target": "COX-2",
                  "year": 2001
              },
              {
                  "count": 45,
                  "target": "PDE4",
                  "year": 2001
              },
              {
                  "count": 33,
                  "target": "HER2",
                  "year": 2001
              },
              {
                  "count": 28,
                  "target": "VEGF",
                  "year": 2001
              },
              {
                  "count": 18,
                  "target": "EGFR",
                  "year": 2001
              },
              {
                  "count": 17,
                  "target": "CD20",
                  "year": 2001
              },
              {
                  "count": 16,
                  "target": "AR",
                  "year": 2001
              },
              {
                  "count": 16,
                  "target": "TP53",
                  "year": 2001
              },
              {
                  "count": 14,
                  "target": "DPP4",
                  "year": 2001
              },
              {
                  "count": 11,
                  "target": "CD3",
                  "year": 2001
              },
              {
                  "count": 11,
                  "target": "IL6",
                  "year": 2001
              },
              {
                  "count": 10,
                  "target": "PI3K",
                  "year": 2001
              },
              {
                  "count": 8,
                  "target": "MET",
                  "year": 2001
              },
              {
                  "count": 5,
                  "target": "CD19",
                  "year": 2001
              },
              {
                  "count": 5,
                  "target": "HDAC",
                  "year": 2001
              },
              {
                  "count": 2,
                  "target": "KRAS",
                  "year": 2001
              },
              {
                  "count": 1,
                  "target": "BTK",
                  "year": 2001
              },
              {
                  "count": 1,
                  "target": "PD-1",
                  "year": 2001
              },
              {
                  "count": 63,
                  "target": "TNF",
                  "year": 2000
              },
              {
                  "count": 47,
                  "target": "COX-2",
                  "year": 2000
              },
              {
                  "count": 37,
                  "target": "PDE4",
                  "year": 2000
              },
              {
                  "count": 36,
                  "target": "VEGF",
                  "year": 2000
              },
              {
                  "count": 18,
                  "target": "EGFR",
                  "year": 2000
              },
              {
                  "count": 18,
                  "target": "HER2",
                  "year": 2000
              },
              {
                  "count": 12,
                  "target": "TP53",
                  "year": 2000
              },
              {
                  "count": 9,
                  "target": "CD20",
                  "year": 2000
              },
              {
                  "count": 9,
                  "target": "IL6",
                  "year": 2000
              },
              {
                  "count": 7,
                  "target": "AR",
                  "year": 2000
              },
              {
                  "count": 7,
                  "target": "CD3",
                  "year": 2000
              },
              {
                  "count": 5,
                  "target": "DPP4",
                  "year": 2000
              },
              {
                  "count": 5,
                  "target": "HDAC",
                  "year": 2000
              },
              {
                  "count": 3,
                  "target": "CD19",
                  "year": 2000
              },
              {
                  "count": 3,
                  "target": "MET",
                  "year": 2000
              },
              {
                  "count": 2,
                  "target": "KRAS",
                  "year": 2000
              },
              {
                  "count": 1,
                  "target": "BTK",
                  "year": 2000
              },
              {
                  "count": 1,
                  "target": "PI3K",
                  "year": 2000
              },
              {
                  "count": 66,
                  "target": "TNF",
                  "year": 1999
              },
              {
                  "count": 33,
                  "target": "COX-2",
                  "year": 1999
              },
              {
                  "count": 28,
                  "target": "PDE4",
                  "year": 1999
              },
              {
                  "count": 21,
                  "target": "VEGF",
                  "year": 1999
              },
              {
                  "count": 15,
                  "target": "EGFR",
                  "year": 1999
              },
              {
                  "count": 12,
                  "target": "IL6",
                  "year": 1999
              },
              {
                  "count": 12,
                  "target": "TP53",
                  "year": 1999
              },
              {
                  "count": 11,
                  "target": "HER2",
                  "year": 1999
              },
              {
                  "count": 9,
                  "target": "CD3",
                  "year": 1999
              },
              {
                  "count": 7,
                  "target": "DPP4",
                  "year": 1999
              },
              {
                  "count": 7,
                  "target": "KRAS",
                  "year": 1999
              },
              {
                  "count": 4,
                  "target": "MET",
                  "year": 1999
              },
              {
                  "count": 2,
                  "target": "AR",
                  "year": 1999
              },
              {
                  "count": 2,
                  "target": "BTK",
                  "year": 1999
              },
              {
                  "count": 2,
                  "target": "CD19",
                  "year": 1999
              },
              {
                  "count": 1,
                  "target": "CD20",
                  "year": 1999
              },
              {
                  "count": 1,
                  "target": "HDAC",
                  "year": 1999
              },
              {
                  "count": 61,
                  "target": "TNF",
                  "year": 1998
              },
              {
                  "count": 25,
                  "target": "COX-2",
                  "year": 1998
              },
              {
                  "count": 23,
                  "target": "PDE4",
                  "year": 1998
              },
              {
                  "count": 23,
                  "target": "VEGF",
                  "year": 1998
              },
              {
                  "count": 17,
                  "target": "EGFR",
                  "year": 1998
              },
              {
                  "count": 13,
                  "target": "HER2",
                  "year": 1998
              },
              {
                  "count": 12,
                  "target": "IL6",
                  "year": 1998
              },
              {
                  "count": 8,
                  "target": "TP53",
                  "year": 1998
              },
              {
                  "count": 4,
                  "target": "AR",
                  "year": 1998
              },
              {
                  "count": 4,
                  "target": "CD3",
                  "year": 1998
              },
              {
                  "count": 4,
                  "target": "DPP4",
                  "year": 1998
              },
              {
                  "count": 4,
                  "target": "HDAC",
                  "year": 1998
              },
              {
                  "count": 3,
                  "target": "KRAS",
                  "year": 1998
              },
              {
                  "count": 2,
                  "target": "MET",
                  "year": 1998
              },
              {
                  "count": 1,
                  "target": "CD20",
                  "year": 1998
              },
              {
                  "count": 1,
                  "target": "PI3K",
                  "year": 1998
              },
              {
                  "count": 52,
                  "target": "TNF",
                  "year": 1997
              },
              {
                  "count": 29,
                  "target": "COX-2",
                  "year": 1997
              },
              {
                  "count": 23,
                  "target": "PDE4",
                  "year": 1997
              },
              {
                  "count": 18,
                  "target": "VEGF",
                  "year": 1997
              },
              {
                  "count": 11,
                  "target": "EGFR",
                  "year": 1997
              },
              {
                  "count": 10,
                  "target": "TP53",
                  "year": 1997
              },
              {
                  "count": 9,
                  "target": "HER2",
                  "year": 1997
              },
              {
                  "count": 7,
                  "target": "AR",
                  "year": 1997
              },
              {
                  "count": 7,
                  "target": "IL6",
                  "year": 1997
              },
              {
                  "count": 4,
                  "target": "CD3",
                  "year": 1997
              },
              {
                  "count": 3,
                  "target": "KRAS",
                  "year": 1997
              },
              {
                  "count": 2,
                  "target": "HDAC",
                  "year": 1997
              },
              {
                  "count": 1,
                  "target": "DPP4",
                  "year": 1997
              },
              {
                  "count": 1,
                  "target": "PI3K",
                  "year": 1997
              },
              {
                  "count": 65,
                  "target": "TNF",
                  "year": 1996
              },
              {
                  "count": 26,
                  "target": "COX-2",
                  "year": 1996
              },
              {
                  "count": 19,
                  "target": "EGFR",
                  "year": 1996
              },
              {
                  "count": 19,
                  "target": "PDE4",
                  "year": 1996
              },
              {
                  "count": 12,
                  "target": "HER2",
                  "year": 1996
              },
              {
                  "count": 9,
                  "target": "IL6",
                  "year": 1996
              },
              {
                  "count": 8,
                  "target": "CD3",
                  "year": 1996
              },
              {
                  "count": 8,
                  "target": "VEGF",
                  "year": 1996
              },
              {
                  "count": 6,
                  "target": "TP53",
                  "year": 1996
              },
              {
                  "count": 4,
                  "target": "CD19",
                  "year": 1996
              },
              {
                  "count": 2,
                  "target": "AR",
                  "year": 1996
              },
              {
                  "count": 2,
                  "target": "MET",
                  "year": 1996
              },
              {
                  "count": 1,
                  "target": "DPP4",
                  "year": 1996
              },
              {
                  "count": 1,
                  "target": "PI3K",
                  "year": 1996
              },
              {
                  "count": 41,
                  "target": "TNF",
                  "year": 1995
              },
              {
                  "count": 29,
                  "target": "PDE4",
                  "year": 1995
              },
              {
                  "count": 9,
                  "target": "EGFR",
                  "year": 1995
              },
              {
                  "count": 7,
                  "target": "COX-2",
                  "year": 1995
              },
              {
                  "count": 7,
                  "target": "TP53",
                  "year": 1995
              },
              {
                  "count": 6,
                  "target": "HER2",
                  "year": 1995
              },
              {
                  "count": 5,
                  "target": "VEGF",
                  "year": 1995
              },
              {
                  "count": 4,
                  "target": "AR",
                  "year": 1995
              },
              {
                  "count": 3,
                  "target": "DPP4",
                  "year": 1995
              },
              {
                  "count": 3,
                  "target": "IL6",
                  "year": 1995
              },
              {
                  "count": 2,
                  "target": "CD3",
                  "year": 1995
              },
              {
                  "count": 2,
                  "target": "MET",
                  "year": 1995
              },
              {
                  "count": 2,
                  "target": "PI3K",
                  "year": 1995
              },
              {
                  "count": 21,
                  "target": "TNF",
                  "year": 1994
              },
              {
                  "count": 9,
                  "target": "PDE4",
                  "year": 1994
              },
              {
                  "count": 8,
                  "target": "TP53",
                  "year": 1994
              },
              {
                  "count": 4,
                  "target": "AR",
                  "year": 1994
              },
              {
                  "count": 3,
                  "target": "EGFR",
                  "year": 1994
              },
              {
                  "count": 3,
                  "target": "HER2",
                  "year": 1994
              },
              {
                  "count": 2,
                  "target": "CD20",
                  "year": 1994
              },
              {
                  "count": 2,
                  "target": "CD3",
                  "year": 1994
              },
              {
                  "count": 2,
                  "target": "COX-2",
                  "year": 1994
              },
              {
                  "count": 2,
                  "target": "DPP4",
                  "year": 1994
              },
              {
                  "count": 2,
                  "target": "IL6",
                  "year": 1994
              },
              {
                  "count": 2,
                  "target": "KRAS",
                  "year": 1994
              },
              {
                  "count": 2,
                  "target": "VEGF",
                  "year": 1994
              },
              {
                  "count": 1,
                  "target": "MET",
                  "year": 1994
              },
              {
                  "count": 19,
                  "target": "TNF",
                  "year": 1993
              },
              {
                  "count": 10,
                  "target": "PDE4",
                  "year": 1993
              },
              {
                  "count": 7,
                  "target": "CD3",
                  "year": 1993
              },
              {
                  "count": 6,
                  "target": "HER2",
                  "year": 1993
              },
              {
                  "count": 3,
                  "target": "EGFR",
                  "year": 1993
              },
              {
                  "count": 1,
                  "target": "AR",
                  "year": 1993
              },
              {
                  "count": 1,
                  "target": "CD19",
                  "year": 1993
              },
              {
                  "count": 1,
                  "target": "CD20",
                  "year": 1993
              },
              {
                  "count": 1,
                  "target": "DPP4",
                  "year": 1993
              },
              {
                  "count": 1,
                  "target": "IL6",
                  "year": 1993
              },
              {
                  "count": 1,
                  "target": "MET",
                  "year": 1993
              },
              {
                  "count": 1,
                  "target": "TP53",
                  "year": 1993
              },
              {
                  "count": 1,
                  "target": "VEGF",
                  "year": 1993
              },
              {
                  "count": 23,
                  "target": "TNF",
                  "year": 1992
              },
              {
                  "count": 5,
                  "target": "PDE4",
                  "year": 1992
              },
              {
                  "count": 3,
                  "target": "AR",
                  "year": 1992
              },
              {
                  "count": 3,
                  "target": "CD3",
                  "year": 1992
              },
              {
                  "count": 3,
                  "target": "HER2",
                  "year": 1992
              },
              {
                  "count": 2,
                  "target": "EGFR",
                  "year": 1992
              },
              {
                  "count": 1,
                  "target": "MET",
                  "year": 1992
              },
              {
                  "count": 16,
                  "target": "TNF",
                  "year": 1991
              },
              {
                  "count": 6,
                  "target": "EGFR",
                  "year": 1991
              },
              {
                  "count": 4,
                  "target": "HER2",
                  "year": 1991
              },
              {
                  "count": 3,
                  "target": "IL6",
                  "year": 1991
              },
              {
                  "count": 2,
                  "target": "CD3",
                  "year": 1991
              },
              {
                  "count": 2,
                  "target": "PDE4",
                  "year": 1991
              },
              {
                  "count": 1,
                  "target": "AR",
                  "year": 1991
              },
              {
                  "count": 1,
                  "target": "DPP4",
                  "year": 1991
              },
              {
                  "count": 1,
                  "target": "VEGF",
                  "year": 1991
              },
              {
                  "count": 17,
                  "target": "TNF",
                  "year": 1990
              },
              {
                  "count": 3,
                  "target": "AR",
                  "year": 1990
              },
              {
                  "count": 2,
                  "target": "IL6",
                  "year": 1990
              },
              {
                  "count": 2,
                  "target": "VEGF",
                  "year": 1990
              },
              {
                  "count": 1,
                  "target": "CD3",
                  "year": 1990
              },
              {
                  "count": 1,
                  "target": "EGFR",
                  "year": 1990
              },
              {
                  "count": 1,
                  "target": "MET",
                  "year": 1990
              },
              {
                  "count": 1,
                  "target": "PDE4",
                  "year": 1990
              },
              {
                  "count": 1,
                  "target": "TP53",
                  "year": 1990
              },
              {
                  "count": 3,
                  "target": "TNF",
                  "year": 1989
              },
              {
                  "count": 2,
                  "target": "HER2",
                  "year": 1989
              },
              {
                  "count": 1,
                  "target": "EGFR",
                  "year": 1989
              },
              {
                  "count": 1,
                  "target": "AR",
                  "year": 1988
              },
              {
                  "count": 1,
                  "target": "EGFR",
                  "year": 1988
              },
              {
                  "count": 1,
                  "target": "IL6",
                  "year": 1988
              },
              {
                  "count": 1,
                  "target": "KRAS",
                  "year": 1988
              },
              {
                  "count": 1,
                  "target": "TNF",
                  "year": 1988
              },
              {
                  "count": 2,
                  "target": "TNF",
                  "year": 1987
              },
              {
                  "count": 3,
                  "target": "TNF",
                  "year": 1986
              },
              {
                  "count": 1,
                  "target": "AR",
                  "year": 1986
              },
              {
                  "count": 1,
                  "target": "AR",
                  "year": 1985
              },
              {
                  "count": 1,
                  "target": "AR",
                  "year": 1983
              }
          ],
          "patent_per_office": [
              {
                  "count": 214429,
                  "patent_type": "method of treatment"
              },
              {
                  "count": 194908,
                  "patent_type": "substance"
              },
              {
                  "count": 3008,
                  "patent_type": "crystal"
              },
              {
                  "count": 2295,
                  "patent_type": "salt"
              },
              {
                  "count": 41,
                  "patent_type": "method"
              },
              {
                  "count": 13,
                  "patent_type": "biomarker"
              },
              {
                  "count": 5,
                  "patent_type": "method of manufacture"
              },
              {
                  "count": 4,
                  "patent_type": "marker"
              },
              {
                  "count": 4,
                  "patent_type": "method of use"
              },
              {
                  "count": 2,
                  "patent_type": "protein"
              },
              {
                  "count": 2,
                  "patent_type": "method of production"
              },
              {
                  "count": 2,
                  "patent_type": "target"
              },
              {
                  "count": 1,
                  "patent_type": "composition"
              },
              {
                  "count": 1,
                  "patent_type": "method of selection"
              },
              {
                  "count": 1,
                  "patent_type": "method of diagnosis"
              },
              {
                  "count": 1,
                  "patent_type": "structure"
              },
              {
                  "count": 1,
                  "patent_type": "therapeutic target"
              },
              {
                  "count": 1,
                  "patent_type": "combination"
              },
              {
                  "count": 1,
                  "patent_type": "biotarget"
              },
              {
                  "count": 1,
                  "patent_type": "method of detection"
              },
              {
                  "count": 1,
                  "patent_type": "method of manufacturing"
              },
              {
                  "count": 1,
                  "patent_type": "subunit vaccine"
              }
          ],
          "patent_type_counts": [
              {
                  "count": 214429,
                  "patent_type": "method of treatment"
              },
              {
                  "count": 194908,
                  "patent_type": "substance"
              },
              {
                  "count": 3008,
                  "patent_type": "crystal"
              },
              {
                  "count": 2295,
                  "patent_type": "salt"
              },
              {
                  "count": 41,
                  "patent_type": "method"
              },
              {
                  "count": 13,
                  "patent_type": "biomarker"
              },
              {
                  "count": 5,
                  "patent_type": "method of manufacture"
              },
              {
                  "count": 4,
                  "patent_type": "marker"
              },
              {
                  "count": 4,
                  "patent_type": "method of use"
              },
              {
                  "count": 2,
                  "patent_type": "protein"
              },
              {
                  "count": 2,
                  "patent_type": "method of production"
              },
              {
                  "count": 2,
                  "patent_type": "target"
              },
              {
                  "count": 1,
                  "patent_type": "composition"
              },
              {
                  "count": 1,
                  "patent_type": "method of selection"
              },
              {
                  "count": 1,
                  "patent_type": "method of diagnosis"
              },
              {
                  "count": 1,
                  "patent_type": "structure"
              },
              {
                  "count": 1,
                  "patent_type": "therapeutic target"
              },
              {
                  "count": 1,
                  "patent_type": "combination"
              },
              {
                  "count": 1,
                  "patent_type": "biotarget"
              },
              {
                  "count": 1,
                  "patent_type": "method of detection"
              },
              {
                  "count": 1,
                  "patent_type": "method of manufacturing"
              },
              {
                  "count": 1,
                  "patent_type": "subunit vaccine"
              }
          ],
          "total_count": 426029
      },
      "message": "특허 통계 데이터가 성공적으로 조회되었습니다."
}

    ```
