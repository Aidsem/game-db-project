# ER Diagram

Rendered automatically by GitHub (Mermaid). A PNG copy is in `er_diagram.png`.

```mermaid
erDiagram
    characters ||--o{ tier_list_combat : "has combat roles"
    characters ||--o| tier_list_exploration : "has one exploration tier"
    characters ||--o{ builds : "owns"
    characters ||--o| character_profiles : "has profile (JSONB)"
    characters ||--o{ build_team_members : "is teammate in"
    weapons ||--o{ builds : "recommended in"
    artifacts ||--o{ builds : "recommended in"
    builds ||--o{ build_team_members : "recommends"
    builds ||--o{ build_damage_logs : "records"

    characters {
        int id PK
        int release_order UK
        varchar name UK
        smallint rarity "CHECK 1-5"
        varchar element
        varchar weapon_type
        text description
    }
    weapons {
        int id PK
        varchar name UK
        varchar type
        smallint rarity "CHECK 1-5"
        text description
    }
    artifacts {
        int id PK
        varchar set_name UK
        text bonus_2pc
        text bonus_4pc
    }
    tier_list_combat {
        int id PK
        int character_id FK
        varchar tier "CHECK S-D"
        varchar role "UK with character_id"
    }
    tier_list_exploration {
        int id PK
        int character_id FK "UNIQUE"
        varchar tier "CHECK S-D"
    }
    builds {
        int id PK
        int character_id FK
        varchar build_name "UK with character_id"
        int weapon_id FK "RESTRICT"
        int artifact_id FK "RESTRICT"
    }
    build_team_members {
        int id PK
        int build_id FK
        int character_id FK
        varchar notes
    }
    build_damage_logs {
        int id PK
        int build_id FK
        varchar label
        double damage_value "trigger: >= 0"
        varchar notes
        timestamptz recorded_at
    }
    character_profiles {
        int character_id PK, FK
        jsonb profile "GIN index"
    }
    audit_log {
        int id PK
        varchar table_name
        varchar action
        int record_id
        varchar details
        timestamptz logged_at
    }
```

`audit_log` has no foreign keys on purpose: it is filled by the trigger `audit_characters` and must keep its rows after a character is deleted.

## Relationships

| Relationship | Cardinality | On delete |
|---|---|---|
| characters - tier_list_combat | 1 : N | CASCADE |
| characters - tier_list_exploration | 1 : 1 | CASCADE |
| characters - builds | 1 : N | CASCADE |
| weapons - builds | 1 : N | RESTRICT (a weapon used by a build cannot be deleted) |
| artifacts - builds | 1 : N | RESTRICT |
| builds - build_team_members - characters | M : N through a junction table | CASCADE |
| builds - build_damage_logs | 1 : N | CASCADE |
| characters - character_profiles | 1 : 1 | CASCADE |
