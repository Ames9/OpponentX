import json
import gc
import pandas as pd

# ---- 設定 ----
ALL_YEARS = list(range(2016, 2026))

print("Importing Schedule data...")
sched_all = pd.read_csv("https://github.com/nflverse/nfldata/raw/master/data/games.csv")
sched = sched_all[sched_all['season'].isin(ALL_YEARS)].copy()
print(f"  {len(sched)} games in {ALL_YEARS}")

# SHUFFLE
sched = sched.sample(frac=1, random_state=42).reset_index(drop=True)

# 年ごとのgame_idセット
sched_by_year = {y: set(sched[sched['season'] == y]['game_id'].tolist()) for y in ALL_YEARS}


def safe_sum(val):
    try:
        v = float(val)
        return int(v) if pd.notna(v) else 0
    except Exception:
        return 0


def get_quarter_scores(game_pbp, home_team, away_team):
    home_qs = [0, 0, 0, 0]
    away_qs = [0, 0, 0, 0]
    for q in range(1, 6):
        q_plays = game_pbp[game_pbp['qtr'] == q]
        if len(q_plays) == 0:
            if q > 4:
                break
            continue
        last_play = q_plays.iloc[-1]
        if 'home_score_post' in last_play.index:
            current_h = safe_sum(last_play['home_score_post'])
            current_a = safe_sum(last_play['away_score_post'])
        else:
            current_h = safe_sum(last_play['total_home_score'])
            current_a = safe_sum(last_play['total_away_score'])
        if q == 1:
            home_qs[0] = current_h
            away_qs[0] = current_a
        else:
            prev_h = sum(home_qs[:q-1])
            prev_a = sum(away_qs[:q-1])
            if q <= 4:
                home_qs[q-1] = current_h - prev_h
                away_qs[q-1] = current_a - prev_a
            else:
                home_qs.append(current_h - prev_h)
                away_qs.append(current_a - prev_a)
    return home_qs, away_qs


def _add_from_player_stats(results, stats_lookup, season, week, team_name, team_key):
    if stats_lookup is None:
        return False
    try:
        team_s = stats_lookup.get_group((season, week, team_name))
    except KeyError:
        return False

    passers = team_s[
        team_s['passing_yards'].notna() & (team_s['passing_yards'] > 0)
    ].sort_values('passing_yards', ascending=False)
    if len(passers) > 0:
        p = passers.iloc[0]
        name_col = 'player_display_name' if 'player_display_name' in p.index else 'player_name'
        name = str(p[name_col]) if name_col in p.index else ''
        if name and name != 'nan':
            atts = safe_sum(p['attempts']) if 'attempts' in p.index else 0
            yds = safe_sum(p['passing_yards'])
            tds = safe_sum(p['passing_tds']) if 'passing_tds' in p.index else 0
            ints = safe_sum(p['interceptions']) if 'interceptions' in p.index else 0
            results.append({
                "team": team_key, "position": "QB", "playerName": name,
                "statLine": f"{atts} Att, {yds} Yds, {tds} TD, {ints} INT"
            })

    rushers = team_s[
        team_s['rushing_yards'].notna() & (team_s['rushing_yards'] > 0)
    ].sort_values('rushing_yards', ascending=False)
    if len(rushers) > 0:
        r = rushers.iloc[0]
        name_col = 'player_display_name' if 'player_display_name' in r.index else 'player_name'
        name = str(r[name_col]) if name_col in r.index else ''
        if name and name != 'nan':
            carries = safe_sum(r['carries']) if 'carries' in r.index else 0
            yds = safe_sum(r['rushing_yards'])
            tds = safe_sum(r['rushing_tds']) if 'rushing_tds' in r.index else 0
            results.append({
                "team": team_key, "position": "RB", "playerName": name,
                "statLine": f"{carries} Car, {yds} Yds, {tds} TD"
            })

    recvs = team_s[
        team_s['receiving_yards'].notna() & (team_s['receiving_yards'] > 0)
    ].sort_values('receiving_yards', ascending=False)
    if len(recvs) > 0:
        re = recvs.iloc[0]
        name_col = 'player_display_name' if 'player_display_name' in re.index else 'player_name'
        name = str(re[name_col]) if name_col in re.index else ''
        if name and name != 'nan':
            pos = str(re['position']) if 'position' in re.index and str(re['position']) not in ('nan', '') else 'REC'
            recs = safe_sum(re['receptions']) if 'receptions' in re.index else 0
            yds = safe_sum(re['receiving_yards'])
            tds = safe_sum(re['receiving_tds']) if 'receiving_tds' in re.index else 0
            results.append({
                "team": team_key, "position": pos, "playerName": name,
                "statLine": f"{recs} Rec, {yds} Yds, {tds} TD"
            })
    return True


