"""
Backend regression tests for Board Game Score API.
Covers: auth, catalog, game lifecycle (incl. teams + lowest), history, players, websocket, achievements.
"""
import os
import json
import time
import uuid
import asyncio
import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@boardgame.app")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_token(s):
    # Reset state first via abandon (after admin login)
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    body = r.json()
    assert "access_token" in body and body["role"] == "admin"
    assert "password_hash" not in body
    token = body["access_token"]
    # Cleanup any leftover game
    s.post(f"{API}/game/abandon", headers={"Authorization": f"Bearer {token}"})
    return token


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Health / Catalog ----------
class TestBasics:
    def test_auth_me_requires_auth(self, s):
        # Use bare requests to avoid cookies from session
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_catalog_has_seeded_games(self):
        r = requests.get(f"{API}/catalog")
        assert r.status_code == 200
        items = r.json()
        names = {it["name"] for it in items}
        for required in ["Catan", "Monopoly", "Scrabble", "Golf (Cards)", "Yahtzee"]:
            assert required in names, f"Missing seeded game: {required}; got {names}"

    def test_achievements_definitions(self):
        r = requests.get(f"{API}/achievements/definitions")
        assert r.status_code == 200
        defs = r.json()
        ids = {d["id"] for d in defs}
        assert {"first_win", "five_wins", "ten_wins", "veteran"}.issubset(ids)


