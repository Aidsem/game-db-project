"""
app.py  (v2 - PostgreSQL / Neon edition)
========================================
The ENTIRE backend in one file: config, models, routes, SQL-object endpoints
(views / function / procedure / audit), and matplotlib graph generation.

    1. CONFIG            - DATABASE_URL from .env (never hard-code secrets)
    2. APP & DATABASE SETUP
    3. MODELS            - one class per table (schema itself lives in sql/*.sql)
    4. GRAPH HELPERS     - matplotlib PNG charts
    5-9. CRUD ROUTES     - characters, weapons, artifacts, tiers, builds
    10. DAMAGE LOGS + GRAPHS
    10b. ANALYTICS / VIEWS / FUNCTION / PROCEDURE / PROFILES / SEARCH / AUDIT / DEMO QUERIES
    11. HEALTH + STATIC FRONTEND + ERROR HANDLERS
    12. ENTRY POINT      - python app.py

The database schema is created by the SQL files (sql/01..04), NOT by SQLAlchemy.
Run:  python app.py
"""

import io
import os
from datetime import datetime, timezone, date
from decimal import Decimal

from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

import matplotlib
matplotlib.use("Agg")  # non-interactive backend — required on a server (no display)
import matplotlib.pyplot as plt


# =======================================================================
# 1. CONFIG — read from a .env file so secrets never live in this code
# =======================================================================

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    raise SystemExit("DATABASE_URL is not set. Copy .env.example to .env and paste your Neon connection string.")
# Neon/Heroku style URLs start with postgres:// or postgresql:// - SQLAlchemy needs the driver name
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL[len("postgresql://"):]

SQLALCHEMY_DATABASE_URI = DATABASE_URL
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
DEBUG = os.getenv("FLASK_DEBUG", "True") == "True"
API_PORT = int(os.getenv("API_PORT", 5000))

# Chart colors — matched to the frontend's own palette (app/static/css/styles.css)
# so a graph opened on its own still looks like part of the same product.
CHART_BG = "#1B1E27"
CHART_FG = "#ECEDF2"
CHART_MUTED = "#8B90A3"
CHART_GRID = "#2A2E3A"
CHART_ACCENT = "#3FC9BE"
CHART_ACCENT2 = "#F2A541"
CHART_PALETTE = ["#3FC9BE", "#F2A541", "#8B7FD8", "#E2622C", "#4F8FD9", "#6FBF7A", "#C6485E"]


# =======================================================================
# 2. APP & DATABASE SETUP
# =======================================================================

app = Flask(__name__, static_folder="app/static", static_url_path="/")
app.config["SQLALCHEMY_DATABASE_URI"] = SQLALCHEMY_DATABASE_URI
# Neon pauses idle databases: pre-ping + recycle avoids "connection closed" on the first request
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True, "pool_recycle": 280}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = SECRET_KEY

db = SQLAlchemy(app)
CORS(app)  # allows a separately-hosted frontend to call this API


# =======================================================================
# 3. MODELS — one class per table. Mirrors sql/01_schema_pg.sql
#    (the tier columns are VARCHAR(1) with a CHECK constraint, not an ENUM).
# =======================================================================

class Character(db.Model):
    __tablename__ = "characters"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    release_order = db.Column(db.Integer, nullable=False, unique=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    rarity = db.Column(db.SmallInteger, nullable=False)
    element = db.Column(db.String(30), nullable=False)
    weapon_type = db.Column(db.String(30), nullable=False)
    description = db.Column(db.Text)

    combat_tiers = db.relationship("TierListCombat", backref="character", cascade="all, delete-orphan")
    exploration_tier = db.relationship("TierListExploration", backref="character", uselist=False, cascade="all, delete-orphan")
    builds = db.relationship("Build", backref="character", cascade="all, delete-orphan")

    def to_dict(self, include_relations=False):
        data = {
            "id": self.id,
            "release_order": self.release_order,
            "name": self.name,
            "rarity": self.rarity,
            "element": self.element,
            "weapon_type": self.weapon_type,
            "description": self.description,
        }
        if include_relations:
            data["combat_tiers"] = [t.to_dict() for t in self.combat_tiers]
            data["exploration_tier"] = self.exploration_tier.to_dict() if self.exploration_tier else None
            data["builds"] = [b.to_dict() for b in self.builds]
        return data


class Weapon(db.Model):
    __tablename__ = "weapons"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    type = db.Column(db.String(30), nullable=False)
    rarity = db.Column(db.SmallInteger, nullable=False)
    description = db.Column(db.Text)

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "type": self.type,
            "rarity": self.rarity, "description": self.description,
        }