def _add_from_pbp(results, game_pbp, team_name, team_key):
    passers_pbp = game_pbp[game_pbp['play_type'] == 'pass'].groupby(
        ['posteam', 'passer_player_name']
    ).agg(
        yds=('passing_yards', 'sum'), tds=('pass_touchdown', 'sum'),
        ints=('interception', 'sum'), atts=('play_id', 'count')
    ).reset_index().sort_values('yds', ascending=False)

    rushers_pbp = game_pbp[game_pbp['play_type'] == 'run'].groupby(
        ['posteam', 'rusher_player_name']
    ).agg(
        yds=('rushing_yards', 'sum'), tds=('rush_touchdown', 'sum'), carries=('play_id', 'count')
    ).reset_index().sort_values('yds', ascending=False)

    receivers_pbp = game_pbp[game_pbp['play_type'] == 'pass'].groupby(
        ['posteam', 'receiver_player_name']
    ).agg(
        yds=('receiving_yards', 'sum'), tds=('pass_touchdown', 'sum'), recs=('complete_pass', 'sum')
    ).reset_index().sort_values('yds', ascending=False)

    tp = passers_pbp[passers_pbp['posteam'] == team_name]
    if len(tp) > 0 and str(tp.iloc[0]['passer_player_name']) != 'nan':
        p = tp.iloc[0]
        results.append({
            "team": team_key, "position": "QB",
            "playerName": str(p['passer_player_name']),
            "statLine": f"{safe_sum(p['atts'])} Att, {safe_sum(p['yds'])} Yds, {safe_sum(p['tds'])} TD, {safe_sum(p['ints'])} INT"
        })
    tr = rushers_pbp[rushers_pbp['posteam'] == team_name]
    if len(tr) > 0 and str(tr.iloc[0]['rusher_player_name']) != 'nan':
        r = tr.iloc[0]
        results.append({
            "team": team_key, "position": "RB",
            "playerName": str(r['rusher_player_name']),
            "statLine": f"{safe_sum(r['carries'])} Car, {safe_sum(r['yds'])} Yds, {safe_sum(r['tds'])} TD"
        })
    trec = receivers_pbp[receivers_pbp['posteam'] == team_name]
    if len(trec) > 0 and str(trec.iloc[0]['receiver_player_name']) != 'nan':
        re = trec.iloc[0]
        results.append({
            "team": team_key, "position": "REC",
            "playerName": str(re['receiver_player_name']),
            "statLine": f"{safe_sum(re['recs'])} Rec, {safe_sum(re['yds'])} Yds, {safe_sum(re['tds'])} TD"
        })


def get_top_performers(season, week, home_team, away_team, game_pbp, stats_lookup):
    results = []
    for team_name, team_key in [(home_team, "baseTeam"), (away_team, "opponentTeam")]:
        ok = _add_from_player_stats(results, stats_lookup, season, week, team_name, team_key)
        if not ok:
            _add_from_pbp(results, game_pbp, team_name, team_key)
    return results


def get_tds(game_pbp, team_name):
    mask = (game_pbp['touchdown'] == 1) & (game_pbp['td_team'] == team_name)
    return game_pbp[mask]['desc'].dropna().tolist()


# ---- 年ごとにPBP・Stats読み込み→処理→即解放 ----
games_data = []
print(f"\nProcessing {len(sched)} games across {len(ALL_YEARS)} seasons...")

