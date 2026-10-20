import pytest

from game_data import artifact_assets, artifact_effects, character_assets, game_data_status, weapon_assets


def test_character_asset_mapping_uses_source_urls():
    assets = character_assets("Diluc", "Pyro")
    assert assets["portrait_url"].startswith("https://")
    assert assets["element_icon_url"].startswith("https://")
    assert "/home/" not in str(assets)


def test_character_without_current_legacy_portrait_uses_current_source_icon():
    assets = character_assets("Xiangling", "Pyro")
    assert assets["portrait_url"].endswith("UI_AvatarIcon_Xiangling.png")


@pytest.mark.parametrize("element", ["Pyro", "Hydro", "Anemo", "Electro", "Dendro", "Cryo", "Geo"])
def test_all_element_icons_have_source_mappings(element):
    assert character_assets("Diluc", element)["element_icon_url"].startswith("https://")


def test_weapon_mapping_and_absent_class_icon_are_explicit():
    assets = weapon_assets("Lion's Roar", "Sword")
    assert "UI_EquipIcon" in assets["image_url"]
    assert assets["weapon_type_icon_url"] is None


@pytest.mark.parametrize("name,weapon_type", [
    ("Lion's Roar", "Sword"),
    ("Wolf's Gravestone", "Claymore"),
    ("Staff of Homa", "Polearm"),
    ("Amos' Bow", "Bow"),
    ("Skyward Atlas", "Catalyst"),
])
def test_weapon_images_cover_all_five_types(name, weapon_type):
    assert weapon_assets(name, weapon_type)["image_url"].startswith("https://")


def test_artifact_images_and_effects_map_from_real_set_record():
    assets = artifact_assets("Deepwood Memories")
    effects = artifact_effects("Deepwood Memories")
    assert assets["icon_url"].startswith("https://")
    assert effects["bonus_2pc"] == "Dendro DMG Bonus +15%."
    assert "30%" in effects["bonus_4pc"]
    assert effects["source"] == "genshin-db English artifact data"


@pytest.mark.parametrize("name", ["Gladiator's Finale", "Crimson Witch of Flames", "Noblesse Oblige"])
def test_common_artifact_set_images_are_mapped(name):
    assert artifact_assets(name)["icon_url"].startswith("https://")


def test_status_does_not_disclose_local_paths():
    status = game_data_status()
    assert status["source"] == "genshin-db"
    assert "path" not in status
    assert "/home/" not in str(status)