# ---------- Auth ----------
class TestAuth:
    def test_login_wrong_password(self):
        # Use unique email to avoid hitting brute-force lockout for admin@
        r = requests.post(f"{API}/auth/login", json={"email": "nobody-xyz@example.com", "password": "wrong"})
        assert r.status_code == 401

    def test_auth_me_with_bearer(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == ADMIN_EMAIL
        assert u["role"] == "admin"
        assert "password_hash" not in u

    def test_register_new_user(self):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Passw0rd!", "name": "Tester"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["email"] == email
        assert body["role"] == "user"
        assert "access_token" in body
        # /auth/me with token
        r2 = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
        assert r2.status_code == 200
        assert r2.json()["email"] == email

    def test_brute_force_lockout(self):
        # Use unique email so it doesn't lock admin out
        email = f"locktest_{uuid.uuid4().hex[:8]}@example.com"
        # 5 wrong attempts -> 6th returns 429
        last = None
        for i in range(6):
            last = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrong"})
        # The 6th attempt should be 429 (locked) since 5 failures triggers lock
        assert last.status_code in (401, 429), f"Expected 429/401 got {last.status_code}"
        # Try again - should be 429
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrong"})
        assert r2.status_code == 429, f"Brute force lockout should trigger 429, got {r2.status_code}"


# ---------- Catalog admin permissions ----------
class TestCatalogAdmin:
    def test_non_admin_cannot_add(self):
        # register temp user
        email = f"u_{uuid.uuid4().hex[:8]}@example.com"
        rr = requests.post(f"{API}/auth/register", json={"email": email, "password": "Passw0rd!", "name": "U"})
        assert rr.status_code == 200
        tok = rr.json()["access_token"]
        r = requests.post(f"{API}/catalog", json={"name": "Hacker Game"}, headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 403

    def test_admin_add_and_delete_catalog(self, admin_headers):
        unique = f"TEST_Game_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/catalog", json={"name": unique, "default_ranking": "highest"}, headers=admin_headers)
        assert r.status_code == 200
        cid = r.json()["id"]
        # GET verify
        items = requests.get(f"{API}/catalog").json()
        assert any(it["id"] == cid for it in items)
        # delete
        d = requests.delete(f"{API}/catalog/{cid}", headers=admin_headers)
        assert d.status_code == 200
        items2 = requests.get(f"{API}/catalog").json()
        assert not any(it["id"] == cid for it in items2)


# ---------- Game lifecycle ----------
class TestGameLifecycle:
    def test_full_game_highest(self, admin_headers):
        # Ensure clean slate
        requests.post(f"{API}/game/abandon", headers=admin_headers)
        body = {
            "game_name": "TEST_HighGame",
            "ranking_order": "highest",
            "players": ["Alice", "Bob", "Carol"],
        }
        r = requests.post(f"{API}/game/start", json=body, headers=admin_headers)
        assert r.status_code == 200, r.text
        game = r.json()
        assert len(game["players"]) == 3
        keys = {p["name"]: p["key"] for p in game["players"]}
        # Submit scores
        for name, score in [("Alice", 10), ("Bob", 25), ("Carol", 15)]:
            r2 = requests.post(f"{API}/game/submit-score", json={"player_key": keys[name], "score": score}, headers=admin_headers)
            assert r2.status_code == 200
        # Round 2
        for name, score in [("Alice", 5), ("Bob", 30), ("Carol", 20)]:
            requests.post(f"{API}/game/submit-score", json={"player_key": keys[name], "score": score}, headers=admin_headers)

        # current reflects totals
        cur = requests.get(f"{API}/game/current").json()
        totals = {p["name"]: p["totalScore"] for p in cur["players"]}
        assert totals == {"Alice": 15, "Bob": 55, "Carol": 35}
        # per-player scores list
        scores = {p["name"]: p["scores"] for p in cur["players"]}
        assert scores == {"Alice": [10, 5], "Bob": [25, 30], "Carol": [15, 20]}

        # Undo Bob's last score
        ur = requests.post(f"{API}/game/undo-score", json={"player_key": keys["Bob"]}, headers=admin_headers)
        assert ur.status_code == 200
        assert ur.json()["removed"] == 30
        cur = requests.get(f"{API}/game/current").json()
        bob = next(p for p in cur["players"] if p["name"] == "Bob")
        assert bob["totalScore"] == 25
        assert bob["scores"] == [25]
        # Re-add Bob's score so Bob still wins
        requests.post(f"{API}/game/submit-score", json={"player_key": keys["Bob"], "score": 30}, headers=admin_headers)

        # End game -> Bob should win
        end = requests.post(f"{API}/game/end", headers=admin_headers)
        assert end.status_code == 200
        h = end.json()
        assert h["winner_label"] == "Bob"

        # current_game should be cleared
        cur2 = requests.get(f"{API}/game/current").json()
        assert cur2 is None

        # history includes it
        hist = requests.get(f"{API}/history").json()
        assert any(x["game_name"] == "TEST_HighGame" for x in hist)

        # players endpoint includes Bob with at least 1 win
        players = requests.get(f"{API}/players").json()
        bob = next((p for p in players if p["name"] == "Bob"), None)
        assert bob is not None
        assert bob["wins"] >= 1
        assert "first_win" in bob.get("achievements", [])

    def test_lowest_ranking_winner(self, admin_headers):
        requests.post(f"{API}/game/abandon", headers=admin_headers)
        body = {"game_name": "TEST_GolfLow", "ranking_order": "lowest", "players": ["P1", "P2"]}
        r = requests.post(f"{API}/game/start", json=body, headers=admin_headers)
        keys = {p["name"]: p["key"] for p in r.json()["players"]}
        requests.post(f"{API}/game/submit-score", json={"player_key": keys["P1"], "score": 5}, headers=admin_headers)
        requests.post(f"{API}/game/submit-score", json={"player_key": keys["P2"], "score": 50}, headers=admin_headers)
        end = requests.post(f"{API}/game/end", headers=admin_headers).json()
        assert end["winner_label"] == "P1"

    def test_team_play(self, admin_headers):
        requests.post(f"{API}/game/abandon", headers=admin_headers)
        body = {
            "game_name": "TEST_TeamGame",
            "ranking_order": "highest",
            "players": [],
            "use_teams": True,
            "teams": [
                {"name": "Red", "player_names": ["R1", "R2"]},
                {"name": "Blue", "player_names": ["B1", "B2"]},
            ],
        }
        r = requests.post(f"{API}/game/start", json=body, headers=admin_headers)
        assert r.status_code == 200, r.text
        g = r.json()
        assert g["use_teams"] == True
        assert len(g["teams"]) == 2
        assert len(g["players"]) == 4
        keys = {p["name"]: p["key"] for p in g["players"]}
        # Blue wins
        for n, sc in [("R1", 5), ("R2", 5), ("B1", 20), ("B2", 20)]:
            requests.post(f"{API}/game/submit-score", json={"player_key": keys[n], "score": sc}, headers=admin_headers)
        cur = requests.get(f"{API}/game/current").json()
        team_totals = {t["name"]: t["totalScore"] for t in cur["teams"]}
        assert team_totals == {"Red": 10, "Blue": 40}
        end = requests.post(f"{API}/game/end", headers=admin_headers).json()
        assert end["winner_label"] == "Blue"

    def test_add_player_to_active(self, admin_headers):
        requests.post(f"{API}/game/abandon", headers=admin_headers)
        r = requests.post(f"{API}/game/start", json={"game_name": "TEST_AddP", "players": ["A"]}, headers=admin_headers)
        assert r.status_code == 200
        add = requests.post(f"{API}/game/add-player", json={"name": "LateJoiner"}, headers=admin_headers)
        assert add.status_code == 200
        cur = requests.get(f"{API}/game/current").json()
        names = [p["name"] for p in cur["players"]]
        assert "LateJoiner" in names
        # cleanup
        requests.post(f"{API}/game/abandon", headers=admin_headers)

    def test_reset_and_abandon(self, admin_headers):
        requests.post(f"{API}/game/abandon", headers=admin_headers)
        r = requests.post(f"{API}/game/start", json={"game_name": "TEST_Reset", "players": ["X", "Y"]}, headers=admin_headers)
        keys = {p["name"]: p["key"] for p in r.json()["players"]}
        requests.post(f"{API}/game/submit-score", json={"player_key": keys["X"], "score": 99}, headers=admin_headers)
        # reset
        rr = requests.post(f"{API}/game/reset", headers=admin_headers)
        assert rr.status_code == 200
        cur = requests.get(f"{API}/game/current").json()
        assert all(p["totalScore"] == 0 for p in cur["players"])
        assert all(p["scores"] == [] for p in cur["players"])
        # abandon -> no current game, no history added
        hist_before = len(requests.get(f"{API}/history").json())
        requests.post(f"{API}/game/abandon", headers=admin_headers)
        assert requests.get(f"{API}/game/current").json() is None
        hist_after = len(requests.get(f"{API}/history").json())
        assert hist_after == hist_before  # abandon doesn't add to history


# ---------- Players records ----------
class TestPlayers:
    def test_players_list_and_detail(self):
        players = requests.get(f"{API}/players").json()
        assert isinstance(players, list)
        if players:
            p0 = players[0]
            assert "winRate" in p0 and "avgScore" in p0
            r = requests.get(f"{API}/players/{p0['name']}")
            assert r.status_code == 200
            data = r.json()
            assert "record" in data and "history" in data

    def test_player_not_found(self):
        r = requests.get(f"{API}/players/__nonexistent__name__xyz")
        assert r.status_code == 404


# ---------- WebSocket ----------
class TestWebSocket:
    def test_ws_connects_and_receives_initial(self, admin_headers):
        ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"

        async def _run():
            async with websockets.connect(ws_url, open_timeout=10) as ws:
                msg = await asyncio.wait_for(ws.recv(), timeout=10)
                data = json.loads(msg)
                assert data["type"] == "current_game"

        asyncio.get_event_loop().run_until_complete(_run())

    def test_ws_broadcast_on_game_start(self, admin_headers):
        requests.post(f"{API}/game/abandon", headers=admin_headers)
        ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"
        received = []

        async def _run():
            async with websockets.connect(ws_url, open_timeout=10) as ws:
                # initial
                initial = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                received.append(initial)
                # trigger start
                requests.post(f"{API}/game/start", json={"game_name": "TEST_WS", "players": ["W1"]}, headers=admin_headers)
                # next message
                nxt = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                received.append(nxt)
                requests.post(f"{API}/game/abandon", headers=admin_headers)

        asyncio.get_event_loop().run_until_complete(_run())
        assert any(m.get("type") == "current_game" and m.get("data") and m["data"].get("game_name") == "TEST_WS" for m in received)