for y in ALL_YEARS:
    year_game_ids = sched_by_year.get(y, set())
    if not year_game_ids:
        continue

    year_sched = sched[sched['season'] == y]

    # PBP読み込み
    try:
        print(f"Loading {y} PBP...")
        pbp_raw = pd.read_parquet(
            f"https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{y}.parquet"
        )
        pbp_year = pbp_raw[pbp_raw['game_id'].isin(year_game_ids)].copy()
        del pbp_raw
        gc.collect()
        print(f"  {y}: {len(pbp_year)} plays for {len(year_game_ids)} games")
    except Exception as e:
        print(f"  Skipping PBP {y}: {e}")
        continue

    # Player Stats読み込み
    stats_lookup = None
    try:
        print(f"Loading {y} Player Stats...")
        stats_raw = pd.read_parquet(
            f"https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_{y}.parquet"
        )
        if 'season_type' in stats_raw.columns:
            stats_raw = stats_raw[stats_raw['season_type'] == 'REG']
        stats_lookup = stats_raw.groupby(['season', 'week', 'recent_team'])
        print(f"  {y}: {len(stats_raw)} player rows")
        del stats_raw
        gc.collect()
    except Exception as e:
        print(f"  Skipping Stats {y}: {e}")

    # ゲーム処理
    pbp_grouped = pbp_year.groupby('game_id')

    for idx, row in year_sched.iterrows():
        game_id = row['game_id']
        home_team = row['home_team']
        away_team = row['away_team']
        season = int(row['season'])
        week = int(row['week'])
        espn_id = row.get('espn', None)
        espn_url = f"https://www.espn.com/nfl/game/_/gameId/{int(espn_id)}" if pd.notna(espn_id) and espn_id else None

        try:
            game_pbp = pbp_grouped.get_group(game_id)
        except KeyError:
            continue

        h_pass = safe_sum(game_pbp.loc[(game_pbp['posteam'] == home_team) & (game_pbp['play_type'] == 'pass'), 'passing_yards'].sum())
        a_pass = safe_sum(game_pbp.loc[(game_pbp['posteam'] == away_team) & (game_pbp['play_type'] == 'pass'), 'passing_yards'].sum())
        h_rush = safe_sum(game_pbp.loc[(game_pbp['posteam'] == home_team) & (game_pbp['play_type'] == 'run'), 'rushing_yards'].sum())
        a_rush = safe_sum(game_pbp.loc[(game_pbp['posteam'] == away_team) & (game_pbp['play_type'] == 'run'), 'rushing_yards'].sum())
        h_to = safe_sum(game_pbp.loc[(game_pbp['posteam'] == home_team) & ((game_pbp['interception'] == 1) | (game_pbp['fumble_lost'] == 1)), 'play_id'].count())
        a_to = safe_sum(game_pbp.loc[(game_pbp['posteam'] == away_team) & ((game_pbp['interception'] == 1) | (game_pbp['fumble_lost'] == 1)), 'play_id'].count())

        home_qs, away_qs = get_quarter_scores(game_pbp, home_team, away_team)
        hint3 = get_top_performers(season, week, home_team, away_team, game_pbp, stats_lookup)

        games_data.append({
            "gameId": game_id,
            "season": season,
            "week": week,
            "espnUrl": espn_url,
            "baseTeam": home_team,
            "opponentTeam": away_team,
            "isHome": True,
            "hints": {
                "hint1_teamStats": {
                    "baseTeam": {"passYds": h_pass, "rushYds": h_rush, "turnovers": h_to},
                    "opponentTeam": {"passYds": a_pass, "rushYds": a_rush, "turnovers": a_to}
                },
                "hint2_qByQ": {
                    "baseTeam": home_qs, "baseTotal": sum(home_qs),
                    "opponentTeam": away_qs, "opponentTotal": sum(away_qs)
                },
                "hint2_tds": {
                    "baseTeam": get_tds(game_pbp, home_team),
                    "opponentTeam": get_tds(game_pbp, away_team)
                },
                "hint3_topPerformers": hint3
            }
        })

        if len(games_data) % 50 == 0:
            print(f"  Processed {len(games_data)} games...")

    del pbp_year, pbp_grouped
    gc.collect()
    print(f"  {y} done. Total so far: {len(games_data)} games")

print(f"\nSaving to src/data/games.json...")
with open('src/data/games.json', 'w') as f:
    json.dump(games_data, f)
print(f"Done! {len(games_data)} games saved.")
