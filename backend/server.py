from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import asyncio
import secrets
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# -------------------------
# Setup
# -------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

app = FastAPI(title="Board Game Score API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# -------------------------
# Password / JWT
# -------------------------
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=60), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(resp: Response, access: str, refresh: str):
    resp.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    resp.set_cookie("refresh_token", refresh, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user

# -------------------------
# Models
# -------------------------
class RegisterReq(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginReq(BaseModel):
    email: EmailStr
    password: str

class GameCatalogIn(BaseModel):
    name: str
    description: str = ""
    default_ranking: str = "highest"  # highest | lowest
    icon: str = "Dice"

class StartGameReq(BaseModel):
    game_name: str
    catalog_id: Optional[str] = None
    ranking_order: str = "highest"  # highest | lowest
    players: List[str] = []  # names
    use_teams: bool = False
    teams: List[Dict[str, Any]] = []  # [{name, player_names: [...]}]

class AddPlayerReq(BaseModel):
    name: str
    team_key: Optional[str] = None

class SubmitScoreReq(BaseModel):
    player_key: str
    score: float

class UndoScoreReq(BaseModel):
    player_key: str

# -------------------------
# WS manager
# -------------------------
class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

manager = ConnectionManager()

# -------------------------
# Helpers
# -------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

async def get_current_game() -> Optional[dict]:
    doc = await db.current_game.find_one({"key": "current"}, {"_id": 0})
    return doc

async def broadcast_current_game():
    g = await get_current_game()
    await manager.broadcast({"type": "current_game", "data": g})

# Achievements computation
ACHIEVEMENT_DEFS = [
    {"id": "first_win", "name": "First Victory", "desc": "Won your first game", "icon": "Trophy"},
    {"id": "five_wins", "name": "High Roller", "desc": "Won 5 games", "icon": "Medal"},
    {"id": "ten_wins", "name": "Champion", "desc": "Won 10 games", "icon": "Crown"},
    {"id": "veteran", "name": "Veteran", "desc": "Played 25 games", "icon": "Shield"},
    {"id": "streak3", "name": "Hat Trick", "desc": "Win 3 games in a row", "icon": "Fire"},
    {"id": "streak5", "name": "Unstoppable", "desc": "Win 5 games in a row", "icon": "Lightning"},
    {"id": "century", "name": "Century Club", "desc": "Scored 100+ in a single game", "icon": "Star"},
    {"id": "perfectionist", "name": "Win Rate 75%+", "desc": "Maintain a 75% win rate (min 5 games)", "icon": "Target"},
]

ACHIEVEMENT_RULES = [
    ("first_win", lambda r: r.get("wins", 0) >= 1),
    ("five_wins", lambda r: r.get("wins", 0) >= 5),
    ("ten_wins", lambda r: r.get("wins", 0) >= 10),
    ("veteran", lambda r: r.get("gamesPlayed", 0) >= 25),
    ("streak3", lambda r: max(r.get("currentStreak", 0), r.get("bestStreak", 0)) >= 3),
    ("streak5", lambda r: max(r.get("currentStreak", 0), r.get("bestStreak", 0)) >= 5),
    ("century", lambda r: r.get("bestSingleScore", 0) >= 100),
    ("perfectionist", lambda r: r.get("gamesPlayed", 0) >= 5 and (r.get("wins", 0) / r["gamesPlayed"]) >= 0.75),
]

def compute_achievements(record: dict) -> List[str]:
    return [aid for aid, rule in ACHIEVEMENT_RULES if rule(record)]

# -------------------------
# Auth Endpoints
# -------------------------
@api.post("/auth/register")
async def register(body: RegisterReq, response: Response):
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": "user",
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {"id": uid, "email": email, "name": body.name, "role": "user", "access_token": access}

def _extract_client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.headers.get("x-real-ip") or (request.client.host if request.client else "unknown")

async def _check_lockout(rec: Optional[dict]) -> None:
    if not rec or not rec.get("locked_until"):
        return
    locked_until = datetime.fromisoformat(rec["locked_until"])
    if locked_until > datetime.now(timezone.utc):
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try later.")

async def _record_failed_attempt(ident: str, prev_rec: Optional[dict]) -> bool:
    """Returns True if this attempt triggered a new lockout."""
    attempts = (prev_rec or {}).get("attempts", 0) + 1
    update = {"identifier": ident, "attempts": attempts}
    locked = attempts >= 5
    if locked:
        update["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        update["attempts"] = 0
    await db.login_attempts.update_one({"identifier": ident}, {"$set": update}, upsert=True)
    return locked

@api.post("/auth/login")
async def login(body: LoginReq, request: Request, response: Response):
    email = body.email.lower()
    ident = f"{_extract_client_ip(request)}:{email}"
    rec = await db.login_attempts.find_one({"identifier": ident})
    await _check_lockout(rec)
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        locked = await _record_failed_attempt(ident, rec)
        if locked:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.login_attempts.delete_one({"identifier": ident})
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"id": user["id"], "email": user["email"], "name": user.get("name"), "role": user.get("role", "user"), "access_token": access}

@api.post("/auth/logout")
async def logout(response: Response, _user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access = create_access_token(user["id"], user["email"])
        response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
        return {"ok": True}
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# -------------------------
# Game Catalog (library)
# -------------------------
@api.get("/catalog")
async def list_catalog():
    items = await db.games_catalog.find({}, {"_id": 0}).to_list(500)
    return items

@api.post("/catalog")
async def add_catalog(body: GameCatalogIn, user: dict = Depends(require_admin)):
    cid = str(uuid.uuid4())
    doc = {"id": cid, "name": body.name, "description": body.description, "default_ranking": body.default_ranking, "icon": body.icon, "created_at": now_iso(), "play_count": 0}
    await db.games_catalog.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.delete("/catalog/{cid}")
async def delete_catalog(cid: str, user: dict = Depends(require_admin)):
    await db.games_catalog.delete_one({"id": cid})
    return {"ok": True}

# -------------------------
# Current Game (admin)
# -------------------------
@api.get("/game/current")
async def current_game():
    g = await get_current_game()
    return g

@api.post("/game/start")
async def start_game(body: StartGameReq, user: dict = Depends(require_admin)):
    players = []
    for pname in body.players:
        players.append({"key": str(uuid.uuid4()), "name": pname.strip(), "totalScore": 0, "team_key": None, "scores": []})
    teams = []
    if body.use_teams and body.teams:
        for t in body.teams:
            tk = str(uuid.uuid4())
            teams.append({"key": tk, "name": t.get("name", "Team"), "totalScore": 0})
            for pname in t.get("player_names", []):
                players.append({"key": str(uuid.uuid4()), "name": pname.strip(), "totalScore": 0, "team_key": tk, "scores": []})
    doc = {
        "key": "current",
        "id": str(uuid.uuid4()),
        "game_name": body.game_name,
        "catalog_id": body.catalog_id,
        "ranking_order": body.ranking_order,
        "status": "active",
        "players": players,
        "teams": teams,
        "use_teams": body.use_teams,
        "started_at": now_iso(),
    }
    await db.current_game.replace_one({"key": "current"}, doc, upsert=True)
    if body.catalog_id:
        await db.games_catalog.update_one({"id": body.catalog_id}, {"$inc": {"play_count": 1}})
    await broadcast_current_game()
    doc.pop("_id", None)
    return doc

@api.post("/game/add-player")
async def add_player(body: AddPlayerReq, user: dict = Depends(require_admin)):
    g = await get_current_game()
    if not g or g.get("status") != "active":
        raise HTTPException(status_code=400, detail="No active game")
    new_p = {"key": str(uuid.uuid4()), "name": body.name.strip(), "totalScore": 0, "team_key": body.team_key, "scores": []}
    await db.current_game.update_one({"key": "current"}, {"$push": {"players": new_p}})
    await broadcast_current_game()
    return new_p

def _recompute_team_totals(players: list, teams: list) -> None:
    for t in teams:
        t["totalScore"] = sum(p["totalScore"] for p in players if p.get("team_key") == t["key"])

@api.post("/game/submit-score")
async def submit_score(body: SubmitScoreReq, user: dict = Depends(require_admin)):
    g = await get_current_game()
    if not g or g.get("status") != "active":
        raise HTTPException(status_code=400, detail="No active game")
    players = g["players"]
    target = next((p for p in players if p["key"] == body.player_key), None)
    if not target:
        raise HTTPException(status_code=404, detail="Player not found")
    target.setdefault("scores", []).append(body.score)
    target["totalScore"] = sum(target["scores"])
    teams = g.get("teams", [])
    _recompute_team_totals(players, teams)
    await db.current_game.update_one({"key": "current"}, {"$set": {"players": players, "teams": teams}})
    await broadcast_current_game()
    return {"ok": True}

@api.post("/game/undo-score")
async def undo_score(body: UndoScoreReq, user: dict = Depends(require_admin)):
    g = await get_current_game()
    if not g or g.get("status") != "active":
        raise HTTPException(status_code=400, detail="No active game")
    players = g["players"]
    target = next((p for p in players if p["key"] == body.player_key), None)
    if not target:
        raise HTTPException(status_code=404, detail="Player not found")
    scores = target.setdefault("scores", [])
    if not scores:
        raise HTTPException(status_code=400, detail="No score to undo")
    removed = scores.pop()
    target["totalScore"] = sum(scores)
    teams = g.get("teams", [])
    _recompute_team_totals(players, teams)
    await db.current_game.update_one({"key": "current"}, {"$set": {"players": players, "teams": teams}})
    await broadcast_current_game()
    return {"ok": True, "removed": removed}

@api.post("/game/reset")
async def reset_game(user: dict = Depends(require_admin)):
    g = await get_current_game()
    if not g:
        raise HTTPException(status_code=400, detail="No active game")
    for p in g["players"]:
        p["totalScore"] = 0
        p["scores"] = []
    for t in g.get("teams", []):
        t["totalScore"] = 0
    await db.current_game.update_one({"key": "current"}, {"$set": {"players": g["players"], "teams": g.get("teams", [])}})
    await broadcast_current_game()
    return {"ok": True}

@api.post("/game/abandon")
async def abandon_game(user: dict = Depends(require_admin)):
    await db.current_game.delete_one({"key": "current"})
    await manager.broadcast({"type": "current_game", "data": None})
    return {"ok": True}

def _rank_entities(entities: list, ranking: str) -> list:
    return sorted(entities, key=lambda e: e["totalScore"], reverse=(ranking == "highest"))

def _determine_winners(game: dict, sorted_players: list, sorted_teams: list) -> tuple:
    if game.get("use_teams"):
        if not sorted_teams:
            return ("—", set())
        winning_team_key = sorted_teams[0]["key"]
        return (sorted_teams[0]["name"], {p["key"] for p in game["players"] if p.get("team_key") == winning_team_key})
    if not sorted_players:
        return ("—", set())
    return (sorted_players[0]["name"], {sorted_players[0]["key"]})

def _new_player_record(name: str) -> dict:
    return {"name": name, "gamesPlayed": 0, "wins": 0, "totalScore": 0, "bestSingleScore": 0, "currentStreak": 0, "bestStreak": 0, "lastPlayed": now_iso(), "achievements": []}

async def _update_player_record(player: dict, is_winner: bool) -> None:
    rec = await db.player_records.find_one({"name": player["name"]}) or _new_player_record(player["name"])
    score = player["totalScore"]
    rec["gamesPlayed"] += 1
    rec["totalScore"] += score
    rec["bestSingleScore"] = max(rec.get("bestSingleScore", 0), score)
    rec["lastPlayed"] = now_iso()
    if is_winner:
        rec["wins"] = rec.get("wins", 0) + 1
        rec["currentStreak"] = rec.get("currentStreak", 0) + 1
        rec["bestStreak"] = max(rec.get("bestStreak", 0), rec["currentStreak"])
    else:
        rec["currentStreak"] = 0
    rec["achievements"] = compute_achievements(rec)
    rec.pop("_id", None)
    await db.player_records.update_one({"name": player["name"]}, {"$set": rec}, upsert=True)

@api.post("/game/end")
async def end_game(user: dict = Depends(require_admin)):
    g = await get_current_game()
    if not g or g.get("status") != "active":
        raise HTTPException(status_code=400, detail="No active game")
    ranking = g["ranking_order"]
    sorted_players = _rank_entities(g["players"], ranking)
    sorted_teams = _rank_entities(g.get("teams", []), ranking) if g.get("use_teams") else []
    winner_label, winner_keys = _determine_winners(g, sorted_players, sorted_teams)

    history_doc = {
        "id": str(uuid.uuid4()),
        "game_name": g["game_name"],
        "catalog_id": g.get("catalog_id"),
        "ranking_order": ranking,
        "ended_at": now_iso(),
        "started_at": g.get("started_at"),
        "winner_label": winner_label,
        "players": [{"name": p["name"], "totalScore": p["totalScore"], "team_key": p.get("team_key"), "scores": p.get("scores", [])} for p in sorted_players],
        "teams": g.get("teams", []),
        "use_teams": g.get("use_teams", False),
    }
    await db.game_history.insert_one(history_doc)

    for p in g["players"]:
        await _update_player_record(p, p["key"] in winner_keys)

    await db.current_game.delete_one({"key": "current"})
    await manager.broadcast({"type": "current_game", "data": None})
    await manager.broadcast({"type": "game_ended", "data": {"id": history_doc["id"], "winner": winner_label}})
    history_doc.pop("_id", None)
    return history_doc

# -------------------------
# History & Records
# -------------------------
@api.get("/history")
async def get_history(limit: int = 100, catalog_id: Optional[str] = None):
    q = {}
    if catalog_id:
        q["catalog_id"] = catalog_id
    items = await db.game_history.find(q, {"_id": 0}).sort("ended_at", -1).to_list(limit)
    return items

@api.delete("/history/{gid}")
async def delete_history(gid: str, user: dict = Depends(require_admin)):
    await db.game_history.delete_one({"id": gid})
    return {"ok": True}

@api.get("/players")
async def get_players():
    items = await db.player_records.find({}, {"_id": 0}).to_list(1000)
    for it in items:
        gp = it.get("gamesPlayed", 0)
        it["winRate"] = (it.get("wins", 0) / gp) if gp else 0
        it["avgScore"] = (it.get("totalScore", 0) / gp) if gp else 0
    return items

@api.get("/players/{name}")
async def get_player(name: str):
    rec = await db.player_records.find_one({"name": name}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Player not found")
    history = await db.game_history.find({"players.name": name}, {"_id": 0}).sort("ended_at", -1).to_list(200)
    return {"record": rec, "history": history}

@api.delete("/players/{name}")
async def delete_player(name: str, user: dict = Depends(require_admin)):
    await db.player_records.delete_one({"name": name})
    return {"ok": True}

@api.get("/achievements/definitions")
async def achievement_defs():
    return ACHIEVEMENT_DEFS

# -------------------------
# WebSocket
# -------------------------
@app.websocket("/api/ws")
async def ws_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        # send initial state
        g = await get_current_game()
        await ws.send_json({"type": "current_game", "data": g})
        while True:
            await ws.receive_text()  # heartbeat or ignored
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)

# -------------------------
# Startup
# -------------------------
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@boardgame.app").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid,
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": now_iso(),
        })
        logger.info("Seeded admin user: %s", admin_email)
    else:
        if not verify_password(admin_password, existing["password_hash"]):
            await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}})
            logger.info("Updated admin password")
        elif existing.get("role") != "admin":
            await db.users.update_one({"email": admin_email}, {"$set": {"role": "admin"}})

