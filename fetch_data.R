library(nflreadr)
library(dplyr)
library(tidyr)
library(jsonlite)
library(purrr)

options(timeout=300)

cat("Loading NFL data (2021-2026)...\n")
years <- 2021:2026

# Load player stats and play-by-play data
player_stats <- load_player_stats(years)
pbp <- load_pbp(years)
schedules <- load_schedules(years)

# 1. Team stats (Pass Yds, Rush Yds, Turnovers)
# We can aggregate from pbp or player_stats. simple aggregation over pbp:
team_totals <- pbp %>%
  filter(!is.na(posteam)) %>%
  group_by(game_id, posteam) %>%
  summarize(
    rushYds = sum(rushing_yards, na.rm = TRUE),
    passYds = sum(passing_yards, na.rm = TRUE),
    turnovers = sum(interception, na.rm = TRUE) + sum(fumble_lost, na.rm = TRUE),
    .groups = "drop"
  )

# 2. Quarter by Quarter scores
qtr_scores <- pbp %>%
  filter(!is.na(posteam), play_type %in% c("pass", "run", "field_goal", "extra_point")) %>%
  group_by(game_id, qtr, posteam) %>%
  summarise(
    points = sum(
      case_when(
        touchdown == 1 & td_team == posteam ~ 6,
        field_goal_result == "made" ~ 3,
        extra_point_result == "good" ~ 1,
        two_point_conv_result == "success" ~ 2,
        TRUE ~ 0
      )
    ),
    .groups = "drop"
  )
  
cat("データ抽出ロジック（ベース）の読み込みが完了しました。\n")
cat("今後はこのデータを元に、指定されたゲームIDを抽出し games.json へ書き出します。\n")
