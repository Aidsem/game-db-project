"""
tests/test_api.py - smoke tests for the API. Run:  pytest -q
Needs DATABASE_URL (in .env) pointing at a database where sql/01-04 were run.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import app  # noqa: E402


@pytest.fixture()
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_health_connected(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.get_json()["database"] == "connected"


def test_list_characters_has_numeric_rarity(client):
    data = client.get("/api/characters").get_json()
    assert len(data) > 0 and isinstance(data[0]["rarity"], int)


def test_create_and_delete_character_writes_audit_log(client):
    r = client.post("/api/characters", json={
        "release_order": 99991, "name": "Pytest Hero", "rarity": 4,
        "element": "Pyro", "weapon_type": "Sword"})
    assert r.status_code == 201
    cid = r.get_json()["id"]
    assert client.delete(f"/api/characters/{cid}").status_code == 200
    log = client.get("/api/audit-log").get_json()
    assert any("Pytest Hero" in (row["details"] or "") for row in log)


def test_duplicate_character_name_returns_409(client):
    name = client.get("/api/characters").get_json()[0]["name"]
    r = client.post("/api/characters", json={
        "release_order": 99992, "name": name, "rarity": 4,
        "element": "Pyro", "weapon_type": "Sword"})
    assert r.status_code == 409


def test_negative_damage_rejected_by_trigger(client):
    build_id = client.get("/api/builds").get_json()[0]["id"]
    r = client.post("/api/procedures/add-damage-log",
                    json={"build_id": build_id, "label": "bad", "damage_value": -5})
    assert r.status_code == 400
    assert "negative" in r.get_json()["error"]


def test_summary_views_and_search(client):
    s = client.get("/api/analytics/summary").get_json()
    assert s["counts"]["characters"] > 0 and "top_builds" in s
    assert len(client.get("/api/views/build-details").get_json()) > 0
    assert client.get("/api/views/nope").status_code == 404
    assert "characters" in client.get("/api/search?q=ba").get_json()


def test_graph_png(client):
    build_id = client.get("/api/builds").get_json()[0]["id"]
    r = client.get(f"/api/damage-logs/graph/build/{build_id}")
    assert r.status_code == 200 and r.mimetype == "image/png"


def test_jsonb_profile_filter(client):
    rows = client.get("/api/profiles?region=Liyue").get_json()
    assert all(r["profile"]["region"] == "Liyue" for r in rows)