class Artifact(db.Model):
    __tablename__ = "artifacts"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    set_name = db.Column(db.String(100), nullable=False, unique=True)
    bonus_2pc = db.Column(db.Text, nullable=False)
    bonus_4pc = db.Column(db.Text, nullable=False)

    def to_dict(self):
        return {
            "id": self.id, "set_name": self.set_name,
            "bonus_2pc": self.bonus_2pc, "bonus_4pc": self.bonus_4pc,
        }


class TierListCombat(db.Model):
    __tablename__ = "tier_list_combat"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    character_id = db.Column(db.Integer, db.ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
    tier = db.Column(db.String(1), nullable=False)
    role = db.Column(db.String(50), nullable=False)

    __table_args__ = (db.UniqueConstraint("character_id", "role", name="uq_character_combat_role"),)

    def to_dict(self):
        return {"id": self.id, "character_id": self.character_id, "tier": self.tier, "role": self.role}


class TierListExploration(db.Model):
    __tablename__ = "tier_list_exploration"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    character_id = db.Column(db.Integer, db.ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, unique=True)
    tier = db.Column(db.String(1), nullable=False)

    def to_dict(self):
        return {"id": self.id, "character_id": self.character_id, "tier": self.tier}


class Build(db.Model):
    __tablename__ = "builds"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    character_id = db.Column(db.Integer, db.ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
    build_name = db.Column(db.String(100), nullable=False, default="Main Build")
    weapon_id = db.Column(db.Integer, db.ForeignKey("weapons.id", ondelete="RESTRICT"), nullable=False)
    artifact_id = db.Column(db.Integer, db.ForeignKey("artifacts.id", ondelete="RESTRICT"), nullable=False)

    __table_args__ = (db.UniqueConstraint("character_id", "build_name", name="uq_character_build"),)

    weapon = db.relationship("Weapon")
    artifact = db.relationship("Artifact")
    team_members = db.relationship("BuildTeamMember", backref="build", cascade="all, delete-orphan")
    damage_logs = db.relationship("BuildDamageLog", backref="build", cascade="all, delete-orphan")

    def to_dict(self, include_damage=True):
        data = {
            "id": self.id,
            "character_id": self.character_id,
            "build_name": self.build_name,
            "weapon": self.weapon.to_dict() if self.weapon else None,
            "artifact": self.artifact.to_dict() if self.artifact else None,
            "team_members": [m.to_dict() for m in self.team_members],
        }
        if include_damage:
            values = [log.damage_value for log in self.damage_logs]
            data["damage_logs"] = [log.to_dict() for log in self.damage_logs]
            data["average_damage"] = round(sum(values) / len(values), 1) if values else None
        return data


class BuildTeamMember(db.Model):
    __tablename__ = "build_team_members"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    build_id = db.Column(db.Integer, db.ForeignKey("builds.id", ondelete="CASCADE"), nullable=False)
    character_id = db.Column(db.Integer, db.ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
    notes = db.Column(db.String(255))

    __table_args__ = (db.UniqueConstraint("build_id", "character_id", name="uq_build_teammate"),)

    teammate = db.relationship("Character", foreign_keys=[character_id])

    def to_dict(self):
        return {
            "id": self.id, "build_id": self.build_id, "character_id": self.character_id,
            "teammate_name": self.teammate.name if self.teammate else None, "notes": self.notes,
        }


class BuildDamageLog(db.Model):
    """One row = one recorded damage number for a build (validated by a DB trigger)."""
    __tablename__ = "build_damage_logs"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    build_id = db.Column(db.Integer, db.ForeignKey("builds.id", ondelete="CASCADE"), nullable=False)
    label = db.Column(db.String(100), nullable=False)       # e.g. "Elemental Burst", "Full Rotation"
    damage_value = db.Column(db.Float(53), nullable=False)
    notes = db.Column(db.String(255))
    recorded_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "build_id": self.build_id,
            "label": self.label,
            "damage_value": self.damage_value,
            "notes": self.notes,
            "recorded_at": self.recorded_at.isoformat() if self.recorded_at else None,
        }


# =======================================================================
# 4. GRAPH HELPERS — build a matplotlib figure and hand back PNG bytes.
#    Kept separate from the route functions so the chart styling logic
#    isn't tangled up with request handling.
# =======================================================================

def _style_axes(ax, fig):
    """Apply the shared dark theme to a chart so it matches the frontend."""
    fig.patch.set_facecolor(CHART_BG)
    ax.set_facecolor(CHART_BG)
    ax.tick_params(colors=CHART_MUTED, labelsize=9)
    for spine in ax.spines.values():
        spine.set_color(CHART_GRID)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.yaxis.grid(True, color=CHART_GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.title.set_color(CHART_FG)
    ax.xaxis.label.set_color(CHART_MUTED)
    ax.yaxis.label.set_color(CHART_MUTED)


def render_build_damage_chart(build):
    """
    Bar chart of every recorded damage value for ONE build, in the order
    they were logged. Shows trend across test runs / patches for that
    specific character + weapon + artifact combination.
    """
    logs = sorted(build.damage_logs, key=lambda l: l.recorded_at)
    fig, ax = plt.subplots(figsize=(8, 4.5), dpi=150)
    _style_axes(ax, fig)

    if not logs:
        ax.text(0.5, 0.5, "No damage data recorded yet", ha="center", va="center",
                 color=CHART_MUTED, fontsize=12, transform=ax.transAxes)
        ax.set_xticks([])
        ax.set_yticks([])
    else:
        labels = [l.label for l in logs]
        values = [l.damage_value for l in logs]
        x = range(len(values))
        bars = ax.bar(x, values, color=CHART_ACCENT, width=0.6, zorder=3)
        ax.set_xticks(list(x))
        ax.set_xticklabels(labels, rotation=25, ha="right", fontsize=8)
        ax.set_ylabel("Damage")
        avg = sum(values) / len(values)
        ax.axhline(avg, color=CHART_ACCENT2, linestyle="--", linewidth=1, zorder=2)
        ax.text(1.0, avg, f"avg {avg:.0f} ", color=CHART_ACCENT2, fontsize=8,
                 ha="right", va="bottom", transform=ax.get_yaxis_transform())
        for rect, val in zip(bars, values):
            ax.text(rect.get_x() + rect.get_width() / 2, val, f"{val:.0f}",
                     ha="center", va="bottom", color=CHART_FG, fontsize=8)

    character_name = build.character.name if build.character else "Unknown"
    ax.set_title(f"Damage Output — {character_name} · {build.build_name}", fontsize=12, pad=14)
    fig.tight_layout()
    return _figure_to_png_bytes(fig)


def render_character_build_comparison_chart(character):
    """
    Bar chart comparing the AVERAGE recorded damage across every build
    belonging to one character — useful for answering "which of this
    character's builds actually hits hardest?"
    """
    builds = character.builds
    fig, ax = plt.subplots(figsize=(8, 4.5), dpi=150)
    _style_axes(ax, fig)

    builds_with_data = [b for b in builds if b.damage_logs]
    if not builds_with_data:
        ax.text(0.5, 0.5, "No damage data recorded for any build yet", ha="center", va="center",
                 color=CHART_MUTED, fontsize=12, transform=ax.transAxes)
        ax.set_xticks([])
        ax.set_yticks([])
    else:
        names = [b.build_name for b in builds_with_data]
        averages = [sum(l.damage_value for l in b.damage_logs) / len(b.damage_logs) for b in builds_with_data]
        colors = [CHART_PALETTE[i % len(CHART_PALETTE)] for i in range(len(builds_with_data))]
        x = range(len(names))
        bars = ax.bar(x, averages, color=colors, width=0.55, zorder=3)
        ax.set_xticks(list(x))
        ax.set_xticklabels(names, rotation=20, ha="right", fontsize=9)
        ax.set_ylabel("Average damage")
        for rect, val in zip(bars, averages):
            ax.text(rect.get_x() + rect.get_width() / 2, val, f"{val:.0f}",
                     ha="center", va="bottom", color=CHART_FG, fontsize=8)

    ax.set_title(f"Build Comparison — {character.name}", fontsize=12, pad=14)
    fig.tight_layout()
    return _figure_to_png_bytes(fig)


def _figure_to_png_bytes(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    return buf


# =======================================================================
# 5. ROUTES — characters
# =======================================================================

@app.route("/api/characters", methods=["GET"])
def list_characters():
    query = Character.query
    element = request.args.get("element")
    weapon_type = request.args.get("weapon_type")
    rarity = request.args.get("rarity")
    if element:
        query = query.filter(Character.element.ilike(element))
    if weapon_type:
        query = query.filter(Character.weapon_type.ilike(weapon_type))
    if rarity:
        query = query.filter(Character.rarity == int(rarity))
    characters = query.order_by(Character.release_order).all()
    return jsonify([c.to_dict() for c in characters])


@app.route("/api/characters/<int:character_id>", methods=["GET"])
def get_character(character_id):
    character = Character.query.get_or_404(character_id)
    return jsonify(character.to_dict(include_relations=True))


@app.route("/api/characters", methods=["POST"])
def create_character():
    data = request.get_json(force=True)
    required = ["release_order", "name", "rarity", "element", "weapon_type"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    character = Character(
        release_order=data["release_order"], name=data["name"], rarity=data["rarity"],
        element=data["element"], weapon_type=data["weapon_type"], description=data.get("description"),
    )
    db.session.add(character)
    db.session.commit()
    return jsonify(character.to_dict()), 201


@app.route("/api/characters/<int:character_id>", methods=["PUT"])
def update_character(character_id):
    character = Character.query.get_or_404(character_id)
    data = request.get_json(force=True)
    for field in ["release_order", "name", "rarity", "element", "weapon_type", "description"]:
        if field in data:
            setattr(character, field, data[field])
    db.session.commit()
    return jsonify(character.to_dict())


@app.route("/api/characters/<int:character_id>", methods=["DELETE"])
def delete_character(character_id):
    character = Character.query.get_or_404(character_id)
    db.session.delete(character)
    db.session.commit()
    return jsonify({"message": f"Character {character_id} deleted"})


# =======================================================================
# 6. ROUTES — weapons
# =======================================================================

@app.route("/api/weapons", methods=["GET"])
def list_weapons():
    query = Weapon.query
    weapon_type = request.args.get("type")
    if weapon_type:
        query = query.filter(Weapon.type.ilike(weapon_type))
    weapons = query.order_by(Weapon.type, Weapon.rarity.desc()).all()
    return jsonify([w.to_dict() for w in weapons])


@app.route("/api/weapons/<int:weapon_id>", methods=["GET"])
def get_weapon(weapon_id):
    return jsonify(Weapon.query.get_or_404(weapon_id).to_dict())


@app.route("/api/weapons", methods=["POST"])
def create_weapon():
    data = request.get_json(force=True)
    required = ["name", "type", "rarity"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400
    weapon = Weapon(name=data["name"], type=data["type"], rarity=data["rarity"], description=data.get("description"))
    db.session.add(weapon)
    db.session.commit()
    return jsonify(weapon.to_dict()), 201


@app.route("/api/weapons/<int:weapon_id>", methods=["PUT"])
def update_weapon(weapon_id):
    weapon = Weapon.query.get_or_404(weapon_id)
    data = request.get_json(force=True)
    for field in ["name", "type", "rarity", "description"]:
        if field in data:
            setattr(weapon, field, data[field])
    db.session.commit()
    return jsonify(weapon.to_dict())


@app.route("/api/weapons/<int:weapon_id>", methods=["DELETE"])
def delete_weapon(weapon_id):
    weapon = Weapon.query.get_or_404(weapon_id)
    db.session.delete(weapon)
    db.session.commit()
    return jsonify({"message": f"Weapon {weapon_id} deleted"})


# =======================================================================
# 7. ROUTES — artifacts
# =======================================================================

@app.route("/api/artifacts", methods=["GET"])
def list_artifacts():
    return jsonify([a.to_dict() for a in Artifact.query.order_by(Artifact.set_name).all()])


@app.route("/api/artifacts/<int:artifact_id>", methods=["GET"])
def get_artifact(artifact_id):
    return jsonify(Artifact.query.get_or_404(artifact_id).to_dict())


@app.route("/api/artifacts", methods=["POST"])
def create_artifact():
    data = request.get_json(force=True)
    required = ["set_name", "bonus_2pc", "bonus_4pc"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400
    artifact = Artifact(set_name=data["set_name"], bonus_2pc=data["bonus_2pc"], bonus_4pc=data["bonus_4pc"])
    db.session.add(artifact)
    db.session.commit()
    return jsonify(artifact.to_dict()), 201


@app.route("/api/artifacts/<int:artifact_id>", methods=["PUT"])
def update_artifact(artifact_id):
    artifact = Artifact.query.get_or_404(artifact_id)
    data = request.get_json(force=True)
    for field in ["set_name", "bonus_2pc", "bonus_4pc"]:
        if field in data:
            setattr(artifact, field, data[field])
    db.session.commit()
    return jsonify(artifact.to_dict())


@app.route("/api/artifacts/<int:artifact_id>", methods=["DELETE"])
def delete_artifact(artifact_id):
    artifact = Artifact.query.get_or_404(artifact_id)
    db.session.delete(artifact)
    db.session.commit()
    return jsonify({"message": f"Artifact {artifact_id} deleted"})


# =======================================================================
# 8. ROUTES — tier lists (combat + exploration)
# =======================================================================

@app.route("/api/tier-lists/combat", methods=["GET"])
def list_combat_tiers():
    query = TierListCombat.query
    tier = request.args.get("tier")
    role = request.args.get("role")
    if tier:
        query = query.filter(TierListCombat.tier == tier.upper())
    if role:
        query = query.filter(TierListCombat.role.ilike(role))
    results = []
    for entry in query.all():
        d = entry.to_dict()
        d["character_name"] = entry.character.name if entry.character else None
        results.append(d)
    return jsonify(results)


@app.route("/api/tier-lists/combat", methods=["POST"])
def create_combat_tier():
    data = request.get_json(force=True)
    required = ["character_id", "tier", "role"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400
    Character.query.get_or_404(data["character_id"])
    entry = TierListCombat(character_id=data["character_id"], tier=data["tier"].upper(), role=data["role"])
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201


@app.route("/api/tier-lists/combat/<int:entry_id>", methods=["DELETE"])
def delete_combat_tier(entry_id):
    entry = TierListCombat.query.get_or_404(entry_id)
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"message": f"Combat tier entry {entry_id} deleted"})


@app.route("/api/tier-lists/exploration", methods=["GET"])
def list_exploration_tiers():
    query = TierListExploration.query
    tier = request.args.get("tier")
    if tier:
        query = query.filter(TierListExploration.tier == tier.upper())
    results = []
    for entry in query.all():
        d = entry.to_dict()
        d["character_name"] = entry.character.name if entry.character else None
        results.append(d)
    return jsonify(results)


@app.route("/api/tier-lists/exploration", methods=["POST"])
def create_or_update_exploration_tier():
    data = request.get_json(force=True)
    required = ["character_id", "tier"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400
    Character.query.get_or_404(data["character_id"])
    existing = TierListExploration.query.filter_by(character_id=data["character_id"]).first()
    if existing:
        existing.tier = data["tier"].upper()
        db.session.commit()
        return jsonify(existing.to_dict())
    entry = TierListExploration(character_id=data["character_id"], tier=data["tier"].upper())
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201


@app.route("/api/tier-lists/exploration/<int:entry_id>", methods=["DELETE"])
def delete_exploration_tier(entry_id):
    entry = TierListExploration.query.get_or_404(entry_id)
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"message": f"Exploration tier entry {entry_id} deleted"})


# =======================================================================
# 9. ROUTES — builds + team members
# =======================================================================

@app.route("/api/builds", methods=["GET"])
def list_builds():
    query = Build.query
    character_id = request.args.get("character_id")
    if character_id:
        query = query.filter(Build.character_id == int(character_id))
    return jsonify([b.to_dict() for b in query.all()])


@app.route("/api/builds/<int:build_id>", methods=["GET"])
def get_build(build_id):
    return jsonify(Build.query.get_or_404(build_id).to_dict())


@app.route("/api/builds", methods=["POST"])
def create_build():
    data = request.get_json(force=True)
    required = ["character_id", "weapon_id", "artifact_id"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400
    Character.query.get_or_404(data["character_id"])
    Weapon.query.get_or_404(data["weapon_id"])
    Artifact.query.get_or_404(data["artifact_id"])
    build = Build(
        character_id=data["character_id"], build_name=data.get("build_name", "Main Build"),
        weapon_id=data["weapon_id"], artifact_id=data["artifact_id"],
    )
    db.session.add(build)
    db.session.commit()
    return jsonify(build.to_dict()), 201


@app.route("/api/builds/<int:build_id>", methods=["PUT"])
def update_build(build_id):
    build = Build.query.get_or_404(build_id)
    data = request.get_json(force=True)
    for field in ["build_name", "weapon_id", "artifact_id"]:
        if field in data:
            setattr(build, field, data[field])
    db.session.commit()
    return jsonify(build.to_dict())


@app.route("/api/builds/<int:build_id>", methods=["DELETE"])
def delete_build(build_id):
    build = Build.query.get_or_404(build_id)
    db.session.delete(build)
    db.session.commit()
    return jsonify({"message": f"Build {build_id} deleted"})


@app.route("/api/builds/<int:build_id>/team", methods=["POST"])
def add_team_member(build_id):
    Build.query.get_or_404(build_id)
    data = request.get_json(force=True)
    if "character_id" not in data:
        return jsonify({"error": "Missing field: character_id"}), 400
    Character.query.get_or_404(data["character_id"])
    member = BuildTeamMember(build_id=build_id, character_id=data["character_id"], notes=data.get("notes"))
    db.session.add(member)
    db.session.commit()
    return jsonify(member.to_dict()), 201


@app.route("/api/builds/<int:build_id>/team/<int:member_id>", methods=["DELETE"])
def remove_team_member(build_id, member_id):
    member = BuildTeamMember.query.filter_by(id=member_id, build_id=build_id).first_or_404()
    db.session.delete(member)
    db.session.commit()
    return jsonify({"message": f"Team member {member_id} removed from build {build_id}"})


# =======================================================================
# 10. ROUTES — damage logs + graphs   (NEW)
# =======================================================================
#
# Data endpoints (JSON):
#   GET    /api/damage-logs?build_id=&character_id=&label=   list (filterable)
#   GET    /api/damage-logs/<id>                              one record
#   POST   /api/damage-logs                                   add a record
#   PUT    /api/damage-logs/<id>                               edit a record
#   DELETE /api/damage-logs/<id>                               remove a record
#
# Graph endpoints (return an actual PNG image — open the URL directly in
# a browser, or embed it with <img src="..."> in a frontend):
#   GET /api/damage-logs/graph/build/<build_id>               one build's
#                                                               damage over its
#                                                               recorded runs
#   GET /api/damage-logs/graph/compare/<character_id>         average damage
#                                                               across every
#                                                               build that
#                                                               character has
# =======================================================================

@app.route("/api/damage-logs", methods=["GET"])
def list_damage_logs():
    query = BuildDamageLog.query
    build_id = request.args.get("build_id")
    character_id = request.args.get("character_id")
    label = request.args.get("label")

    if build_id:
        query = query.filter(BuildDamageLog.build_id == int(build_id))
    if character_id:
        query = query.join(Build).filter(Build.character_id == int(character_id))
    if label:
        query = query.filter(BuildDamageLog.label.ilike(label))

    logs = query.order_by(BuildDamageLog.recorded_at).all()
    return jsonify([log.to_dict() for log in logs])


@app.route("/api/damage-logs/<int:log_id>", methods=["GET"])
def get_damage_log(log_id):
    return jsonify(BuildDamageLog.query.get_or_404(log_id).to_dict())


@app.route("/api/damage-logs", methods=["POST"])
def create_damage_log():
    data = request.get_json(force=True)
    required = ["build_id", "label", "damage_value"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    Build.query.get_or_404(data["build_id"])  # 404s cleanly if the build doesn't exist

    try:
        damage_value = float(data["damage_value"])
    except (TypeError, ValueError):
        return jsonify({"error": "damage_value must be a number"}), 400
    if damage_value < 0:
        return jsonify({"error": "damage_value cannot be negative"}), 400

    log = BuildDamageLog(
        build_id=data["build_id"], label=data["label"],
        damage_value=damage_value, notes=data.get("notes"),
    )
    db.session.add(log)
    db.session.commit()
    return jsonify(log.to_dict()), 201


@app.route("/api/damage-logs/<int:log_id>", methods=["PUT"])
def update_damage_log(log_id):
    log = BuildDamageLog.query.get_or_404(log_id)
    data = request.get_json(force=True)

    if "damage_value" in data:
        try:
            value = float(data["damage_value"])
        except (TypeError, ValueError):
            return jsonify({"error": "damage_value must be a number"}), 400
        if value < 0:
            return jsonify({"error": "damage_value cannot be negative"}), 400
        log.damage_value = value

    for field in ["label", "notes"]:
        if field in data:
            setattr(log, field, data[field])

    db.session.commit()
    return jsonify(log.to_dict())


@app.route("/api/damage-logs/<int:log_id>", methods=["DELETE"])
def delete_damage_log(log_id):
    log = BuildDamageLog.query.get_or_404(log_id)
    db.session.delete(log)
    db.session.commit()
    return jsonify({"message": f"Damage log {log_id} deleted"})


@app.route("/api/damage-logs/graph/build/<int:build_id>", methods=["GET"])
def damage_graph_for_build(build_id):
    build = Build.query.get_or_404(build_id)
    png_buffer = render_build_damage_chart(build)
    return send_file(png_buffer, mimetype="image/png")


@app.route("/api/damage-logs/graph/compare/<int:character_id>", methods=["GET"])
def damage_graph_compare_builds(character_id):
    character = Character.query.get_or_404(character_id)
    png_buffer = render_character_build_comparison_chart(character)
    return send_file(png_buffer, mimetype="image/png")




# =======================================================================
# 10b. ROUTES - analytics, SQL views, function, procedure, JSONB, search,
#      audit log, demo queries.  These are what the SQL Explorer page and
#      the Dashboard use, and they showcase the "advanced SQL" objects.
# =======================================================================

def _clean(value):
    """Make a DB value JSON-friendly."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _rows(sql, **params):
    """Run raw SQL (always with bound parameters) and return a list of dicts."""
    result = db.session.execute(db.text(sql), params).mappings().all()
    return [{k: _clean(v) for k, v in row.items()} for row in result]


def _db_message(exc):
    """First line of the database's own error message (e.g. the trigger's RAISE text)."""
    orig = getattr(exc, "orig", exc)
    return str(orig).strip().split("\n")[0]


TIER_ORDER = "array_position(ARRAY['S','A','B','C','D'], tier)"


@app.route("/api/analytics/summary")
def analytics_summary():
    counts = _rows("""SELECT
        (SELECT COUNT(*) FROM characters)        AS characters,
        (SELECT COUNT(*) FROM weapons)           AS weapons,
        (SELECT COUNT(*) FROM artifacts)         AS artifacts,
        (SELECT COUNT(*) FROM builds)            AS builds,
        (SELECT COUNT(*) FROM build_damage_logs) AS damage_logs""")[0]
    return jsonify({
        "counts": counts,
        "by_element": _rows("SELECT element, COUNT(*) AS total FROM characters GROUP BY element ORDER BY total DESC, element"),
        "by_weapon_type": _rows("SELECT weapon_type, COUNT(*) AS total FROM characters GROUP BY weapon_type ORDER BY total DESC, weapon_type"),
        "combat_tiers": _rows(f"SELECT tier, COUNT(*) AS total FROM tier_list_combat GROUP BY tier ORDER BY {TIER_ORDER}"),
        "top_builds": _rows("SELECT * FROM v_build_damage_summary WHERE runs > 0 ORDER BY avg_damage DESC LIMIT 5"),
    })


# Only these views can be read through the API (whitelist = no SQL injection via the URL)
VIEW_WHITELIST = {
    "character-overview": "v_character_overview",
    "build-details": "v_build_details",
    "damage-summary": "v_build_damage_summary",
}


@app.route("/api/views/<name>")
def read_view(name):
    view = VIEW_WHITELIST.get(name)
    if not view:
        return jsonify({"error": "Unknown view", "available": list(VIEW_WHITELIST)}), 404
    return jsonify(_rows(f"SELECT * FROM {view} ORDER BY 1"))


@app.route("/api/best-build/<int:character_id>")
def best_build(character_id):
    rows = _rows("SELECT * FROM get_best_build(:cid)", cid=character_id)   # SQL function
    if not rows:
        return jsonify({"error": "No damage data for this character yet"}), 404
    return jsonify(rows[0])


@app.route("/api/procedures/add-damage-log", methods=["POST"])
def procedure_add_damage_log():
    data = request.get_json(force=True, silent=True) or {}
    missing = [f for f in ("build_id", "label", "damage_value") if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400
    try:
        value = float(data["damage_value"])
        build_id = int(data["build_id"])
    except (TypeError, ValueError):
        return jsonify({"error": "build_id and damage_value must be numbers"}), 400
    try:
        db.session.execute(
            db.text("CALL add_damage_log(:b, :l, :v, :n)"),
            {"b": build_id, "l": str(data["label"]), "v": value, "n": data.get("notes")},
        )
        db.session.commit()
    except SQLAlchemyError as exc:           # trigger / procedure RAISE EXCEPTION lands here
        db.session.rollback()
        return jsonify({"error": _db_message(exc)}), 400
    return jsonify({"message": "Damage log added by stored procedure add_damage_log()"}), 201


@app.route("/api/profiles")
def list_profiles():
    region = request.args.get("region")
    sql = """SELECT p.character_id, c.name, p.profile
             FROM character_profiles p JOIN characters c ON c.id = p.character_id"""
    params = {}
    if region:
        sql += " WHERE p.profile @> CAST(:flt AS jsonb)"        # JSONB containment, uses the GIN index
        import json as _json
        params["flt"] = _json.dumps({"region": region})
    return jsonify(_rows(sql + " ORDER BY c.name", **params))


@app.route("/api/profiles/<int:character_id>")
def get_profile(character_id):
    rows = _rows("""SELECT p.character_id, c.name, p.profile
                    FROM character_profiles p JOIN characters c ON c.id = p.character_id
                    WHERE p.character_id = :cid""", cid=character_id)
    if not rows:
        return jsonify({"error": "No profile for this character"}), 404
    return jsonify(rows[0])


@app.route("/api/search")
def global_search():
    q = request.args.get("q", "").strip()
    if len(q) < 2:
        return jsonify({"characters": [], "weapons": [], "artifacts": []})
    like = f"%{q}%"
    return jsonify({
        "characters": _rows("SELECT id, name, element, rarity FROM characters WHERE name ILIKE :q ORDER BY name LIMIT 8", q=like),
        "weapons": _rows("SELECT id, name, type, rarity FROM weapons WHERE name ILIKE :q ORDER BY name LIMIT 8", q=like),
        "artifacts": _rows("SELECT id, set_name FROM artifacts WHERE set_name ILIKE :q ORDER BY set_name LIMIT 8", q=like),
    })


@app.route("/api/audit-log")
def audit_log():
    return jsonify(_rows("SELECT * FROM audit_log ORDER BY id DESC LIMIT 50"))


# Read-only SELECTs shown on the SQL Explorer page (fixed list: the client cannot send SQL)
DEMO_QUERIES = [
    {"id": 1, "title": "Full build sheet (3-table JOIN)",
     "sql": "SELECT c.name, b.build_name, w.name AS weapon, a.set_name AS artifact\nFROM builds b JOIN characters c ON c.id = b.character_id\nJOIN weapons w ON w.id = b.weapon_id JOIN artifacts a ON a.id = b.artifact_id\nORDER BY c.name, b.build_name"},
    {"id": 2, "title": "Elements with more than 11 characters (GROUP BY + HAVING)",
     "sql": "SELECT element, COUNT(*) AS total FROM characters\nGROUP BY element HAVING COUNT(*) > 11 ORDER BY total DESC"},
    {"id": 3, "title": "Characters with an S-tier combat entry (subquery)",
     "sql": "SELECT name, element FROM characters\nWHERE id IN (SELECT character_id FROM tier_list_combat WHERE tier = 'S')\nORDER BY name"},
    {"id": 4, "title": "Average weapon rarity per type (aggregate)",
     "sql": "SELECT type, ROUND(AVG(rarity), 2) AS avg_rarity, COUNT(*) AS weapons\nFROM weapons GROUP BY type ORDER BY avg_rarity DESC"},
    {"id": 5, "title": "Characters with no builds (LEFT JOIN anti-join)",
     "sql": "SELECT c.name FROM characters c LEFT JOIN builds b ON b.character_id = c.id\nWHERE b.id IS NULL ORDER BY c.name LIMIT 20"},
    {"id": 6, "title": "Builds ranked by average damage (view)",
     "sql": "SELECT * FROM v_build_damage_summary WHERE runs > 0 ORDER BY avg_damage DESC"},
    {"id": 7, "title": "Liyue characters from JSONB profiles (@> + GIN index)",
     "sql": "SELECT c.name, p.profile->>'playstyle' AS playstyle\nFROM character_profiles p JOIN characters c ON c.id = p.character_id\nWHERE p.profile @> '{\"region\": \"Liyue\"}'::jsonb ORDER BY c.name"},
    {"id": 8, "title": "Best build for Ganyu (SQL function)",
     "sql": "SELECT * FROM get_best_build((SELECT id FROM characters WHERE name = 'Ganyu'))"},
]


@app.route("/api/demo-queries")
def list_demo_queries():
    return jsonify([{"id": q["id"], "title": q["title"], "sql": q["sql"]} for q in DEMO_QUERIES])


@app.route("/api/demo-queries/<int:query_id>")
def run_demo_query(query_id):
    q = next((x for x in DEMO_QUERIES if x["id"] == query_id), None)
    if not q:
        return jsonify({"error": "Unknown demo query"}), 404
    return jsonify({**q, "rows": _rows(q["sql"])})


# =======================================================================
# 11. HEALTH CHECK + STATIC FRONTEND + ERROR HANDLERS
# =======================================================================

@app.route("/api/health")
def health_check():
    try:
        version = db.session.execute(db.text("SELECT version()")).scalar()
        return jsonify({"status": "ok", "database": "connected", "engine": version.split(",")[0]})
    except Exception as exc:                       # noqa: BLE001 - report any failure to the client
        db.session.rollback()
        return jsonify({"status": "error", "database": f"error: {_db_message(exc)}"}), 503


@app.route("/")
def serve_frontend():
    index = os.path.join(app.static_folder, "index.html")
    if os.path.exists(index):
        return send_from_directory(app.static_folder, "index.html")
    return jsonify({
        "message": "Game DB API is running.",
        "note": "No frontend found at app/static/index.html yet.",
        "try": ["/api/health", "/api/characters", "/api/analytics/summary"],
    })


@app.errorhandler(404)
def not_found(_e):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Not found"}), 404
    return send_from_directory(app.static_folder, "index.html") if os.path.exists(
        os.path.join(app.static_folder, "index.html")) else (jsonify({"error": "Not found"}), 404)


@app.errorhandler(IntegrityError)
def handle_integrity_error(exc):
    db.session.rollback()
    return jsonify({"error": _db_message(exc)}), 409      # duplicate name, FK in use, CHECK failed...


@app.errorhandler(SQLAlchemyError)
def handle_db_error(exc):
    db.session.rollback()
    return jsonify({"error": _db_message(exc)}), 400


# =======================================================================
# 12. ENTRY POINT
# =======================================================================

if __name__ == "__main__":
    print(f"Starting server at http://127.0.0.1:{API_PORT}")
    print(f"Try it: http://127.0.0.1:{API_PORT}/api/health")
    app.run(host="0.0.0.0", port=API_PORT, debug=DEBUG)