async def seed_catalog():
    count = await db.games_catalog.count_documents({})
    if count == 0:
        defaults = [
            {"name": "Catan", "description": "Trade, build, settle.", "default_ranking": "highest", "icon": "Cube"},
            {"name": "Monopoly", "description": "Buy, sell, dominate.", "default_ranking": "highest", "icon": "MoneyWavy"},
            {"name": "Scrabble", "description": "Word-building classic.", "default_ranking": "highest", "icon": "Alphabet"},
            {"name": "Golf (Cards)", "description": "Lowest score wins.", "default_ranking": "lowest", "icon": "Cards"},
            {"name": "Yahtzee", "description": "Dice combinations.", "default_ranking": "highest", "icon": "DiceFive"},
        ]
        for d in defaults:
            d["id"] = str(uuid.uuid4())
            d["created_at"] = now_iso()
            d["play_count"] = 0
        await db.games_catalog.insert_many(defaults)
        logger.info("Seeded catalog with %d default games", len(defaults))

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.games_catalog.create_index("id", unique=True)
    await db.game_history.create_index("id", unique=True)
    await db.game_history.create_index("ended_at")
    await db.player_records.create_index("name", unique=True)
    await seed_admin()
    await seed_catalog()

@app.on_event("shutdown")
async def shutdown():
    client.close()

# -------------------------
# Mount
# -------------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
